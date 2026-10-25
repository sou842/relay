import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// Outbound requests to user-supplied URLs (sendFileByUrl, webhooks) must never
// reach the gateway's own network: loopback, private ranges, link-local (cloud
// metadata at 169.254.169.254), CGNAT, multicast. The address is checked inside
// the socket's DNS lookup, so the IP that is checked is the IP that is dialled
// (no DNS-rebinding window). Set GATEWAY_ALLOW_PRIVATE_URLS=1 for local testing.

const allowPrivate = process.env.GATEWAY_ALLOW_PRIVATE_URLS === "1";

const blocked = new net.BlockList();
for (const [addr, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 3],
] as const) {
	blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
	["::", 128],
	["::1", 128],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
] as const) {
	blocked.addSubnet(addr, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
	if (allowPrivate) return true;
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
	if (mapped) return isPublicAddress(mapped[1]);
	const family = net.isIPv4(address) ? "ipv4" : net.isIPv6(address) ? "ipv6" : null;
	return family !== null && !blocked.check(address, family);
}

export class UnsafeUrlError extends Error {}

/** Throws unless the URL is http(s) without credentials. Address checks happen at connect time. */
export function assertHttpUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new UnsafeUrlError("Invalid URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http(s) URLs are allowed");
	if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed");
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (net.isIP(host) && !isPublicAddress(host)) throw new UnsafeUrlError("URL points to a private address");
	return url;
}

const safeLookup: net.LookupFunction = (hostname, options, callback) => {
	dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) return callback(err, "", 0);
		const list = addresses as dns.LookupAddress[];
		const bad = list.find((a) => !isPublicAddress(a.address));
		if (bad || list.length === 0) return callback(new UnsafeUrlError("URL resolves to a private address"), "", 0);
		if ((options as dns.LookupOptions).all) return (callback as any)(null, list);
		callback(null, list[0].address, list[0].family);
	});
};

export interface SafeRequest {
	method?: "GET" | "POST";
	headers?: Record<string, string>;
	body?: string;
	timeoutMs?: number;
	maxBytes?: number;
	maxRedirects?: number;
}

export interface SafeResponse {
	status: number;
	headers: http.IncomingHttpHeaders;
	body: Buffer;
}

/** Requests a user-supplied URL with private-address blocking, a size cap and re-checked redirects. */
export async function safeRequest(raw: string, opts: SafeRequest = {}): Promise<SafeResponse> {
	const { method = "GET", timeoutMs = 15000, maxBytes = 64 * 1024 * 1024, maxRedirects = 3 } = opts;
	let url = assertHttpUrl(raw);
	for (let hop = 0; ; hop++) {
		const res = await once(url, method, opts.headers, opts.body, timeoutMs, maxBytes);
		const location = res.headers.location;
		if (res.status >= 300 && res.status < 400 && location && method === "GET") {
			if (hop >= maxRedirects) throw new UnsafeUrlError("Too many redirects");
			url = assertHttpUrl(new URL(location, url).toString());
			continue;
		}
		return res;
	}
}

function once(url: URL, method: string, headers: Record<string, string> | undefined, body: string | undefined, timeoutMs: number, maxBytes: number): Promise<SafeResponse> {
	const client = url.protocol === "https:" ? https : http;
	return new Promise((resolve, reject) => {
		const req = client.request(url, { method, headers, lookup: safeLookup, timeout: timeoutMs }, (res) => {
			const declared = Number(res.headers["content-length"] ?? 0);
			if (declared > maxBytes) {
				res.destroy();
				return reject(new UnsafeUrlError("Response too large"));
			}
			const chunks: Buffer[] = [];
			let size = 0;
			res.on("data", (chunk: Buffer) => {
				size += chunk.length;
				if (size > maxBytes) {
					res.destroy();
					reject(new UnsafeUrlError("Response too large"));
					return;
				}
				chunks.push(chunk);
			});
			res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
			res.on("error", reject);
		});
		req.on("timeout", () => req.destroy(new Error("Request timed out")));
		req.on("error", reject);
		if (body) req.write(body);
		req.end();
	});
}
