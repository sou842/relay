import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config.ts";
import type { InstanceManager } from "../manager.ts";
import { providerByType, providers } from "../providers/index.ts";
import { createInstance, findInstance, getInstance, listInstances, type InstanceType } from "../store/instances.ts";
import { ApiError } from "./errors.ts";

// Management API for the web app: create / list / delete instances.
// Authenticated with GATEWAY_ADMIN_KEY; disabled entirely when the key is unset.

const digest = (value: string) => crypto.createHash("sha256").update(value).digest();

function requireAdmin(req: FastifyRequest) {
	if (!config.adminKey) throw new ApiError(403, "Admin API disabled: set GATEWAY_ADMIN_KEY");
	// Hashing first keeps the comparison constant-time without leaking the key's length.
	const given = digest(req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "");
	if (!crypto.timingSafeEqual(given, digest(config.adminKey))) throw new ApiError(401, "Unauthorized");
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

// Registered as an encapsulated plugin so the hook guards every matched admin route.
// (Matching on req.url was bypassable with percent-encoding, e.g. /%61dmin/instances.)
export async function registerAdminRoutes(app: FastifyInstance, manager: InstanceManager) {
	await app.register(
		async (admin) => {
			admin.addHook("onRequest", async (req) => requireAdmin(req));
			adminRoutes(admin, manager);
		},
		{ prefix: "/admin" },
	);
}

function adminRoutes(app: FastifyInstance, manager: InstanceManager) {
	app.get("/providers", async () => providers.map((p) => ({ type: p.type, urlPrefix: `${p.urlPrefix}Instance` })));

	app.get("/instances", async () => listInstances().map((i) => describe(i.id, manager)));

	app.post<{ Body: { type?: InstanceType; name?: string } }>("/instances", async (req, reply) => {
		const type = req.body?.type ?? "whatsapp";
		if (!providerByType(type)) throw new ApiError(400, `Unsupported provider: ${type}`);
		const record = await createInstance(type, req.body?.name?.slice(0, 80));
		manager.get(record.id);
		return reply.status(201).send(describe(record.id, manager));
	});

	app.get<{ Params: { id: string } }>("/instances/:id", async (req) => {
		const id = Number(req.params.id);
		if (!(await findInstance(id))) throw new ApiError(404, "Instance not found");
		return describe(id, manager);
	});

	app.delete<{ Params: { id: string } }>("/instances/:id", async (req) => {
		const id = Number(req.params.id);
		if (!(await findInstance(id))) throw new ApiError(404, "Instance not found");
		await manager.remove(id);
		return { deleted: true };
	});
}
