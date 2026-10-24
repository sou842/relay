import { db } from "../db.ts";
import { publish } from "../events.ts";

// Message journal behind getChatHistory / getMessage / lastIncomingMessages /
// lastOutgoingMessages / getChats. Entries follow the SDK's JournalResponse
// shape: the webhook messageData plus type/idMessage/chatId/sender or status
// fields, with fileMessageData flattened into the top level. Every change is
// also published on the live event bus.

export interface JournalEntry {
	instanceId: number;
	idMessage: string;
	chatId: string;
	direction: "incoming" | "outgoing";
	timestamp: number;
	senderId: string;
	senderName: string;
	chatName: string;
	status?: string;
	sendByApi?: boolean;
	data: Record<string, any>;
	/** Provider-native message, serialized; never returned by the API. */
	raw?: string;
}

type Row = {
	id_message: string;
	chat_id: string;
	direction: "incoming" | "outgoing";
	timestamp: number;
	sender_id: string;
	sender_name: string;
	chat_name: string;
	status: string | null;
	send_by_api: number;
	data: string;
};

export function recordMessage(e: JournalEntry): void {
	db.prepare(
		`INSERT INTO messages (instance_id, id_message, chat_id, direction, timestamp, sender_id, sender_name, chat_name, status, send_by_api, data, raw)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (instance_id, id_message) DO UPDATE SET data = excluded.data, chat_name = excluded.chat_name, raw = COALESCE(excluded.raw, raw)`,
	).run(
		e.instanceId,
		e.idMessage,
		e.chatId,
		e.direction,
		e.timestamp,
		e.senderId,
		e.senderName,
		e.chatName,
		e.status ?? (e.direction === "outgoing" ? "pending" : null),
		e.sendByApi ? 1 : 0,
		JSON.stringify(e.data),
		e.raw ?? null,
	);
	const saved = getMessage(e.instanceId, e.chatId, e.idMessage);
	if (saved) publish(e.instanceId, { type: "message", message: saved });
}

export function updateStatus(instanceId: number, idMessage: string, status: string): void {
	// Receipts can arrive out of order; never move a message backwards (read -> delivered).
	const rank = ["pending", "failed", "sent", "delivered", "read"];
	const row = db.prepare("SELECT status, chat_id FROM messages WHERE instance_id = ? AND id_message = ?").get(instanceId, idMessage) as
		| { status: string | null; chat_id: string }
		| undefined;
	if (!row || rank.indexOf(status) <= rank.indexOf(row.status ?? "pending")) return;
	db.prepare("UPDATE messages SET status = ? WHERE instance_id = ? AND id_message = ?").run(status, instanceId, idMessage);
	publish(instanceId, { type: "message.status", chatId: row.chat_id, idMessage, status });
}

/** Applies an edit or revoke to the original message instead of storing a new entry. */
export function patchMessage(instanceId: number, idMessage: string, patch: Record<string, unknown>): void {
	const row = db.prepare("SELECT data, chat_id FROM messages WHERE instance_id = ? AND id_message = ?").get(instanceId, idMessage) as
		| { data: string; chat_id: string }
		| undefined;
	if (!row) return;
	const data = { ...JSON.parse(row.data), ...patch };
	db.prepare("UPDATE messages SET data = ? WHERE instance_id = ? AND id_message = ?").run(JSON.stringify(data), instanceId, idMessage);
	publish(instanceId, { type: "message.update", chatId: row.chat_id, idMessage, patch });
}

export function rawMessage(instanceId: number, idMessage: string): { raw: string | null; chatId: string; direction: string; senderId: string } | undefined {
	const row = db
		.prepare("SELECT raw, chat_id, direction, sender_id FROM messages WHERE instance_id = ? AND id_message = ?")
		.get(instanceId, idMessage) as { raw: string | null; chat_id: string; direction: string; sender_id: string } | undefined;
	return row && { raw: row.raw, chatId: row.chat_id, direction: row.direction, senderId: row.sender_id };
}

// ---- reactions

