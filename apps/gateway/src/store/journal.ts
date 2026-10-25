import { collections, serialized, type MessageDoc } from "../db.ts";
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

// Writes for one instance run in arrival order, so a receipt or edit never
// lands before the message it refers to.
const inOrder = serialized();

export function recordMessage(e: JournalEntry): Promise<void> {
	return inOrder(e.instanceId, async () => {
		await collections.messages.updateOne(
			{ instanceId: e.instanceId, idMessage: e.idMessage },
			{
				$set: { data: e.data, chatName: e.chatName, ...(e.raw ? { raw: e.raw } : {}) },
				$setOnInsert: {
					chatId: e.chatId,
					direction: e.direction,
					timestamp: e.timestamp,
					senderId: e.senderId,
					senderName: e.senderName,
					status: e.status ?? (e.direction === "outgoing" ? "pending" : null),
					sendByApi: Boolean(e.sendByApi),
					...(e.raw ? {} : { raw: null }),
				},
			},
			{ upsert: true },
		);
		const saved = await getMessage(e.instanceId, e.chatId, e.idMessage);
		if (saved) publish(e.instanceId, { type: "message", message: saved });
	});
}

export function updateStatus(instanceId: number, idMessage: string, status: string): Promise<void> {
	return inOrder(instanceId, async () => {
		// Receipts can arrive out of order; never move a message backwards (read -> delivered).
		const rank = ["pending", "failed", "sent", "delivered", "read"];
		const row = await collections.messages.findOne({ instanceId, idMessage }, { projection: { status: 1, chatId: 1 } });
		if (!row || rank.indexOf(status) <= rank.indexOf(row.status ?? "pending")) return;
		await collections.messages.updateOne({ instanceId, idMessage }, { $set: { status } });
		publish(instanceId, { type: "message.status", chatId: row.chatId, idMessage, status });
	});
}

/** Applies an edit or revoke to the original message instead of storing a new entry. */
export function patchMessage(instanceId: number, idMessage: string, patch: Record<string, unknown>): Promise<void> {
	return inOrder(instanceId, async () => {
		const row = await collections.messages.findOne({ instanceId, idMessage }, { projection: { data: 1, chatId: 1 } });
		if (!row) return;
		await collections.messages.updateOne({ instanceId, idMessage }, { $set: { data: { ...row.data, ...patch } } });
		publish(instanceId, { type: "message.update", chatId: row.chatId, idMessage, patch });
	});
}

export async function rawMessage(
	instanceId: number,
	idMessage: string,
): Promise<{ raw: string | null; chatId: string; direction: string; senderId: string } | undefined> {
	const row = await collections.messages.findOne({ instanceId, idMessage }, { projection: { raw: 1, chatId: 1, direction: 1, senderId: 1 } });
	return row ? { raw: row.raw, chatId: row.chatId, direction: row.direction, senderId: row.senderId } : undefined;
}

// ---- reactions

export function recordReaction(instanceId: number, chatId: string, idMessage: string, senderId: string, reaction: string, timestamp: number): Promise<void> {
	return inOrder(instanceId, async () => {
		if (reaction) {
			await collections.reactions.updateOne({ instanceId, idMessage, senderId }, { $set: { reaction, timestamp } }, { upsert: true });
		} else {
			await collections.reactions.deleteOne({ instanceId, idMessage, senderId });
		}
		publish(instanceId, { type: "reaction", chatId, idMessage, senderId, reaction });
	});
}

async function reactionsFor(instanceId: number, ids: string[]): Promise<Map<string, { senderId: string; reaction: string }[]>> {
	const map = new Map<string, { senderId: string; reaction: string }[]>();
	if (!ids.length) return map;
	const rows = await collections.reactions.find({ instanceId, idMessage: { $in: ids } }).toArray();
	for (const r of rows) {
		if (!map.has(r.idMessage)) map.set(r.idMessage, []);
		map.get(r.idMessage)!.push({ senderId: r.senderId, reaction: r.reaction });
	}
	return map;
}

// ---- read state

export function markChatRead(instanceId: number, chatId: string): Promise<{ chatId: string; idMessage: string; senderId: string; raw: string | null }[]> {
	return inOrder(instanceId, async () => {
		const state = await collections.chatState.findOne({ instanceId, chatId });
		const unread = await collections.messages
			.find({ instanceId, chatId, direction: "incoming", timestamp: { $gt: state?.lastReadTs ?? 0 } }, { projection: { idMessage: 1, senderId: 1, raw: 1 } })
			.toArray();
		await collections.chatState.updateOne({ instanceId, chatId }, { $set: { lastReadTs: Math.floor(Date.now() / 1000) } }, { upsert: true });
		publish(instanceId, { type: "chat.read", chatId });
		return unread.map((u) => ({ chatId, idMessage: u.idMessage, senderId: u.senderId, raw: u.raw }));
	});
}

// ---- queries

