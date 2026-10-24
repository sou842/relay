"use client";

import { Ban, ChevronDown, Download, FileText, MapPin, Play, Smile, UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { quotedText, senderColor, timeOfDay } from "./format";
import { Ticks } from "./icons";
import type { Message } from "./types";

export type MessageAction = "reply" | "react" | "copy" | "forward" | "edit" | "delete" | "download" | "info";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EDIT_WINDOW_SECONDS = 15 * 60;

function linkify(text: string): React.ReactNode[] {
	const out: React.ReactNode[] = [];
	let last = 0;
	for (const m of text.matchAll(/https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/g)) {
		out.push(text.slice(last, m.index));
		out.push(
			<a key={m.index} href={m[0]} target="_blank" rel="noopener noreferrer" className="text-[#027eb5] hover:underline dark:text-[#53bdeb]">
				{m[0]}
			</a>,
		);
		last = m.index! + m[0].length;
	}
	out.push(text.slice(last));
	return out;
}

const emojiOnly = (text: string) => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\s){1,12}$/u.test(text) && /\p{Extended_Pictographic}/u.test(text);

export function MessageBubble({
	message: m,
	first,
	showSender,
	senderLabel,
	quotedLabel,
	reactionLabel,
	highlighted,
	onAction,
	onReact,
	onJump,
	onOpenMedia,
}: {
	message: Message;
	first: boolean;
	showSender: boolean;
	senderLabel: string;
	quotedLabel: (participant?: string) => string;
	reactionLabel: (senderId: string) => string;
	highlighted: boolean;
	onAction: (action: MessageAction, m: Message) => void;
	onReact: (m: Message, emoji: string) => void;
	onJump: (idMessage: string) => void;
	onOpenMedia: (m: Message) => void;
}) {
	const out = m.type === "outgoing";
	const [menu, setMenuState] = useState<"actions" | "react" | null>(null);
	// Captured when the menu opens, so rendering stays pure.
	const [openedAt, setOpenedAt] = useState(0);
	const setMenu = (next: "actions" | "react" | null) => {
		if (next) setOpenedAt(Date.now() / 1000);
		setMenuState(next);
	};
	const sticker = m.typeMessage === "stickerMessage" && !m.deleted;
	const visual = (m.typeMessage === "imageMessage" || m.typeMessage === "videoMessage") && !m.deleted;
	const bare = visual && !m.caption;
	const isText = m.typeMessage === "textMessage" || m.typeMessage === "extendedTextMessage" || m.typeMessage === "quotedMessage";
	const canEdit = out && !m.deleted && !m.local && isText && openedAt - m.timestamp < EDIT_WINDOW_SECONDS;

	const meta = (
		<span className={cn("ml-2 inline-flex translate-y-1 items-center gap-1 whitespace-nowrap align-bottom text-[11px]", bare || sticker ? "text-white" : "text-wa-muted")}>
			{m.edited && !m.deleted && <span>Edited</span>}
			{timeOfDay(m.timestamp)}
			{out && !m.deleted && <Ticks status={m.statusMessage} className={bare || sticker ? "text-white" : undefined} />}
		</span>
	);

	return (
		<div id={`msg-${m.idMessage}`} className={cn("group flex px-[4%] sm:px-[7%]", out ? "justify-end" : "justify-start", first ? "mt-3" : "mt-0.5")}>
			<div className={cn("relative flex max-w-[85%] flex-col sm:max-w-[65%]", out ? "items-end" : "items-start", m.reactions?.length && "mb-4")}>
				<div
					className={cn(
						"relative rounded-lg text-[14.2px] leading-[19px] text-wa-text shadow-[var(--wa-shadow)] transition-colors",
						sticker ? "bg-transparent shadow-none" : out ? "bg-wa-out" : "bg-wa-in",
						first && !sticker && (out ? "rounded-tr-none bubble-tail-out" : "rounded-tl-none bubble-tail-in"),
						visual ? "p-[3px]" : "px-[9px] pb-[8px] pt-[6px]",
						highlighted && "ring-2 ring-accent",
					)}
				>
					{/* hover menu trigger */}
					{!m.deleted && !m.local && (
						<button
							type="button"
							aria-label="Message menu"
							onClick={() => setMenu(menu ? null : "actions")}
							className={cn(
								"absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-full text-wa-icon opacity-0 transition group-hover:opacity-100 focus:opacity-100",
								out ? "bg-wa-out" : "bg-wa-in",
								bare && "bg-black/30 text-white",
							)}
						>
							<ChevronDown className="size-4" />
						</button>
					)}

					{showSender && !out && (
						<div className={cn("mb-0.5 text-[12.8px] font-medium", visual && "px-1.5 pt-1")} style={{ color: senderColor(m.senderId ?? "") }}>
							{senderLabel}
						</div>
					)}

					{m.isForwarded && !m.deleted && <div className="mb-0.5 text-[12.5px] italic text-wa-muted">↪ Forwarded</div>}

					{m.quotedMessage && !m.deleted && (
						<button
							type="button"
							onClick={() => onJump(m.quotedMessage!.stanzaId)}
							className={cn("mb-1 block w-full overflow-hidden rounded-md border-l-4 bg-wa-quote px-2 py-1 text-left", visual && "mx-0 mt-0")}
							style={{ borderColor: senderColor(m.quotedMessage.participant ?? "") }}
						>
							<div className="text-[12.8px] font-medium" style={{ color: senderColor(m.quotedMessage.participant ?? "") }}>
								{quotedLabel(m.quotedMessage.participant)}
							</div>
							<div className="line-clamp-2 text-[13px] text-wa-muted">{quotedText(m.quotedMessage)}</div>
						</button>
					)}

					<Content m={m} meta={meta} onOpenMedia={onOpenMedia} />
				</div>

				{m.reactions?.length ? (
					<button
						type="button"
						onClick={() => setMenu("react")}
						title={m.reactions.map((r) => `${r.reaction} ${reactionLabel(r.senderId)}`).join("\n")}
						className={cn("absolute -bottom-4 flex items-center gap-0.5 rounded-full bg-wa-in px-1.5 py-0.5 text-[13px] shadow ring-1 ring-black/5", out ? "right-2" : "left-2")}
					>
						{[...new Set(m.reactions.map((r) => r.reaction))].slice(0, 3).join("")}
						{m.reactions.length > 1 && <span className="ml-0.5 text-[11px] text-wa-muted">{m.reactions.length}</span>}
					</button>
				) : null}

				{/* quick react button beside the bubble, like WhatsApp Web */}
				{!m.deleted && !m.local && (
					<button
						type="button"
						aria-label="React"
						onClick={() => setMenu(menu === "react" ? null : "react")}
						className={cn(
							"absolute top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-black/5 text-wa-icon opacity-0 transition group-hover:opacity-100 dark:bg-white/10",
							out ? "-left-9" : "-right-9",
						)}
					>
						<Smile className="size-4" />
					</button>
				)}

				{menu && (
					<>
						<button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(null)} />
						{menu === "react" ? (
							<div className={cn("absolute z-40 flex gap-1 rounded-full bg-wa-list p-1.5 shadow-xl ring-1 ring-black/5", out ? "right-0" : "left-0", "-top-12")}>
								{QUICK_REACTIONS.map((e) => (
									<button
										key={e}
										type="button"
										className="grid size-9 place-items-center rounded-full text-xl transition hover:scale-125 hover:bg-wa-hover"
										onClick={() => {
											setMenu(null);
											onReact(m, e);
										}}
									>
										{e}
									</button>
								))}
							</div>
						) : (
							<div className={cn("absolute top-7 z-40 w-48 rounded-md bg-wa-list py-2 text-[14.5px] text-wa-text shadow-xl ring-1 ring-black/5", out ? "right-0" : "left-0")}>
								{(
									[
										["reply", "Reply", true],
										["react", "React", true],
										["copy", "Copy", Boolean(m.textMessage || m.caption)],
										["forward", "Forward", true],
										["download", "Download", Boolean(m.downloadUrl)],
										["edit", "Edit", canEdit],
										["delete", "Delete for everyone", out],
									] as [MessageAction, string, boolean][]
								)
									.filter(([, , show]) => show)
									.map(([action, label]) => (
										<button
											key={action}
											type="button"
											className={cn("block w-full px-6 py-2 text-left hover:bg-wa-hover", action === "delete" && "text-danger")}
											onClick={() => {
												if (action === "react") return setMenu("react");
												setMenu(null);
												onAction(action, m);
											}}
										>
											{label}
										</button>
									))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

function Content({ m, meta, onOpenMedia }: { m: Message; meta: React.ReactNode; onOpenMedia: (m: Message) => void }) {
	if (m.deleted) {
		return (
			<span className="flex items-center gap-1.5 italic text-wa-muted">
				<Ban className="size-4" /> {m.type === "outgoing" ? "You deleted this message" : "This message was deleted"}
				{meta}
			</span>
		);
	}

	const caption = m.caption ? (
		<div className="whitespace-pre-wrap break-words px-1.5 pb-1 pt-1.5">
			{linkify(m.caption)}
			{meta}
		</div>
	) : null;
	const thumb = m.jpegThumbnail ? `data:image/jpeg;base64,${m.jpegThumbnail}` : undefined;

	switch (m.typeMessage) {
		case "textMessage":
		case "extendedTextMessage":
		case "quotedMessage": {
			const text = m.textMessage ?? "";
			return (
				<div className={cn("whitespace-pre-wrap break-words", emojiOnly(text) && "text-4xl leading-tight")}>
					{linkify(text)}
					{meta}
				</div>
			);
		}
		case "imageMessage":
			return (
				<div className="w-[min(330px,70vw)]">
					<button type="button" onClick={() => onOpenMedia(m)} className="relative block w-full overflow-hidden rounded-md">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={m.downloadUrl || thumb} alt={m.caption || "Photo"} loading="lazy" className="max-h-[330px] w-full bg-black/10 object-cover" />
						{!m.caption && <span className="absolute bottom-0 right-0 rounded-tl-lg bg-gradient-to-t from-black/50 to-transparent px-2 pb-1 pt-4">{meta}</span>}
					</button>
					{caption}
				</div>
			);
		case "videoMessage":
			return (
				<div className="w-[min(330px,70vw)]">
					<button type="button" onClick={() => onOpenMedia(m)} className="relative grid w-full place-items-center overflow-hidden rounded-md bg-black">
						{thumb ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={thumb} alt="" className="max-h-[330px] w-full object-cover opacity-90" />
						) : (
							<div className="h-44 w-full" />
						)}
						<span className="absolute grid size-12 place-items-center rounded-full bg-black/50 text-white">
							<Play className="size-6 fill-current" />
						</span>
						{!m.caption && <span className="absolute bottom-0 right-0 px-2 pb-1">{meta}</span>}
					</button>
					{caption}
				</div>
			);
		case "stickerMessage":
			return (
				<div className="relative">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={m.downloadUrl || thumb} alt="Sticker" className="size-[150px] object-contain" />
					<span className="absolute bottom-0 right-0 rounded-full bg-black/35 px-1.5">{meta}</span>
				</div>
			);
		case "audioMessage":
			return (
				<div className="flex min-w-[240px] items-center gap-2">
					{m.downloadUrl ? <audio src={m.downloadUrl} controls preload="none" className="h-10 w-[240px] max-w-full" /> : <span className="italic text-wa-muted">Audio unavailable</span>}
					{meta}
				</div>
			);
		case "documentMessage":
			return (
				<div className="min-w-[240px] max-w-[330px]">
					<a
						href={m.downloadUrl || undefined}
						download={m.fileName}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-3 rounded-md bg-wa-quote p-3 hover:opacity-90"
					>
						<FileText className="size-8 shrink-0 text-[#7f66ff]" strokeWidth={1.5} />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm">{m.fileName || "Document"}</span>
							<span className="block text-xs uppercase text-wa-muted">{(m.fileName?.split(".").pop() ?? m.mimeType?.split("/").pop() ?? "file").slice(0, 8)}</span>
						</span>
						<Download className="size-5 shrink-0 text-wa-icon" />
					</a>
					{m.caption ? <div className="whitespace-pre-wrap break-words pt-1.5">{linkify(m.caption)}{meta}</div> : <div className="text-right">{meta}</div>}
				</div>
			);
		case "locationMessage": {
			const d = m.locationMessageData;
			const href = d ? `https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=16/${d.latitude}/${d.longitude}` : undefined;
			return (
				<div className="w-[min(280px,70vw)]">
					<a href={href} target="_blank" rel="noopener noreferrer" className="grid h-36 place-items-center rounded-md bg-[linear-gradient(135deg,#cfe8d5,#b8d8f0)] text-[#d93025] dark:bg-[linear-gradient(135deg,#1f3b33,#1d3346)]">
						<MapPin className="size-10 fill-current" />
					</a>
					<div className="px-1 pt-1.5">
						<div className="font-medium">{d?.nameLocation || "Location"}</div>
						{d?.address && <div className="text-[13px] text-wa-muted">{d.address}</div>}
						<div className="text-right">{meta}</div>
					</div>
				</div>
			);
		}
		case "contactMessage":
		case "contactsArrayMessage": {
			const names = m.typeMessage === "contactMessage" ? [m.contactMessageData?.displayName ?? "Contact"] : (m.messageData?.contacts ?? []).map((c) => c.displayName);
			return (
				<div className="min-w-[240px]">
					<div className="flex items-center gap-3 border-b border-black/10 pb-2 dark:border-white/10">
						<span className="grid size-10 place-items-center rounded-full bg-[#dfe5e7] dark:bg-[#6a7175]">
							<UserRound className="size-6 text-white" />
						</span>
						<span className="font-medium">{names.join(", ")}</span>
					</div>
					<div className="text-right">{meta}</div>
				</div>
			);
		}
		case "pollMessage": {
			const p = m.pollMessageData;
			return (
				<div className="min-w-[260px]">
					<div className="font-medium">{p?.name}</div>
					<div className="mb-2 text-xs text-wa-muted">{p?.multipleAnswers ? "Select one or more" : "Select one"}</div>
					{p?.options.map((o) => (
						<div key={o.optionName} className="mt-1.5 flex items-center gap-2">
							<span className="size-4 shrink-0 rounded-full border-2 border-wa-muted" />
							<span>{o.optionName}</span>
						</div>
					))}
					<div className="text-right">{meta}</div>
				</div>
			);
		}
		default:
			return (
				<span className="italic text-wa-muted">
					Unsupported message ({m.typeMessage}){meta}
				</span>
			);
	}
}
