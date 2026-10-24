import type { InstanceType } from "../store/instances.ts";
import { commonMethods } from "./common-methods.ts";
import type { MethodDef, Provider } from "./types.ts";
import { whatsappMethods } from "./whatsapp/methods.ts";
import { WhatsAppWorker } from "./whatsapp/worker.ts";

// Register providers here. Adding Telegram = a worker + method table + one entry.

const whatsapp: Provider<WhatsAppWorker> = {
	type: "whatsapp",
	urlPrefix: "wa",
	createWorker: (id, log) => new WhatsAppWorker(id, log),
	methods: whatsappMethods,
};

export const providers: Provider<any>[] = [whatsapp];

export function providerByType(type: InstanceType): Provider<any> | undefined {
	return providers.find((p) => p.type === type);
}

export function providerByPrefix(prefix: string): Provider<any> | undefined {
	return providers.find((p) => p.urlPrefix === prefix);
}

/** Provider methods override common ones; lookups are case-insensitive. */
const tables = new Map<Provider<any>, Map<string, MethodDef<any>>>(
	providers.map((p) => [
		p,
		new Map(Object.entries({ ...commonMethods, ...p.methods }).map(([name, def]) => [name.toLowerCase(), def as MethodDef<any>])),
	]),
);

export function findMethod(provider: Provider<any>, name: string): MethodDef<any> | undefined {
	return tables.get(provider)?.get(name.toLowerCase());
}
