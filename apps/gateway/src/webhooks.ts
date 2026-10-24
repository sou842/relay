import type { FastifyBaseLogger } from "fastify";
import { getInstance } from "./store/instances.ts";
import { deleteNotification, onNotification, peekNotification } from "./store/notifications.ts";

// Pushes the notification queue to the instance's webhookUrl, head first.
// A notification is removed only after the receiver answers 2xx; failures back
// off and retry, so nothing is lost while the receiver is down (up to the 24h TTL).

const backoffMs = [1000, 5000, 15000, 30000, 60000];

export class WebhookDispatcher {
	private running = false;
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
		if (this.running) return;
		this.running = true;
		try {
			for (;;) {
				const settings = getInstance(this.instanceId)?.settings;
				if (!settings?.webhookUrl) return;
				const head = peekNotification(this.instanceId);
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
				deleteNotification(this.instanceId, head.receiptId);
			}
		} finally {
			this.running = false;
		}
	}

	private async post(url: string, token: string | undefined, body: unknown): Promise<boolean> {
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(15000),
			});
			if (!res.ok) this.log.warn({ instance: this.instanceId, status: res.status }, "webhook rejected");
			return res.ok;
		} catch (err) {
			this.log.warn({ instance: this.instanceId, err: (err as Error).message }, "webhook delivery failed");
			return false;
		}
	}
}
