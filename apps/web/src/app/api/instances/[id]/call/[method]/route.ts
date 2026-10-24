import { handle, HttpError, requireOwnedInstance, rewriteMediaUrls } from "@/lib/api";
import { instanceUrl } from "@/lib/gateway";
import { credentials } from "@/lib/instances";

// Browser -> gateway method proxy. The session must own the instance; the
// token is added here and never reaches the browser. JSON and multipart bodies
// are streamed through unchanged.

type Ctx = { params: Promise<{ id: string; method: string }> };

// Token rotation goes through /credentials so the stored token stays in sync;
// the live feed has its own route.
const BLOCKED = new Set(["updateapitoken", "events"]);

async function proxy(request: Request, { params }: Ctx): Promise<Response> {
	const { id, method } = await params;
	if (!/^[A-Za-z]+$/.test(method) || BLOCKED.has(method.toLowerCase())) throw new HttpError(404, "Unknown method");
	const { instance } = await requireOwnedInstance(request, id);

	const url = new URL(request.url);
	const extra = url.searchParams.get("_extra") ?? undefined;
	url.searchParams.delete("_extra");
	const search = url.searchParams.size ? `?${url.searchParams}` : "";

	const hasBody = request.method !== "GET" && request.method !== "DELETE";
	const contentType = request.headers.get("content-type");
	const upstream = await fetch(instanceUrl(credentials(instance), method, extra, search), {
		method: request.method,
		headers: contentType ? { "content-type": contentType } : undefined,
		body: hasBody ? request.body : undefined,
		// Required by Node's fetch when streaming a request body.
		...(hasBody ? { duplex: "half" } : {}),
		cache: "no-store",
	} as RequestInit).catch(() => {
		throw new HttpError(502, "Gateway is not reachable");
	});

	const text = await upstream.text();
	return new Response(rewriteMediaUrls(text, instance), {
		status: upstream.status,
		headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
	});
}

export const GET = handle(proxy);
export const POST = handle(proxy);
export const DELETE = handle(proxy);
