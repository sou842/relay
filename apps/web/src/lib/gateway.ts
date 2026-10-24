import "server-only";
import { providerInfo } from "./providers";

// Server-side client for the gateway. Instance tokens and the admin key never
// leave the server; the browser talks to /api/instances/... which checks
// ownership and then calls through here.

const GATEWAY_URL = (process.env.GATEWAY_URL ?? "http://127.0.0.1:7700").replace(/\/$/, "");
const ADMIN_KEY = process.env.GATEWAY_ADMIN_KEY ?? "";

export class GatewayError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function parse(res: Response) {
	const text = await res.text();
	const data = text ? JSON.parse(text) : null;
	if (!res.ok) throw new GatewayError(res.status, data?.message ?? `Gateway responded ${res.status}`);
	return data;
}

export interface GatewayInstance {
	idInstance: number;
	apiTokenInstance: string;
	type: string;
	urlPrefix: string;
	name: string | null;
	stateInstance: string;
	wid: string;
	createdAt: number;
}

async function admin<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${GATEWAY_URL}/admin${path}`, {
		...init,
		headers: { Authorization: `Bearer ${ADMIN_KEY}`, "Content-Type": "application/json", ...init?.headers },
		cache: "no-store",
	}).catch(() => {
		throw new GatewayError(502, "Gateway is not reachable. Is it running? (npm run gateway)");
	});
	return parse(res);
}

export const gatewayAdmin = {
	create: (type: string, name: string) => admin<GatewayInstance>("/instances", { method: "POST", body: JSON.stringify({ type, name }) }),
	get: (id: number) => admin<GatewayInstance>(`/instances/${id}`),
	remove: (id: number) => admin<{ deleted: boolean }>(`/instances/${id}`, { method: "DELETE" }),
};

export interface InstanceCredentials {
	provider: string;
	gatewayId: number;
	token: string;
}

export function instanceUrl(cred: InstanceCredentials, method: string, extra?: string, search?: string): string {
	const prefix = providerInfo(cred.provider).urlPrefix;
	return `${GATEWAY_URL}/${prefix}${cred.gatewayId}/${encodeURIComponent(method)}/${cred.token}${extra ? `/${encodeURIComponent(extra)}` : ""}${search ?? ""}`;
}

/** Calls one GREEN-API-style method and returns parsed JSON. */
export async function callInstance<T = unknown>(
	cred: InstanceCredentials,
	method: string,
	init: { verb?: "GET" | "POST" | "DELETE"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
	const search = init.query ? `?${new URLSearchParams(init.query)}` : "";
	const res = await fetch(instanceUrl(cred, method, undefined, search), {
		method: init.verb ?? (init.body === undefined ? "GET" : "POST"),
		headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		cache: "no-store",
	}).catch(() => {
		throw new GatewayError(502, "Gateway is not reachable");
	});
	return parse(res);
}

export const gatewayPublicUrl = GATEWAY_URL;

export type GatewayStatus = "online" | "bad-key" | "offline";

/** Reachability check for the Settings page: asks for an instance that can't exist and reads the status code. */
export async function gatewayStatus(): Promise<GatewayStatus> {
	try {
		const res = await fetch(`${GATEWAY_URL}/admin/instances/0`, {
			headers: { Authorization: `Bearer ${ADMIN_KEY}` },
			cache: "no-store",
			signal: AbortSignal.timeout(2500),
		});
		return res.status === 401 || res.status === 403 ? "bad-key" : "online";
	} catch {
		return "offline";
	}
}
