"use client";

import { User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { callMethod } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { isGroup } from "./format";

// Profile pictures are fetched lazily, deduplicated and cached per page load.
const cache = new Map<string, Promise<string>>();

function loadAvatar(instanceId: string, chatId: string): Promise<string> {
	const key = `${instanceId}:${chatId}`;
	let hit = cache.get(key);
	if (!hit) {
		hit = callMethod<{ urlAvatar: string }>(instanceId, "getAvatar", { body: { chatId } })
			.then((r) => r.urlAvatar || "")
			.catch(() => "");
		cache.set(key, hit);
	}
	return hit;
}

export function Avatar({ instanceId, chatId, size = 49, className }: { instanceId: string; chatId: string; size?: number; className?: string }) {
	const [loaded, setLoaded] = useState<{ chatId: string; url: string } | null>(null);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;
		loadAvatar(instanceId, chatId).then((url) => alive && setLoaded({ chatId, url }));
		return () => {
			alive = false;
		};
	}, [instanceId, chatId]);

	// Ignore a stale result from the previous chatId while the new one loads.
	const url = loaded?.chatId === chatId ? loaded.url : "";
	const style = { width: size, height: size };
	if (url && url !== failedUrl) {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={url} alt="" style={style} onError={() => setFailedUrl(url)} className={cn("shrink-0 rounded-full object-cover", className)} />;
	}
	const Icon = isGroup(chatId) ? Users : User;
	return (
		<div style={style} className={cn("grid shrink-0 place-items-center rounded-full bg-[#dfe5e7] text-white dark:bg-[#6a7175]", className)}>
			<Icon style={{ width: size * 0.55, height: size * 0.55 }} className="text-white/95" strokeWidth={1.8} />
		</div>
	);
}
