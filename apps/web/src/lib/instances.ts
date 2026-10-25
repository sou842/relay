import "server-only";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { db } from "./db";
import { gatewayAdmin, GatewayError, type InstanceCredentials } from "./gateway";
import type { ProviderId } from "./providers";

// Ownership records: which user owns which gateway instance. The gateway is
// the source of truth for state; this collection maps users to credentials.

export interface InstanceDoc {
	_id: ObjectId;
	userId: string;
	provider: ProviderId;
	gatewayId: number;
	token: string;
	name: string;
	createdAt: Date;
}

/** Shape safe to send to the browser (no token). */
export interface InstanceSummary {
	id: string;
	provider: ProviderId;
	gatewayId: number;
	name: string;
	createdAt: string;
}

const instances = db.collection<InstanceDoc>("instances");
let indexed = false;

async function ensureIndexes() {
	if (indexed) return;
	await instances.createIndex({ userId: 1, createdAt: -1 });
	await instances.createIndex({ gatewayId: 1 }, { unique: true });
	indexed = true;
}

export const MAX_INSTANCES_PER_USER = 5;

async function assertBelowLimit(userId: string) {
	if ((await instances.countDocuments({ userId })) >= MAX_INSTANCES_PER_USER) {
		throw new GatewayError(400, `Limit is ${MAX_INSTANCES_PER_USER} instances per account`);
	}
}

/** Inserts, then re-counts: parallel requests that all passed the first check can't exceed the cap. */
async function insertWithinLimit(doc: InstanceDoc): Promise<boolean> {
	await instances.insertOne(doc);
	const owned = await instances.find({ userId: doc.userId }, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray();
	const position = owned.findIndex((o) => o._id.equals(doc._id));
	if (position < MAX_INSTANCES_PER_USER) return true;
	await instances.deleteOne({ _id: doc._id });
	return false;
}

const limitError = () => new GatewayError(400, `Limit is ${MAX_INSTANCES_PER_USER} instances per account`);

export function toSummary(doc: InstanceDoc): InstanceSummary {
	return {
		id: doc._id.toHexString(),
		provider: doc.provider,
		gatewayId: doc.gatewayId,
		name: doc.name,
		createdAt: doc.createdAt.toISOString(),
	};
}

export function credentials(doc: InstanceDoc): InstanceCredentials {
	return { provider: doc.provider, gatewayId: doc.gatewayId, token: doc.token };
}

export async function listInstances(userId: string): Promise<InstanceDoc[]> {
	await ensureIndexes();
	return instances.find({ userId }).sort({ createdAt: -1 }).toArray();
}

/** Returns the instance only if `userId` owns it. */
export async function getOwnedInstance(userId: string, id: string): Promise<InstanceDoc | null> {
	if (!ObjectId.isValid(id)) return null;
	return instances.findOne({ _id: new ObjectId(id), userId });
}

export async function createInstance(userId: string, provider: ProviderId, name: string): Promise<InstanceDoc> {
	await ensureIndexes();
	await assertBelowLimit(userId);
	const created = await gatewayAdmin.create(provider, name);
	const doc: InstanceDoc = {
		_id: new ObjectId(),
		userId,
		provider,
		gatewayId: created.idInstance,
		token: created.apiTokenInstance,
		name,
		createdAt: new Date(),
	};
	if (!(await insertWithinLimit(doc))) {
		await gatewayAdmin.remove(created.idInstance).catch(() => undefined);
		throw limitError();
	}
	return doc;
}

/**
 * Claims an instance that already exists on the gateway (e.g. created with the
 * gateway CLI). Proving the token is enough; each gateway instance has one owner.
 */
export async function importInstance(userId: string, gatewayId: number, token: string, name: string): Promise<InstanceDoc> {
	await ensureIndexes();
	await assertBelowLimit(userId);
	const existing = await gatewayAdmin.get(gatewayId).catch(() => null);
	if (!existing || !sameSecret(existing.apiTokenInstance, token)) throw new GatewayError(400, "No instance with that idInstance and token");
	if (await instances.findOne({ gatewayId })) throw new GatewayError(409, "This instance is already attached to an account");
	const doc: InstanceDoc = {
		_id: new ObjectId(),
		userId,
		provider: existing.type as ProviderId,
		gatewayId,
		token,
		name: name || existing.name || `Instance ${gatewayId}`,
		createdAt: new Date(),
	};
	if (!(await insertWithinLimit(doc))) throw limitError();
	return doc;
}

function sameSecret(a: string, b: string): boolean {
	const digest = (s: string) => crypto.createHash("sha256").update(s).digest();
	return crypto.timingSafeEqual(digest(a), digest(b));
}

export async function renameInstance(doc: InstanceDoc, name: string): Promise<void> {
	await instances.updateOne({ _id: doc._id }, { $set: { name } });
}

export async function updateToken(doc: InstanceDoc, token: string): Promise<void> {
	await instances.updateOne({ _id: doc._id }, { $set: { token } });
}

export async function deleteInstance(doc: InstanceDoc): Promise<void> {
	await gatewayAdmin.remove(doc.gatewayId).catch((err) => {
		// Already gone on the gateway side is fine; anything else should surface.
		if (err?.status !== 404) throw err;
	});
	await instances.deleteOne({ _id: doc._id });
}
