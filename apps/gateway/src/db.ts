import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });

export const db = new DatabaseSync(path.join(config.dataDir, "gateway.db"));

db.exec(`
	PRAGMA journal_mode = WAL;

	CREATE TABLE IF NOT EXISTS instances (
		id         INTEGER PRIMARY KEY,
		token      TEXT    NOT NULL,
		type       TEXT    NOT NULL CHECK (type IN ('whatsapp', 'telegram')),
		name       TEXT,
		settings   TEXT    NOT NULL DEFAULT '{}',
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS notifications (
		receipt_id  INTEGER PRIMARY KEY AUTOINCREMENT,
		instance_id INTEGER NOT NULL,
		body        TEXT    NOT NULL,
		created_at  INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS notifications_by_instance ON notifications (instance_id, receipt_id);

	CREATE TABLE IF NOT EXISTS messages (
		instance_id  INTEGER NOT NULL,
		id_message   TEXT    NOT NULL,
		chat_id      TEXT    NOT NULL,
		direction    TEXT    NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
		timestamp    INTEGER NOT NULL,
		sender_id    TEXT    NOT NULL DEFAULT '',
		sender_name  TEXT    NOT NULL DEFAULT '',
		chat_name    TEXT    NOT NULL DEFAULT '',
		status       TEXT,
		send_by_api  INTEGER NOT NULL DEFAULT 0,
		data         TEXT    NOT NULL,
		PRIMARY KEY (instance_id, id_message)
	);
	CREATE INDEX IF NOT EXISTS messages_by_chat ON messages (instance_id, chat_id, timestamp);
	CREATE INDEX IF NOT EXISTS messages_by_time ON messages (instance_id, timestamp);

	CREATE TABLE IF NOT EXISTS chat_state (
		instance_id  INTEGER NOT NULL,
		chat_id      TEXT    NOT NULL,
		last_read_ts INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (instance_id, chat_id)
	);

	CREATE TABLE IF NOT EXISTS reactions (
		instance_id INTEGER NOT NULL,
		id_message  TEXT    NOT NULL,
		sender_id   TEXT    NOT NULL,
		reaction    TEXT    NOT NULL,
		timestamp   INTEGER NOT NULL,
		PRIMARY KEY (instance_id, id_message, sender_id)
	);
`);

// Additive migrations for databases created by earlier versions.
const messageColumns = (db.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).map((c) => c.name);
if (!messageColumns.includes("raw")) {
	// Serialized provider message (Baileys WAMessage) so replies, forwards and read receipts survive restarts.
	db.exec("ALTER TABLE messages ADD COLUMN raw TEXT");
}