export function recordReaction(instanceId: number, chatId: string, idMessage: string, senderId: string, reaction: string, timestamp: number): void {
	if (reaction) {
		db.prepare(
			`INSERT INTO reactions (instance_id, id_message, sender_id, reaction, timestamp) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (instance_id, id_message, sender_id) DO UPDATE SET reaction = excluded.reaction, timestamp = excluded.timestamp`,
		).run(instanceId, idMessage, senderId, reaction, timestamp);
	} else {
		db.prepare("DELETE FROM reactions WHERE instance_id = ? AND id_message = ? AND sender_id = ?").run(instanceId, idMessage, senderId);
	}
	publish(instanceId, { type: "reaction", chatId, idMessage, senderId, reaction });
}

function reactionsFor(instanceId: number, ids: string[]): Map<string, { senderId: string; reaction: string }[]> {
	const map = new Map<string, { senderId: string; reaction: string }[]>();
	if (!ids.length) return map;
	const rows = db
		.prepare(`SELECT id_message, sender_id, reaction FROM reactions WHERE instance_id = ? AND id_message IN (${ids.map(() => "?").join(",")})`)
		.all(instanceId, ...ids) as { id_message: string; sender_id: string; reaction: string }[];
	for (const r of rows) {
		if (!map.has(r.id_message)) map.set(r.id_message, []);
		map.get(r.id_message)!.push({ senderId: r.sender_id, reaction: r.reaction });
	}
	return map;
}

// ---- read state

export function markChatRead(instanceId: number, chatId: string): { chatId: string; idMessage: string; senderId: string; raw: string | null }[] {
	const { last } = (db.prepare("SELECT last_read_ts AS last FROM chat_state WHERE instance_id = ? AND chat_id = ?").get(instanceId, chatId) as
		| { last: number }
		| undefined) ?? { last: 0 };
	const unread = db
		.prepare("SELECT id_message, sender_id, raw FROM messages WHERE instance_id = ? AND chat_id = ? AND direction = 'incoming' AND timestamp > ?")
		.all(instanceId, chatId, last) as { id_message: string; sender_id: string; raw: string | null }[];
	db.prepare(
		`INSERT INTO chat_state (instance_id, chat_id, last_read_ts) VALUES (?, ?, ?)
		 ON CONFLICT (instance_id, chat_id) DO UPDATE SET last_read_ts = excluded.last_read_ts`,
	).run(instanceId, chatId, Math.floor(Date.now() / 1000));
	publish(instanceId, { type: "chat.read", chatId });
	return unread.map((u) => ({ chatId, idMessage: u.id_message, senderId: u.sender_id, raw: u.raw }));
}

// ---- queries

function toResponse(r: Row, reactions?: { senderId: string; reaction: string }[]): Record<string, unknown> {
	const data = JSON.parse(r.data);
	const { fileMessageData, ...rest } = data;
	const textMessage = data.textMessageData?.textMessage ?? data.extendedTextMessageData?.text;
	return {
		type: r.direction,
		idMessage: r.id_message,
		timestamp: r.timestamp,
		chatId: r.chat_id,
		...(r.direction === "incoming"
			? { senderId: r.sender_id, senderName: r.sender_name, senderContactName: "" }
			: { statusMessage: r.status ?? "pending", sendByApi: Boolean(r.send_by_api) }),
		isForwarded: Boolean(fileMessageData?.isForwarded ?? data.extendedTextMessageData?.isForwarded),
		forwardingScore: fileMessageData?.forwardingScore ?? data.extendedTextMessageData?.forwardingScore ?? 0,
		...rest,
		...(fileMessageData ?? {}),
		...(textMessage !== undefined ? { textMessage } : {}),
		...(reactions?.length ? { reactions } : {}),
	};
}

const COLUMNS = "id_message, chat_id, direction, timestamp, sender_id, sender_name, chat_name, status, send_by_api, data";

