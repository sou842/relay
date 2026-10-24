"use client";

import { User, Users } from "lucide-react";
import { useState } from "react";
import { useMethod } from "@/lib/swr";
import { cn } from "@/lib/utils";
import { isGroup } from "./format";

// Profile pictures rarely change: SWR fetches each one once per page load and shares it between every avatar of that chat.
const AVATAR_SWR = { revalidateIfStale: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const;

export function Avatar({ instanceId, chatId, size = 49, className }: { instanceId: string; chatId: string; size?: number; className?: string }) {
	const { data } = useMethod<{ urlAvatar: string }>(instanceId, "getAvatar", { chatId }, AVATAR_SWR);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const url = data?.urlAvatar ?? "";
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