function toResponse(r: MessageDoc, reactions?: { senderId: string; reaction: string }[]): Record<string, unknown> {
	const data = r.data;
	const { fileMessageData, ...rest } = data;
	const textMessage = data.textMessageData?.textMessage ?? data.extendedTextMessageData?.text;
	return {
		type: r.direction,
		idMessage: r.idMessage,
		timestamp: r.timestamp,
		chatId: r.chatId,
		...(r.direction === "incoming"
			? { senderId: r.senderId, senderName: r.senderName, senderContactName: "" }
			: { statusMessage: r.status ?? "pending", sendByApi: Boolean(r.sendByApi) }),
		isForwarded: Boolean(fileMessageData?.isForwarded ?? data.extendedTextMessageData?.isForwarded),
		forwardingScore: fileMessageData?.forwardingScore ?? data.extendedTextMessageData?.forwardingScore ?? 0,
		...rest,
		...(fileMessageData ?? {}),
		...(textMessage !== undefined ? { textMessage } : {}),
		...(reactions?.length ? { reactions } : {}),
	};
}

const PUBLIC_FIELDS = { raw: 0 } as const;

/** Newest first. `before` (unix seconds) pages back through older messages. */
export async function chatHistory(instanceId: number, chatId: string, count = 100, before?: number): Promise<Record<string, unknown>[]> {
	const rows = await collections.messages
		.find({ instanceId, chatId, timestamp: { $lt: before ?? Number.MAX_SAFE_INTEGER } }, { projection: PUBLIC_FIELDS })
		.sort({ timestamp: -1, _id: -1 })
		.limit(Math.min(Math.max(count, 1), 1000))
		.toArray();
	const reactions = await reactionsFor(instanceId, rows.map((r) => r.idMessage));
	return rows.map((r) => toResponse(r, reactions.get(r.idMessage)));
}

export async function getMessage(instanceId: number, chatId: string, idMessage: string): Promise<Record<string, unknown> | undefined> {
	const row = await collections.messages.findOne({ instanceId, chatId, idMessage }, { projection: PUBLIC_FIELDS });
	return row ? toResponse(row, (await reactionsFor(instanceId, [idMessage])).get(idMessage)) : undefined;
}

export async function lastMessages(instanceId: number, direction: "incoming" | "outgoing", minutes = 1440): Promise<Record<string, unknown>[]> {
	const since = Math.floor(Date.now() / 1000) - minutes * 60;
	const rows = await collections.messages
		.find({ instanceId, direction, timestamp: { $gte: since } }, { projection: PUBLIC_FIELDS })
		.sort({ timestamp: -1, _id: -1 })
		.toArray();
	return rows.map((r) => toResponse(r));
}

export async function knownName(instanceId: number, chatId: string): Promise<string> {
	const row = await collections.messages
		.find(
			{ instanceId, chatId, $or: [{ chatName: { $ne: "" } }, { direction: "incoming", senderName: { $ne: "" } }] },
			{ projection: { chatName: 1, senderName: 1 } },
		)
		.sort({ timestamp: -1 })
		.limit(1)
		.next();
	return row ? row.chatName || row.senderName : "";
}

/** Chats seen in the journal, newest first, with unread counts. Shape is ours: GREEN-API's getChats format is not in the SDK types. */
export async function listChats(instanceId: number): Promise<Record<string, unknown>[]> {
	const chats = await collections.messages
		.aggregate<{
			_id: string;
			last: MessageDoc;
			chat: { name: string; has: boolean };
			sender: { name: string; has: boolean };
		}>([
			{ $match: { instanceId } },
			{
				$addFields: {
					hasChatName: { $ne: ["$chatName", ""] },
					hasSenderName: { $and: [{ $eq: ["$direction", "incoming"] }, { $ne: ["$senderName", ""] }] },
				},
			},
			{
				$group: {
					_id: "$chatId",
					last: { $top: { sortBy: { timestamp: -1, _id: -1 }, output: { timestamp: "$timestamp", direction: "$direction", status: "$status", data: "$data" } } },
					chat: { $top: { sortBy: { hasChatName: -1, timestamp: -1 }, output: { name: "$chatName", has: "$hasChatName" } } },
					sender: { $top: { sortBy: { hasSenderName: -1, timestamp: -1 }, output: { name: "$senderName", has: "$hasSenderName" } } },
				},
			},
			{ $sort: { "last.timestamp": -1 } },
		])
		.toArray();

	// Unread = incoming messages newer than the chat's read mark.
	const states = await collections.chatState.find({ instanceId }).toArray();
	const readChats = states.map((s) => s.chatId);
	const unreadRows = await collections.messages
		.aggregate<{ _id: string; n: number }>([
			{
				$match: {
					instanceId,
					direction: "incoming",
					$or: [{ chatId: { $nin: readChats } }, ...states.map((s) => ({ chatId: s.chatId, timestamp: { $gt: s.lastReadTs } }))],
				},
			},
			{ $group: { _id: "$chatId", n: { $sum: 1 } } },
		])
		.toArray();
	const unread = new Map(unreadRows.map((u) => [u._id, u.n]));

	return chats.map((c) => {
		const data = c.last.data;
		const chatName = c.chat.has ? c.chat.name : "";
		const senderName = c.sender.has ? c.sender.name : "";
		return {
			id: c._id,
			name: chatName || (c._id.endsWith("@g.us") ? "" : senderName) || "",
			unreadCount: unread.get(c._id) ?? 0,
			lastMessageTime: c.last.timestamp,
			lastMessageType: data.typeMessage,
			lastMessageDirection: c.last.direction,
			lastMessageStatus: c.last.direction === "outgoing" ? c.last.status : undefined,
			lastMessageDeleted: Boolean(data.deleted),
			lastMessageText: data.textMessageData?.textMessage ?? data.extendedTextMessageData?.text ?? data.fileMessageData?.caption ?? "",
		};
	});
}
