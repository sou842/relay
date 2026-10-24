import { handle, HttpError, requireOwnedInstance } from "@/lib/api";
import { gatewayPublicUrl } from "@/lib/gateway";

// Same-origin access to an instance's media (received files and uploads).

type Ctx = { params: Promise<{ id: string; file: string }> };

export const GET = handle(async (request: Request, { params }: Ctx) => {
	const { id, file } = await params;
	if (!/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(file)) throw new HttpError(404, "Not found");
	const { instance } = await requireOwnedInstance(request, id);

	const upstream = await fetch(`${gatewayPublicUrl}/media/${instance.gatewayId}/${file}`, { cache: "no-store" }).catch(() => {
		throw new HttpError(502, "Gateway is not reachable");
	});
	if (!upstream.ok || !upstream.body) throw new HttpError(404, "Not found");

	return new Response(upstream.body, {
		headers: {
			"content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
			"cache-control": "private, max-age=86400",
		},
	});
});
