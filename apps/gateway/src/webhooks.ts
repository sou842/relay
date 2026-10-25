import type { FastifyBaseLogger } from "fastify";
import { safeRequest } from "./net.ts";
import { getInstance } from "./store/instances.ts";
import { deleteNotification, onNotification, peekNotification } from "./store/notifications.ts";

// Pushes the notification queue to the instance's webhookUrl, head first.
// A notification is removed only after the receiver answers 2xx; failures back
// off and retry, so nothing is lost while the receiver is down (up to the 24h TTL).

const backoffMs = [1000, 5000, 15000, 30000, 60000];

export class WebhookDispatcher {
	private running = false;
	private rerun = false;
	private failures = 0;
	private timer: NodeJS.Timeout | undefined;
	private readonly unsubscribe: () => void;

	constructor(
		private readonly instanceId: number,
		private readonly log: FastifyBaseLogger,
	) {
		this.unsubscribe = onNotification(instanceId, () => this.kick());
	}

	kick(): void {
		if (this.timer) return;
		void this.drain();
	}

	stop(): void {
		this.unsubscribe();
		clearTimeout(this.timer);
	}

	private async drain(): Promise<void> {
		// A kick during a drain is remembered, so a notification queued while the
		// queue looked empty is not left waiting for the next one.
		if (this.running) {
			this.rerun = true;
			return;
		}
		this.running = true;
		try {
			do {
				this.rerun = false;
				await this.deliverAll();
			} while (this.rerun && !this.timer);
		} catch (err) {
			this.log.warn({ instance: this.instanceId, err: (err as Error).message }, "webhook queue failed");
		} finally {
			this.running = false;
		}
	}

	private async deliverAll(): Promise<void> {
		for (;;) {
			const settings = getInstance(this.instanceId)?.settings;
			if (!settings?.webhookUrl) return;
			const head = await peekNotification(this.instanceId);
			if (!head) return;

			const ok = await this.post(settings.webhookUrl, settings.webhookUrlToken, head.body);
			if (!ok) {
				const delay = backoffMs[Math.min(this.failures++, backoffMs.length - 1)];
				this.timer = setTimeout(() => {
					this.timer = undefined;
					void this.drain();
				}, delay);
				return;
			}
			this.failures = 0;
			await deleteNotification(this.instanceId, head.receiptId);
		}
	}

	private async post(url: string, token: string | undefined, body: unknown): Promise<boolean> {
		try {
			// POSTs are never redirected; private addresses are refused at connect time.
			const res = await safeRequest(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(body),
				timeoutMs: 15000,
				maxBytes: 64 * 1024,
			});
			const ok = res.status >= 200 && res.status < 300;
			if (!ok) this.log.warn({ instance: this.instanceId, status: res.status }, "webhook rejected");
			return ok;
		} catch (err) {
			this.log.warn({ instance: this.instanceId, err: (err as Error).message }, "webhook delivery failed");
			return false;
		}
	}
}
