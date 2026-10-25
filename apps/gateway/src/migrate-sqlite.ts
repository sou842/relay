import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { collections, mediaBucket, mongoClient, type MessageDoc } from "./db.ts";
import { isMediaFileName, saveMediaFile } from "./media.ts";

// One-time import of a pre-MongoDB data folder (gateway.db + instances/*/auth
// and media) into MongoDB. Safe to re-run: everything is upserted by key.
//   npm run migrate:sqlite            (reads GATEWAY_DATA_DIR, default ./data)
// Stop the gateway first so the SQLite file is not being written.

const dbFile = path.join(config.dataDir, "gateway.db");
if (!fs.existsSync(dbFile)) {
	console.log(`Nothing to import: ${dbFile} does not exist.`);
	await mongoClient.close();
	process.exit(0);
}

const sqlite = new DatabaseSync(dbFile, { readOnly: true });
const all = <T>(sql: string) => sqlite.prepare(sql).all() as T[];
const hasTable = (name: string) => Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const columns = (table: string) => (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

async function bulk<T>(label: string, rows: T[], toOp: (row: T) => any) {
	for (let i = 0; i < rows.length; i += 1000) {
		const ops = rows.slice(i, i + 1000).map(toOp);
		const [name] = label.split(" ");
		await (collections as any)[name].bulkWrite(ops, { ordered: false });
	}
	console.log(`  ${label}: ${rows.length}`);
}

console.log(`Importing ${dbFile} into MongoDB database "${config.mongoDb}"`);

type InstanceRow = { id: number; token: string; type: "whatsapp" | "telegram"; name: string | null; settings: string; created_at: number };
const instanceRows = all<InstanceRow>("SELECT * FROM instances");
await bulk("instances", instanceRows, (r) => ({
	replaceOne: {
		filter: { _id: r.id },
		replacement: { _id: r.id, token: r.token, type: r.type, name: r.name, settings: JSON.parse(r.settings || "{}"), createdAt: r.created_at },
		upsert: true,
	},
}));

if (hasTable("notifications")) {
	type Row = { receipt_id: number; instance_id: number; body: string; created_at: number };
	const rows = all<Row>("SELECT * FROM notifications");
	await bulk("notifications", rows, (r) => ({
		replaceOne: {
			filter: { _id: r.receipt_id },
			replacement: { _id: r.receipt_id, instanceId: r.instance_id, body: JSON.parse(r.body), createdAt: new Date(r.created_at) },
			upsert: true,
		},
	}));
	// New receipt ids continue after the imported ones.
	const max = rows.reduce((m, r) => Math.max(m, r.receipt_id), 0);
	await collections.counters.updateOne({ _id: "notifications" }, { $max: { seq: max } }, { upsert: true });
}

if (hasTable("messages")) {
	const hasRaw = columns("messages").includes("raw");
	type Row = {
		instance_id: number;
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
		raw?: string | null;
	};
	// rowid order keeps same-second messages in their original order.
	const rows = all<Row>("SELECT * FROM messages ORDER BY rowid");
	await bulk("messages", rows, (r) => {
		const doc: MessageDoc = {
			instanceId: r.instance_id,
			idMessage: r.id_message,
			chatId: r.chat_id,
			direction: r.direction,
			timestamp: r.timestamp,
			senderId: r.sender_id,
			senderName: r.sender_name,
			chatName: r.chat_name,
			status: r.status,
			sendByApi: Boolean(r.send_by_api),
			data: JSON.parse(r.data),
			raw: hasRaw ? (r.raw ?? null) : null,
		};
		return { updateOne: { filter: { instanceId: doc.instanceId, idMessage: doc.idMessage }, update: { $set: doc }, upsert: true } };
	});
}

if (hasTable("chat_state")) {
	type Row = { instance_id: number; chat_id: string; last_read_ts: number };
	await bulk("chatState", all<Row>("SELECT * FROM chat_state"), (r) => ({
		updateOne: { filter: { instanceId: r.instance_id, chatId: r.chat_id }, update: { $set: { lastReadTs: r.last_read_ts } }, upsert: true },
	}));
}

if (hasTable("reactions")) {
	type Row = { instance_id: number; id_message: string; sender_id: string; reaction: string; timestamp: number };
	await bulk("reactions", all<Row>("SELECT * FROM reactions"), (r) => ({
		updateOne: {
			filter: { instanceId: r.instance_id, idMessage: r.id_message, senderId: r.sender_id },
			update: { $set: { reaction: r.reaction, timestamp: r.timestamp } },
			upsert: true,
		},
	}));
}

// Session keys and media files from instances/<id>/{auth,media}.
for (const { id } of instanceRows) {
	const dir = path.join(config.dataDir, "instances", String(id));

	const authDir = path.join(dir, "auth");
	if (fs.existsSync(authDir)) {
		const files = fs.readdirSync(authDir).filter((f) => f.endsWith(".json"));
		const ops = files.map((f) => {
			const _id = `${id}:${f.slice(0, -".json".length)}`;
			return { replaceOne: { filter: { _id }, replacement: { _id, instanceId: id, value: fs.readFileSync(path.join(authDir, f), "utf8") }, upsert: true } };
		});
		if (ops.length) await collections.auth.bulkWrite(ops, { ordered: false });
		console.log(`  instance ${id}: ${files.length} session keys`);
	}

	const mediaDir = path.join(dir, "media");
	if (fs.existsSync(mediaDir)) {
		let copied = 0;
		for (const f of fs.readdirSync(mediaDir)) {
			if (!isMediaFileName(f)) continue;
			if (await mediaBucket.find({ filename: `${id}/${f}` }).limit(1).hasNext()) continue;
			await saveMediaFile(id, f, fs.readFileSync(path.join(mediaDir, f)));
			copied++;
		}
		console.log(`  instance ${id}: ${copied} media files`);
	}
}

sqlite.close();
await mongoClient.close();
console.log("Done. The data folder is no longer used; keep it as a backup until you have checked the gateway.");
