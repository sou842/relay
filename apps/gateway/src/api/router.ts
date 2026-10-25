import fs from "node:fs";
import path from "node:path";
import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.ts";
import { subscribe } from "../events.ts";
import type { InstanceManager } from "../manager.ts";
import { isInlineMime, mimeFromFileName, openMediaFile } from "../media.ts";
import { findMethod, providerByPrefix } from "../providers/index.ts";
import type { UploadedFile } from "../providers/types.ts";
import { findInstance, tokenMatches, type InstanceRecord } from "../store/instances.ts";
import { registerAdminRoutes } from "./admin.ts";
import { ApiError } from "./errors.ts";

// GREEN-API URL scheme: /{waInstance|tgInstance}{id}/{method}/{token}[/{extra}]
// Method names are matched case-insensitively (v1 SDK sends "ForwardMessages").
// Extension: GET /{prefix}Instance{id}/events/{token} is a live SSE feed.

const publicDir = path.resolve(import.meta.dirname, "../../public");
const uiFiles: Record<string, string> = {
	"": "text/html; charset=utf-8",
	"app.js": "text/javascript; charset=utf-8",
	"style.css": "text/css; charset=utf-8",
};

type Params = { instancePath: string; method: string; token: string; extra?: string };

async function readMultipart(req: FastifyRequest): Promise<{ body: Record<string, unknown>; file?: UploadedFile }> {
	const body: Record<string, unknown> = {};
	let file: UploadedFile | undefined;
	for await (const part of req.parts()) {
		if (part.type === "file") {
			if (!file) file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
			else await part.toBuffer();
		} else {
			body[part.fieldname] = part.value;
		}
	}
	return { body, file };
}

async function authenticate(instancePath: string, token: string) {
	const match = /^([a-z]+)Instance(\d+)$/.exec(instancePath);
	const provider = match && providerByPrefix(match[1]);
	if (!match || !provider) throw new ApiError(404, "Not found");
	const instance = await findInstance(Number(match[2]));
	if (!instance || instance.type !== provider.type || !tokenMatches(instance, token)) throw new ApiError(401, "Unauthorized");
	return { provider, instance };
}

function streamEvents(req: FastifyRequest, reply: FastifyReply, instance: InstanceRecord, state: string) {
	reply.hijack();
	const res = reply.raw;
	res.writeHead(200, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
	});
	const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
	send({ type: "state", stateInstance: state });
	const unsubscribe = subscribe(instance.id, send);
	const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
	req.raw.on("close", () => {
		clearInterval(heartbeat);
		unsubscribe();
	});
}

export async function registerRoutes(app: FastifyInstance, manager: InstanceManager) {
	await app.register(multipart, { limits: { fileSize: 64 * 1024 * 1024, files: 1 } });
	await registerAdminRoutes(app, manager);

	const handle = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
		const { instancePath, method, token, extra } = req.params;
		const { provider, instance } = await authenticate(instancePath, token);
		const worker = manager.get(instance.id)!;

		if (method.toLowerCase() === "events" && req.method === "GET") return streamEvents(req, reply, instance, worker.state);

		const def = findMethod(provider, method);
		if (!def) throw new ApiError(404, `Unknown method ${method}`);
		if (def.verb !== req.method) throw new ApiError(405, `${method} expects ${def.verb}`);

		let body = (req.body as Record<string, unknown>) ?? {};
		let file: UploadedFile | undefined;
		if (req.isMultipart()) ({ body, file } = await readMultipart(req));
		const gaFilename = req.headers["ga-filename"];
		if (typeof gaFilename === "string") body = { ...body, "GA-Filename": gaFilename };

		const abort = new AbortController();
		req.raw.on("close", () => abort.abort());

		try {
			const result = await def.handler({
				instance,
				worker,
				baseUrl: config.publicUrl || `${req.protocol}://${req.host}`,
				body,
				file,
				query: req.query as Record<string, string | undefined>,
				extra,
				signal: abort.signal,
			});
			// receiveNotification answers a literal JSON null when nothing arrived in time.
			if (result === null) return reply.type("application/json").send("null");
			return result ?? {};
		} catch (err) {
			if (err instanceof ApiError) throw err;
			// Provider errors (not authorized, unknown message, WhatsApp rejections) are client-visible 400s.
			throw new ApiError(400, (err as Error).message);
		}
	};

	app.route({ method: ["GET", "POST", "DELETE"], url: "/:instancePath/:method/:token", handler: handle });
	app.route({ method: ["GET", "POST", "DELETE"], url: "/:instancePath/:method/:token/:extra", handler: handle });

	app.get<{ Params: { id: string; file: string } }>("/media/:id/:file", async (req, reply) => {
		const file = await openMediaFile(Number(req.params.id), req.params.file);
		if (!file) throw new ApiError(404, "Not found");
		// Files come from strangers (incoming documents): never let a browser run them on this origin.
		const type = mimeFromFileName(req.params.file);
		return reply
			.type(type)
			.header("X-Content-Type-Options", "nosniff")
			.header("Content-Security-Policy", "default-src 'none'; sandbox")
			.header("Content-Disposition", isInlineMime(type) ? "inline" : "attachment")
			.header("Cache-Control", "private, max-age=86400")
			.header("Content-Length", String(file.length))
			.send(file.stream);
	});

	// Debug console: static files from apps/gateway/public.
	app.get("/", (_req, reply) => reply.redirect("/ui/"));
	app.get("/ui", (_req, reply) => reply.redirect("/ui/"));
	app.get<{ Params: { "*": string } }>("/ui/*", async (req, reply) => {
		const name = req.params["*"];
		const type = uiFiles[name];
		if (type === undefined) throw new ApiError(404, "Not found");
		const file = path.join(publicDir, name || "index.html");
		return reply
			.type(type)
			.header("Cache-Control", "no-cache")
			.header("X-Content-Type-Options", "nosniff")
			.header("X-Frame-Options", "DENY")
			.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
			.send(fs.createReadStream(file));
	});

	app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
		const status = err instanceof ApiError ? err.statusCode : (err.statusCode ?? 500);
		if (status >= 500) {
			// Internal details (SQLite, file paths) stay in the log.
			req.log.error(err);
			return reply.status(status).send({ message: "Internal server error" });
		}
		reply.status(status).send({ message: err.message });
	});
}
