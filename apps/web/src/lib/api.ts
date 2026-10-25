import "server-only";
import { auth, type Session } from "./auth";
import { GatewayError } from "./gateway";
import { getOwnedInstance, type InstanceDoc } from "./instances";

// Helpers for route handlers. Every handler re-checks the session itself;
// proxy.ts only does an optimistic cookie check for page navigations.

export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

/**
 * Rejects requests a browser marks as coming from another site (CSRF, and
 * top-level links to state-changing GETs like .../call/logout). Non-browser
 * clients send no Sec-Fetch-Site header and still need a session cookie.
 */
function requireSameSite(request: Request) {
	const site = request.headers.get("sec-fetch-site");
	if (site && site !== "same-origin" && site !== "none") throw new HttpError(403, "Cross-site request blocked");
}

export async function requireApiSession(request: Request): Promise<Session> {
	requireSameSite(request);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw new HttpError(401, "Sign in required");
	return session;
}

export async function requireOwnedInstance(request: Request, id: string): Promise<{ session: Session; instance: InstanceDoc }> {
	const session = await requireApiSession(request);
	const instance = await getOwnedInstance(session.user.id, id);
	if (!instance) throw new HttpError(404, "Instance not found");
	return { session, instance };
}

export function errorResponse(err: unknown): Response {
	if (err instanceof HttpError || err instanceof GatewayError) {
		return Response.json({ message: err.message }, { status: err.status });
	}
	console.error(err);
	return Response.json({ message: "Internal error" }, { status: 500 });
}

/** Wraps a handler so thrown HttpError/GatewayError become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
	return async (...args: A): Promise<Response> => {
		try {
			return await fn(...args);
		} catch (err) {
			return errorResponse(err);
		}
	};
}

/** Gateway media URLs (any host) -> same-origin proxy path for this instance. */
export function rewriteMediaUrls(text: string, instance: InstanceDoc): string {
	const pattern = new RegExp(`https?://[^"\\s]+?/media/${instance.gatewayId}/`, "g");
	return text.replace(pattern, `/api/instances/${instance._id.toHexString()}/media/`);
}
