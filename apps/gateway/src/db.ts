import { GridFSBucket, MongoClient } from "mongodb";
import { config } from "./config.ts";
import type { Settings } from "./contract/instance.ts";

// All gateway state lives in MongoDB: instances, the notification queue, the
// message journal, WhatsApp session keys and media (GridFS). Nothing is kept on
// local disk, so the gateway can run on hosts without persistent storage.

if (!config.mongoUri) throw new Error("Set GATEWAY_MONGODB_URI (or MONGODB_URI) to a MongoDB connection string");

export const mongoClient = new MongoClient(config.mongoUri);
await mongoClient.connect();
export const db = mongoClient.db(config.mongoDb);

export interface InstanceDoc {
	_id: number;
	token: string;
	type: "whatsapp" | "telegram";
	name: string | null;
	settings: Settings;
	createdAt: number;
}

export interface NotificationDoc {
	/** receiptId: increasing number from the counters collection. */
	_id: number;
	instanceId: number;
	body: Record<string, unknown>;
	createdAt: Date;
}

export interface MessageDoc {
	instanceId: number;
	idMessage: string;
	chatId: string;
	direction: "incoming" | "outgoing";
	timestamp: number;
	senderId: string;
	senderName: string;
	chatName: string;
	status: string | null;
	sendByApi: boolean;
	data: Record<string, any>;
	/** Serialized provider message (Baileys WAMessage) so replies, forwards and read receipts survive restarts. */
	raw: string | null;
}

export interface ChatStateDoc {
	instanceId: number;
	chatId: string;
	lastReadTs: number;
}

export interface ReactionDoc {
	instanceId: number;
	idMessage: string;
	senderId: string;
	reaction: string;
	timestamp: number;
}

export interface AuthDoc {
	/** `${instanceId}:${key}` where key is Baileys' auth file name without ".json". */
	_id: string;
	instanceId: number;
	value: string;
}

export const collections = {
	instances: db.collection<InstanceDoc>("instances"),
	counters: db.collection<{ _id: string; seq: number }>("counters"),
	notifications: db.collection<NotificationDoc>("notifications"),
	messages: db.collection<MessageDoc>("messages"),
	chatState: db.collection<ChatStateDoc>("chat_state"),
	reactions: db.collection<ReactionDoc>("reactions"),
	auth: db.collection<AuthDoc>("auth"),
};

export const mediaBucket = new GridFSBucket(db, { bucketName: "media" });

await Promise.all([
	collections.instances.createIndex({ type: 1, _id: -1 }),
	collections.notifications.createIndex({ instanceId: 1, _id: 1 }),
	// GREEN-API keeps undelivered notifications for 24 hours; MongoDB expires them.
	collections.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: Math.floor(config.notificationTtlMs / 1000) }),
	collections.messages.createIndex({ instanceId: 1, idMessage: 1 }, { unique: true }),
	collections.messages.createIndex({ instanceId: 1, chatId: 1, timestamp: -1 }),
	collections.messages.createIndex({ instanceId: 1, direction: 1, timestamp: -1 }),
	collections.chatState.createIndex({ instanceId: 1, chatId: 1 }, { unique: true }),
	collections.reactions.createIndex({ instanceId: 1, idMessage: 1, senderId: 1 }, { unique: true }),
	collections.auth.createIndex({ instanceId: 1 }),
	db.collection("media.files").createIndex({ filename: 1 }),
	db.collection("media.files").createIndex({ "metadata.instanceId": 1 }),
]);

/** Next value of a named sequence (atomic). */
export async function nextSeq(name: string): Promise<number> {
	const doc = await collections.counters.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
	return doc!.seq;
}

/** Runs async writes for one key strictly in call order (journal and queue writes must not overtake each other). */
export function serialized() {
	const chains = new Map<number, Promise<unknown>>();
	return <T>(key: number, fn: () => Promise<T>): Promise<T> => {
		const next = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
		const settled = next.catch(() => undefined);
		chains.set(key, settled);
		void settled.then(() => {
			if (chains.get(key) === settled) chains.delete(key);
		});
		return next;
	};
}
