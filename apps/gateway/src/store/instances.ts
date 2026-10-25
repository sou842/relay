import crypto from "node:crypto";
import { collections, mediaBucket, type InstanceDoc } from "../db.ts";
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

// Instance records are read on every API call and every settings check, so
// they are cached in memory and written through to MongoDB. The gateway is a
// single process, so the cache is authoritative; findInstance() picks up
// instances created elsewhere (the CLI) on first use.
const cache = new Map<number, InstanceRecord>();

function fromDoc(doc: InstanceDoc): InstanceRecord {
	return {
		id: doc._id,
		token: doc.token,
		type: doc.type,
		name: doc.name,
		settings: { ...defaultSettings, ...doc.settings },
		createdAt: doc.createdAt,
	};
}

/** Fills the cache; call once at startup. */
export async function loadInstances(): Promise<void> {
	cache.clear();
	for (const doc of await collections.instances.find().sort({ _id: 1 }).toArray()) cache.set(doc._id, fromDoc(doc));
}

export async function createInstance(type: InstanceType, name?: string): Promise<InstanceRecord> {
	// The unique _id settles races between processes; retry with the next id.
	for (let attempt = 0; attempt < 5; attempt++) {
		const last = await collections.instances.find({ type }).sort({ _id: -1 }).limit(1).next();
		const doc: InstanceDoc = {
			_id: (last?._id ?? idBase[type]) + 1,
			token: crypto.randomBytes(25).toString("hex"),
			type,
			name: name ?? null,
			settings: {},
			createdAt: Date.now(),
		};
		try {
			await collections.instances.insertOne(doc);
		} catch (err) {
			if ((err as { code?: number }).code === 11000) continue;
			throw err;
		}
		const record = fromDoc(doc);
		cache.set(record.id, record);
		return record;
	}
	throw new Error("Could not allocate an instance id");
}

export function getInstance(id: number): InstanceRecord | undefined {
	return cache.get(id);
}

/** Cache first, then the database (for instances created by another process). */
export async function findInstance(id: number): Promise<InstanceRecord | undefined> {
	const hit = cache.get(id);
	if (hit || !Number.isSafeInteger(id)) return hit;
	const doc = await collections.instances.findOne({ _id: id });
	if (!doc) return undefined;
	const record = fromDoc(doc);
	cache.set(id, record);
	return record;
}

export function listInstances(): InstanceRecord[] {
	return [...cache.values()].sort((a, b) => a.id - b.id);
}

/** Removes the instance and everything stored for it (journal, queue, session keys, media). */
export async function deleteInstance(id: number): Promise<void> {
	cache.delete(id);
	await Promise.all([
		collections.instances.deleteOne({ _id: id }),
		collections.notifications.deleteMany({ instanceId: id }),
		collections.messages.deleteMany({ instanceId: id }),
		collections.chatState.deleteMany({ instanceId: id }),
		collections.reactions.deleteMany({ instanceId: id }),
		collections.auth.deleteMany({ instanceId: id }),
	]);
	for await (const file of mediaBucket.find({ "metadata.instanceId": id }, { projection: { _id: 1 } })) {
		await mediaBucket.delete(file._id).catch(() => undefined);
	}
}

export async function updateSettings(id: number, patch: Settings): Promise<Settings> {
	const current = cache.get(id);
	if (!current) throw new Error(`Instance ${id} not found`);
	const allowed = Object.keys(defaultSettings);
	const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
	const next = { ...current.settings, ...clean };
	await collections.instances.updateOne({ _id: id }, { $set: { settings: next } });
	current.settings = next;
	return next;
}

export async function rotateToken(id: number): Promise<string> {
	const token = crypto.randomBytes(25).toString("hex");
	await collections.instances.updateOne({ _id: id }, { $set: { token } });
	const current = cache.get(id);
	if (current) current.token = token;
	return token;
}

export function tokenMatches(record: InstanceRecord, token: string): boolean {
	const a = Buffer.from(record.token);
	const b = Buffer.from(token);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}
