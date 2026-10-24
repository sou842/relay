import type { FastifyBaseLogger } from "fastify";
import type { InstanceState } from "../contract/instance.ts";
import type { InstanceRecord, InstanceType } from "../store/instances.ts";

// Seam for adding messengers. A provider owns its live connection (the worker)
// and the provider-specific API methods; queues, journal, settings and
// webhooks are shared and live outside the providers.

export interface ChannelWorker {
	readonly instanceId: number;
	readonly state: InstanceState;
	/** The account's own chat id once authorized, "" before. */
	readonly wid: string;
	start(): Promise<void>;
	/** Unlink the account and wipe its session. */
	logout(): Promise<void>;
	dispose(): void;
	onSettingsChanged(): void;
}

export interface UploadedFile {
	buffer: Buffer;
	filename: string;
	mimetype: string;
}

export interface MethodContext<W extends ChannelWorker = ChannelWorker> {
	instance: InstanceRecord;
	worker: W;
	baseUrl: string;
	body: Record<string, any>;
	file: UploadedFile | undefined;
	query: Record<string, string | undefined>;
	extra: string | undefined;
	signal: AbortSignal;
}

export interface MethodDef<W extends ChannelWorker = ChannelWorker> {
	verb: "GET" | "POST" | "DELETE";
	handler: (ctx: MethodContext<W>) => unknown;
}

export interface Provider<W extends ChannelWorker = ChannelWorker> {
	type: InstanceType;
	/** URL prefix: "wa" -> /waInstance{id}/..., "tg" -> /tgInstance{id}/... */
	urlPrefix: string;
	createWorker(instanceId: number, log: FastifyBaseLogger): W;
	methods: Record<string, MethodDef<W>>;
}
