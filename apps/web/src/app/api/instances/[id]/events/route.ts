import { handle, HttpError, requireOwnedInstance, rewriteMediaUrls } from "@/lib/api";
import { instanceUrl } from "@/lib/gateway";
import { credentials } from "@/lib/instances";

// Live SSE feed: relays the gateway's /events stream for an owned instance,
// rewriting media URLs event by event.

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: Request, { params }: Ctx) => {
	const { instance } = await requireOwnedInstance(request, (await params).id);

	const upstream = await fetch(instanceUrl(credentials(instance), "events"), {
		cache: "no-store",
		signal: request.signal,
		headers: { accept: "text/event-stream" },
	}).catch(() => {
		throw new HttpError(502, "Gateway is not reachable");
	});
	if (!upstream.ok || !upstream.body) throw new HttpError(upstream.status || 502, "Event stream unavailable");

	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = "";
	const relay = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			buffer += decoder.decode(chunk, { stream: true });
			// Forward only complete SSE frames so a URL is never split across chunks.
			let end: number;
			while ((end = buffer.indexOf("\n\n")) !== -1) {
				const frame = buffer.slice(0, end + 2);
				buffer = buffer.slice(end + 2);
				controller.enqueue(encoder.encode(rewriteMediaUrls(frame, instance)));
			}
		},
	});

	return new Response(upstream.body.pipeThrough(relay), {
		headers: {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
			"x-accel-buffering": "no",
		},
	});
});
