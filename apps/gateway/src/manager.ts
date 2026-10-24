import fs from "node:fs";
import path from "node:path";
import type { FastifyBaseLogger } from "fastify";
import { config } from "./config.ts";
import { providerByType } from "./providers/index.ts";
import type { ChannelWorker } from "./providers/types.ts";
import { deleteInstance, getInstance, listInstances } from "./store/instances.ts";

// Keeps one live worker per instance. Instances created with the CLI while the
// server runs are started lazily on their first API call.

export class InstanceManager {
	private readonly workers = new Map<number, ChannelWorker>();

	constructor(private readonly log: FastifyBaseLogger) {}

	async startAll(): Promise<void> {
		for (const record of listInstances()) this.get(record.id);
	}

	get(id: number): ChannelWorker | undefined {
		const existing = this.workers.get(id);
		if (existing) return existing;
		const record = getInstance(id);
		const provider = record && providerByType(record.type);
		if (!provider) return undefined;
		const worker: ChannelWorker = provider.createWorker(id, this.log);
		this.workers.set(id, worker);
		worker.start().catch((err: unknown) => this.log.error({ instance: id, err }, "worker failed to start"));
		return worker;
	}

	/** Unlinks the account, stops the worker and deletes every trace of the instance. */
	async remove(id: number): Promise<void> {
		const worker = this.workers.get(id);
		if (worker) {
			if (worker.state === "authorized") await worker.logout();
			worker.dispose();
			this.workers.delete(id);
		}
		deleteInstance(id);
		fs.rmSync(path.join(config.dataDir, "instances", String(id)), { recursive: true, force: true });
	}

	async stopAll(): Promise<void> {
		for (const worker of this.workers.values()) worker.dispose();
		this.workers.clear();
	}
}
