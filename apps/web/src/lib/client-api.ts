"use client";

// Browser-side helpers. Everything goes through same-origin /api routes,
// which check the session and ownership before reaching the gateway.

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function parse<T>(res: Response): Promise<T> {
	const text = await res.text();
	const data = text ? JSON.parse(text) : null;
	if (!res.ok) throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`);
	return data as T;
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
	const res = await fetch(path, {
		method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
		headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
		body: init?.body === undefined ? undefined : JSON.stringify(init.body),
		cache: "no-store",
	});
	return parse<T>(res);
}

export interface CallOptions {
	verb?: "GET" | "POST" | "DELETE";
	body?: unknown;
	form?: FormData;
	query?: Record<string, string>;
	extra?: string;
}

/** Calls a gateway method (GREEN-API name) on one of the user's instances. */
export async function callMethod<T = unknown>(instanceId: string, method: string, opts: CallOptions = {}): Promise<T> {
	const qs = new URLSearchParams(opts.query);
	if (opts.extra) qs.set("_extra", opts.extra);
	const url = `/api/instances/${instanceId}/call/${method}${qs.size ? `?${qs}` : ""}`;
	const verb = opts.verb ?? (opts.body !== undefined || opts.form ? "POST" : "GET");
	const res = await fetch(url, {
		method: verb,
		headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
		body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
		cache: "no-store",
	});
	return parse<T>(res);
}
