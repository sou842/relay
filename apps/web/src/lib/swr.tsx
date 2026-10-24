"use client";

import useSWR, { SWRConfig, type SWRConfiguration } from "swr";
import { api, callMethod } from "./client-api";

// Data fetching for the browser. Reads go through SWR so identical requests are
// deduplicated and cached across components; writes still use api()/callMethod()
// and then revalidate (or patch) the matching SWR key.
//
// Keys:
//   "/api/…"                              -> GET through api()
//   ["method", instanceId, method, body?]  -> gateway method through callMethod()

export type MethodKey = readonly ["method", string, string, unknown?];

export function methodKey(instanceId: string, method: string, body?: unknown): MethodKey {
	return body === undefined ? ["method", instanceId, method] : ["method", instanceId, method, body];
}

function fetcher(key: string | MethodKey) {
	if (typeof key === "string") return api(key);
	const [, instanceId, method, body] = key;
	return callMethod(instanceId, method, body === undefined ? {} : { body });
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
	return (
		<SWRConfig
			value={{
				fetcher,
				// Live changes arrive over SSE; refetching on every tab focus would only add gateway load.
				revalidateOnFocus: false,
				dedupingInterval: 5000,
				errorRetryCount: 2,
				shouldRetryOnError: (err) => !(err?.status >= 400 && err?.status < 500),
			}}
		>
			{children}
		</SWRConfig>
	);
}

/** GET a same-origin /api route. Pass null to skip. */
export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
	return useSWR<T>(path, config);
}

/** Call a read-only gateway method on an instance. Pass a null instanceId to skip. */
export function useMethod<T>(instanceId: string | null, method: string, body?: unknown, config?: SWRConfiguration<T>) {
	return useSWR<T>(instanceId ? methodKey(instanceId, method, body) : null, config);
}
