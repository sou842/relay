import { EventEmitter } from "node:events";
import { collections, nextSeq, serialized } from "../db.ts";

// One FIFO queue per instance. A notification stays at the head until it is
// deleted, either by the client (deleteNotification) or by the webhook
// dispatcher after a successful delivery. That gives at-least-once delivery.
// Entries older than 24 hours are expired by a TTL index (see db.ts).

const arrivals = new EventEmitter();
arrivals.setMaxListeners(0);

// Receipt ids are allocated and inserted in call order, so the queue stays FIFO.
const inOrder = serialized();

export interface QueuedNotification {
	receiptId: number;
	body: Record<string, unknown>;
}

export function enqueueNotification(instanceId: number, body: Record<string, unknown>): Promise<void> {
	return inOrder(instanceId, async () => {
		const receiptId = await nextSeq("notifications");
		await collections.notifications.insertOne({ _id: receiptId, instanceId, body, createdAt: new Date() });
		arrivals.emit(String(instanceId));
	});
}

export async function peekNotification(instanceId: number): Promise<QueuedNotification | null> {
	const doc = await collections.notifications.find({ instanceId }).sort({ _id: 1 }).limit(1).next();
	return doc ? { receiptId: doc._id, body: doc.body } : null;
}

/** Long-poll: return the head of the queue, waiting up to timeoutSec for one to arrive. */
export async function receiveNotification(
	instanceId: number,
	timeoutSec: number,
	signal?: AbortSignal,
): Promise<QueuedNotification | null> {
	const head = await peekNotification(instanceId);
	if (head || timeoutSec <= 0) return head;

	return new Promise((resolve) => {
		const key = String(instanceId);
		const finish = () => {
			clearTimeout(timer);
			arrivals.off(key, finish);
			signal?.removeEventListener("abort", finish);
			resolve(peekNotification(instanceId));
		};
		const timer = setTimeout(finish, timeoutSec * 1000);
		arrivals.on(key, finish);
		signal?.addEventListener("abort", finish);
	});
}

export async function deleteNotification(instanceId: number, receiptId: number): Promise<boolean> {
	const result = await collections.notifications.deleteOne({ _id: receiptId, instanceId });
	return result.deletedCount > 0;
}

export function countNotifications(instanceId: number): Promise<number> {
	return collections.notifications.countDocuments({ instanceId });
}

export async function clearNotifications(instanceId: number): Promise<void> {
	await collections.notifications.deleteMany({ instanceId });
}

export function onNotification(instanceId: number, listener: () => void): () => void {
	arrivals.on(String(instanceId), listener);
	return () => arrivals.off(String(instanceId), listener);
}