/** Newest first. `before` (unix seconds) pages back through older messages. */
export function chatHistory(instanceId: number, chatId: string, count = 100, before?: number): Record<string, unknown>[] {
	const rows = db
		.prepare(
			`SELECT ${COLUMNS} FROM messages WHERE instance_id = ? AND chat_id = ? AND timestamp < ? ORDER BY timestamp DESC, rowid DESC LIMIT ?`,
		)
		.all(instanceId, chatId, before ?? Number.MAX_SAFE_INTEGER, Math.min(Math.max(count, 1), 1000)) as Row[];
	const reactions = reactionsFor(instanceId, rows.map((r) => r.id_message));
	return rows.map((r) => toResponse(r, reactions.get(r.id_message)));
}

export function getMessage(instanceId: number, chatId: string, idMessage: string): Record<string, unknown> | undefined {
	const row = db
		.prepare(`SELECT ${COLUMNS} FROM messages WHERE instance_id = ? AND chat_id = ? AND id_message = ?`)
		.get(instanceId, chatId, idMessage) as Row | undefined;
	return row && toResponse(row, reactionsFor(instanceId, [idMessage]).get(idMessage));
}

export function lastMessages(instanceId: number, direction: "incoming" | "outgoing", minutes = 1440): Record<string, unknown>[] {
	const since = Math.floor(Date.now() / 1000) - minutes * 60;
	const rows = db
		.prepare(`SELECT ${COLUMNS} FROM messages WHERE instance_id = ? AND direction = ? AND timestamp >= ? ORDER BY timestamp DESC`)
		.all(instanceId, direction, since) as Row[];
	return rows.map((r) => toResponse(r));
}

export function knownName(instanceId: number, chatId: string): string {
	const row = db
		.prepare(
			`SELECT CASE WHEN chat_name <> '' THEN chat_name ELSE sender_name END AS name FROM messages
			 WHERE instance_id = ? AND chat_id = ? AND (chat_name <> '' OR (direction = 'incoming' AND sender_name <> ''))
			 ORDER BY timestamp DESC LIMIT 1`,
		)
		.get(instanceId, chatId) as { name: string } | undefined;
	return row?.name ?? "";
}

/** Chats seen in the journal, newest first, with unread counts. Shape is ours: GREEN-API's getChats format is not in the SDK types. */
export function listChats(instanceId: number): Record<string, unknown>[] {
	const rows = db
		.prepare(
			`SELECT m.chat_id, m.timestamp, m.direction, m.status, m.data,
			        (SELECT chat_name FROM messages c WHERE c.instance_id = m.instance_id AND c.chat_id = m.chat_id AND c.chat_name <> '' ORDER BY c.timestamp DESC LIMIT 1) AS chat_name,
			        (SELECT sender_name FROM messages s WHERE s.instance_id = m.instance_id AND s.chat_id = m.chat_id AND s.direction = 'incoming' AND s.sender_name <> '' ORDER BY s.timestamp DESC LIMIT 1) AS sender_name,
			        (SELECT COUNT(*) FROM messages u WHERE u.instance_id = m.instance_id AND u.chat_id = m.chat_id AND u.direction = 'incoming'
			           AND u.timestamp > COALESCE((SELECT last_read_ts FROM chat_state cs WHERE cs.instance_id = m.instance_id AND cs.chat_id = m.chat_id), 0)) AS unread
			 FROM messages m
			 WHERE m.instance_id = ? AND m.rowid = (
			   SELECT rowid FROM messages x WHERE x.instance_id = m.instance_id AND x.chat_id = m.chat_id ORDER BY x.timestamp DESC, x.rowid DESC LIMIT 1)
			 ORDER BY m.timestamp DESC`,
		)
		.all(instanceId) as (Row & { sender_name: string | null; unread: number })[];
	return rows.map((r) => {
		const data = JSON.parse(r.data);
		return {
			id: r.chat_id,
			name: r.chat_name || (r.chat_id.endsWith("@g.us") ? "" : r.sender_name) || "",
			unreadCount: r.unread,
			lastMessageTime: r.timestamp,
			lastMessageType: data.typeMessage,
			lastMessageDirection: r.direction,
			lastMessageStatus: r.direction === "outgoing" ? r.status : undefined,
			lastMessageDeleted: Boolean(data.deleted),
			lastMessageText: data.textMessageData?.textMessage ?? data.extendedTextMessageData?.text ?? data.fileMessageData?.caption ?? "",
		};
	});
}
