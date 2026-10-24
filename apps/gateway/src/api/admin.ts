import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config.ts";
import type { InstanceManager } from "../manager.ts";
import { providerByType, providers } from "../providers/index.ts";
import { createInstance, getInstance, listInstances, type InstanceType } from "../store/instances.ts";
import { ApiError } from "./errors.ts";

// Management API for the web app: create / list / delete instances.
// Authenticated with GATEWAY_ADMIN_KEY; disabled entirely when the key is unset.

function requireAdmin(req: FastifyRequest) {
	if (!config.adminKey) throw new ApiError(403, "Admin API disabled: set GATEWAY_ADMIN_KEY");
	const given = Buffer.from(req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "");
	const expected = Buffer.from(config.adminKey);
	if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new ApiError(401, "Unauthorized");
}

function describe(id: number, manager: InstanceManager) {
	const record = getInstance(id)!;
	const worker = manager.get(id);
	const provider = providerByType(record.type)!;
	return {
		idInstance: record.id,
		apiTokenInstance: record.token,
		type: record.type,
		urlPrefix: `${provider.urlPrefix}Instance`,
		name: record.name,
		stateInstance: worker?.state ?? "starting",
		wid: worker?.wid ?? "",
		createdAt: record.createdAt,
	};
}

export function registerAdminRoutes(app: FastifyInstance, manager: InstanceManager) {
	app.addHook("onRequest", async (req) => {
		if (req.url.startsWith("/admin/")) requireAdmin(req);
	});

	app.get("/admin/providers", async () => providers.map((p) => ({ type: p.type, urlPrefix: `${p.urlPrefix}Instance` })));

	app.get("/admin/instances", async () => listInstances().map((i) => describe(i.id, manager)));

	app.post<{ Body: { type?: InstanceType; name?: string } }>("/admin/instances", async (req, reply) => {
		const type = req.body?.type ?? "whatsapp";
		if (!providerByType(type)) throw new ApiError(400, `Unsupported provider: ${type}`);
		const record = createInstance(type, req.body?.name?.slice(0, 80));
		manager.get(record.id);
		return reply.status(201).send(describe(record.id, manager));
	});

	app.get<{ Params: { id: string } }>("/admin/instances/:id", async (req) => {
		const id = Number(req.params.id);
		if (!getInstance(id)) throw new ApiError(404, "Instance not found");
		return describe(id, manager);
	});

	app.delete<{ Params: { id: string } }>("/admin/instances/:id", async (req) => {
		const id = Number(req.params.id);
		if (!getInstance(id)) throw new ApiError(404, "Instance not found");
		await manager.remove(id);
		return { deleted: true };
	});
}
