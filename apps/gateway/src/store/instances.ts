import crypto from "node:crypto";
import { db } from "../db.ts";
import type { Settings } from "../contract/instance.ts";

export type InstanceType = "whatsapp" | "telegram";

export interface InstanceRecord {
	id: number;
	token: string;
	type: InstanceType;
	name: string | null;
	settings: Settings;
	createdAt: number;
}

// Defaults follow GREEN-API's documented field set. Values are our choice for a test setup.
export const defaultSettings: Required<Omit<Settings, "wid">> = {
	webhookUrl: "",
	webhookUrlToken: "",
	delaySendMessagesMilliseconds: 3000,
	markIncomingMessagesReaded: "no",
	markIncomingMessagesReadedOnReply: "no",
	outgoingWebhook: "yes",
	outgoingMessageWebhook: "yes",
	outgoingAPIMessageWebhook: "yes",
	stateWebhook: "yes",
	incomingWebhook: "yes",
	keepOnlineStatus: "no",
	pollMessageWebhook: "yes",
	incomingCallWebhook: "yes",
	incomingBlockWebhook: "yes",
	editedMessageWebhook: "yes",
	deletedMessageWebhook: "yes",
};

// GREEN-API ids are 10-digit numbers whose prefix encodes the instance type.
const idBase: Record<InstanceType, number> = { whatsapp: 1101000000, telegram: 2201000000 };

type Row = { id: number; token: string; type: InstanceType; name: string | null; settings: string; created_at: number };

function fromRow(row: Row): InstanceRecord {
	return {
		id: row.id,
		token: row.token,
		type: row.type,
		name: row.name,
		settings: { ...defaultSettings, ...JSON.parse(row.settings) },
		createdAt: row.created_at,
	};
}

export function createInstance(type: InstanceType, name?: string): InstanceRecord {
	const { maxId } = db
		.prepare("SELECT MAX(id) AS maxId FROM instances WHERE type = ?")
		.get(type) as { maxId: number | null };
	const id = (maxId ?? idBase[type]) + 1;
	const token = crypto.randomBytes(25).toString("hex");
	db.prepare("INSERT INTO instances (id, token, type, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
		id,
		token,
		type,
		name ?? null,
		Date.now(),
	);
	return getInstance(id)!;
}

export function getInstance(id: number): InstanceRecord | undefined {
	const row = db.prepare("SELECT * FROM instances WHERE id = ?").get(id) as Row | undefined;
	return row && fromRow(row);
}

export function listInstances(): InstanceRecord[] {
	return (db.prepare("SELECT * FROM instances ORDER BY id").all() as Row[]).map(fromRow);
}

export function deleteInstance(id: number): void {
	db.prepare("DELETE FROM instances WHERE id = ?").run(id);
	for (const table of ["notifications", "messages", "chat_state", "reactions"]) {
		db.prepare(`DELETE FROM ${table} WHERE instance_id = ?`).run(id);
	}
}

export function updateSettings(id: number, patch: Settings): Settings {
	const current = getInstance(id);
	if (!current) throw new Error(`Instance ${id} not found`);
	const allowed = Object.keys(defaultSettings);
	const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
	const next = { ...current.settings, ...clean };
	db.prepare("UPDATE instances SET settings = ? WHERE id = ?").run(JSON.stringify(next), id);
	return next;
}

export function rotateToken(id: number): string {
	const token = crypto.randomBytes(25).toString("hex");
	db.prepare("UPDATE instances SET token = ? WHERE id = ?").run(token, id);
	return token;
}

export function tokenMatches(record: InstanceRecord, token: string): boolean {
	const a = Buffer.from(record.token);
	const b = Buffer.from(token);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}
