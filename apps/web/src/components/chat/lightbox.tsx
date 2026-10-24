"use client";

import { Download, X } from "lucide-react";
import { useEffect } from "react";
import { timeOfDay } from "./format";
import type { Message } from "./types";

export function Lightbox({ message, title, onClose }: { message: Message; title: string; onClose: () => void }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const src = message.downloadUrl || (message.jpegThumbnail ? `data:image/jpeg;base64,${message.jpegThumbnail}` : "");

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-[#e9edef]/95 dark:bg-[#0b141a]/95" role="dialog" aria-modal>
			<header className="flex h-[59px] shrink-0 items-center justify-between px-4 text-wa-text">
				<div>
					<div className="text-[15px]">{title}</div>
					<div className="text-xs text-wa-muted">{timeOfDay(message.timestamp)}</div>
				</div>
				<div className="flex items-center gap-2 text-wa-icon">
					{message.downloadUrl && (
						<a href={message.downloadUrl} download className="grid size-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Download">
							<Download className="size-5" />
						</a>
					)}
					<button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer grid size-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10">
						<X className="size-6" />
					</button>
				</div>
			</header>
			<button type="button" aria-label="Close" onClick={onClose} className="grid min-h-0 flex-1 cursor-default place-items-center p-6">
				{message.typeMessage === "videoMessage" ? (
					<video src={message.downloadUrl} controls autoPlay className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
				) : (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={src} alt={message.caption || ""} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
				)}
			</button>
			{message.caption && <p className="shrink-0 px-6 pb-6 text-center text-[15px] text-wa-text">{message.caption}</p>}
		</div>
	);
}
