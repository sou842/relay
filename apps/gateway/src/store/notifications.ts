import { EventEmitter } from "node:events";
import { config } from "../config.ts";
import { db } from "../db.ts";

// One FIFO queue per instance. A notification stays at the head until it is
// deleted, either by the client (deleteNotification) or by the webhook
// dispatcher after a successful delivery. That gives at-least-once delivery.

const arrivals = new EventEmitter();
arrivals.setMaxListeners(0);

export interface QueuedNotification {
	receiptId: number;
	body: Record<string, unknown>;
}

type Row = { receipt_id: number; body: string };

export function enqueueNotification(instanceId: number, body: Record<string, unknown>): void {
	db.prepare("INSERT INTO notifications (instance_id, body, created_at) VALUES (?, ?, ?)").run(
		instanceId,
		JSON.stringify(body),
		Date.now(),
	);
	arrivals.emit(String(instanceId));
}

export function peekNotification(instanceId: number): QueuedNotification | null {
	const row = db
		.prepare("SELECT receipt_id, body FROM notifications WHERE instance_id = ? ORDER BY receipt_id LIMIT 1")
		.get(instanceId) as Row | undefined;
	return row ? { receiptId: row.receipt_id, body: JSON.parse(row.body) } : null;
}

/** Long-poll: return the head of the queue, waiting up to timeoutSec for one to arrive. */
export function receiveNotification(
	instanceId: number,
	timeoutSec: number,
	signal?: AbortSignal,
): Promise<QueuedNotification | null> {
	const head = peekNotification(instanceId);
	if (head || timeoutSec <= 0) return Promise.resolve(head);

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

export function deleteNotification(instanceId: number, receiptId: number): boolean {
	const result = db
		.prepare("DELETE FROM notifications WHERE instance_id = ? AND receipt_id = ?")
		.run(instanceId, receiptId);
	return result.changes > 0;
}

export function countNotifications(instanceId: number): number {
	const { n } = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE instance_id = ?").get(instanceId) as {
		n: number;
	};
	return n;
}

export function clearNotifications(instanceId: number): void {
	db.prepare("DELETE FROM notifications WHERE instance_id = ?").run(instanceId);
}

export function onNotification(instanceId: number, listener: () => void): () => void {
	arrivals.on(String(instanceId), listener);
	return () => arrivals.off(String(instanceId), listener);
}

export function purgeExpiredNotifications(): void {
	db.prepare("DELETE FROM notifications WHERE created_at < ?").run(Date.now() - config.notificationTtlMs);
}
