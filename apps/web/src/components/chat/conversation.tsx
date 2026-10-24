"use client";

import { ArrowLeft, ChevronDown, Info, Loader2, Lock } from "lucide-react";
import { Fragment, useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { IconButton } from "./chat-list";
import { Composer, type ComposerActions } from "./composer";
import { dayLabel, isGroup, lastSeenLabel } from "./format";
import { MessageBubble, type MessageAction } from "./message-bubble";
import type { Message, Presence } from "./types";

export function Conversation({
	instanceId,
	chatId,
	title,
	selfId,
	messages,
	loading,
	hasMore,
	presence,
	nameFor,
	onLoadOlder,
	onBack,
	onToggleInfo,
	infoOpen,
	onAction,
	onReact,
	onOpenMedia,
	actions,
	replyTo,
	editing,
	setReplyTo,
	setEditing,
}: {
	instanceId: string;
	chatId: string;
	title: string;
	selfId: string;
	messages: Message[];
	loading: boolean;
	hasMore: boolean;
	presence: Presence | undefined;
	nameFor: (id: string) => string;
	onLoadOlder: () => Promise<void>;
	onBack: () => void;
	onToggleInfo: () => void;
	infoOpen: boolean;
	onAction: (action: MessageAction, m: Message) => void;
	onReact: (m: Message, emoji: string) => void;
	onOpenMedia: (m: Message) => void;
	actions: ComposerActions;
	replyTo: Message | null;
	editing: Message | null;
	setReplyTo: (m: Message | null) => void;
	setEditing: (m: Message | null) => void;
}) {
	const scroller = useRef<HTMLDivElement>(null);
	const [atBottom, setAtBottom] = useState(true);
	const [newBelow, setNewBelow] = useState(0);
	const [highlight, setHighlight] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const [dropped, setDropped] = useState<File | null>(null);
	const loadingOlder = useRef(false);
	const prevHeight = useRef<number | null>(null);
	const lastId = useRef<string | undefined>(undefined);

	const group = isGroup(chatId);
	const status = presenceLine(presence, group, nameFor);

	// The parent remounts this component per chat (key={chatId}), so a fresh
	// mount starts at the bottom via the lastId === undefined branch below.

	// Keep position when older messages are prepended; follow new ones when at the bottom.
	useLayoutEffect(() => {
		const el = scroller.current;
		if (!el) return;
		if (prevHeight.current !== null) {
			el.scrollTop += el.scrollHeight - prevHeight.current;
			prevHeight.current = null;
			return;
		}
		const newest = messages.at(-1);
		if (newest && newest.idMessage !== lastId.current) {
			const mine = newest.type === "outgoing";
			if (atBottom || mine || lastId.current === undefined) el.scrollTop = el.scrollHeight;
			else setNewBelow((n) => n + 1);
		}
		lastId.current = newest?.idMessage;
	}, [messages, atBottom]);

	const onScroll = useCallback(async () => {
		const el = scroller.current;
		if (!el) return;
		const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
		setAtBottom(bottom);
		if (bottom) setNewBelow(0);
		if (el.scrollTop < 120 && hasMore && !loadingOlder.current) {
			loadingOlder.current = true;
			prevHeight.current = el.scrollHeight;
			await onLoadOlder().finally(() => {
				loadingOlder.current = false;
			});
		}
	}, [hasMore, onLoadOlder]);

	const jumpTo = (idMessage: string) => {
		const node = document.getElementById(`msg-${idMessage}`);
		if (!node) return;
		node.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlight(idMessage);
		setTimeout(() => setHighlight(null), 1600);
	};

	const quotedLabel = (participant?: string) => (!participant || participant === selfId ? (participant ? "You" : title) : nameFor(participant));

	return (
		<section
			className="relative flex h-full min-h-0 flex-col"
			onDragOver={(e) => {
				if (e.dataTransfer.types.includes("Files")) {
					e.preventDefault();
					setDragging(true);
				}
			}}
			onDragLeave={(e) => {
				if (e.currentTarget === e.target) setDragging(false);
			}}
			onDrop={(e) => {
				e.preventDefault();
				setDragging(false);
				const file = e.dataTransfer.files[0];
				if (file) setDropped(file);
			}}
		>
			<header className="flex h-[59px] shrink-0 items-center gap-3 border-l border-wa-line bg-wa-panel px-4">
				<button type="button" onClick={onBack} aria-label="Back" className="cursor-pointer text-wa-icon md:hidden">
					<ArrowLeft className="size-5" />
				</button>
				<button type="button" onClick={onToggleInfo} className="cursor-pointer flex min-w-0 flex-1 items-center gap-3 text-left">
					<Avatar instanceId={instanceId} chatId={chatId} size={40} />
					<span className="min-w-0">
						<span className="block truncate text-[16px] text-wa-text">{title}</span>
						<span className={cn("block truncate text-[13px]", status.active ? "text-accent-strong" : "text-wa-muted")}>{status.text || "click here for contact info"}</span>
					</span>
				</button>
				<div className="flex items-center text-wa-icon">
					<IconButton label={group ? "Group info" : "Contact info"} onClick={onToggleInfo} active={infoOpen}>
						<Info className="size-5" />
					</IconButton>
				</div>
			</header>

			<div ref={scroller} onScroll={onScroll} className="wa-wallpaper wa-scroll relative min-h-0 flex-1 overflow-y-auto pb-3">
				<div className="flex justify-center pt-3">
					{hasMore ? (
						<span className="flex items-center gap-2 rounded-lg bg-wa-system px-3 py-1.5 text-xs text-wa-muted shadow-sm">
							<Loader2 className="size-3.5 animate-spin" /> Loading older messages
						</span>
					) : (
						<span className="flex max-w-md items-center gap-2 rounded-lg bg-[#ffeecd] px-3 py-1.5 text-center text-xs text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#ffd279]">
							<Lock className="size-3 shrink-0" /> Messages here are relayed by your own gateway. History starts when the gateway first saw this chat.
						</span>
					)}
				</div>

				{loading && !messages.length ? (
					<div className="grid place-items-center py-16 text-wa-muted">
						<Loader2 className="size-6 animate-spin" />
					</div>
				) : (
					messages.map((m, i) => {
						const prev = messages[i - 1];
						const newDay = !prev || new Date(prev.timestamp * 1000).toDateString() !== new Date(m.timestamp * 1000).toDateString();
						const first = newDay || !prev || prev.type !== m.type || (group && prev.senderId !== m.senderId) || m.timestamp - prev.timestamp > 600;
						return (
							<Fragment key={m.idMessage}>
								{newDay && (
									<div className="sticky top-2 z-10 my-3 flex justify-center">
										<span className="rounded-lg bg-wa-system px-3 py-1.5 text-[12.5px] uppercase text-wa-muted shadow-sm">{dayLabel(m.timestamp)}</span>
									</div>
								)}
								<MessageBubble
									message={m}
									first={first}
									showSender={group && first}
									senderLabel={m.senderName || nameFor(m.senderId ?? "")}
									quotedLabel={quotedLabel}
									reactionLabel={(id) => (id === selfId ? "You" : nameFor(id))}
									highlighted={highlight === m.idMessage}
									onAction={onAction}
									onReact={onReact}
									onJump={jumpTo}
									onOpenMedia={onOpenMedia}
								/>
							</Fragment>
						);
					})
				)}
			</div>

			{!atBottom && (
				<button
					type="button"
					aria-label="Scroll to latest"
					onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })}
					className="cursor-pointer absolute bottom-24 right-5 z-10 grid size-11 place-items-center rounded-full bg-wa-list text-wa-icon shadow-lg"
				>
					<ChevronDown className="size-6" />
					{newBelow > 0 && (
						<span className="absolute -top-1.5 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-wa-badge px-1 text-[11px] font-semibold text-white">{newBelow}</span>
					)}
				</button>
			)}

			<Composer
				chatKey={chatId}
				replyTo={replyTo}
				editing={editing}
				replyLabel={replyTo ? (replyTo.type === "outgoing" ? "You" : replyTo.senderName || (group ? nameFor(replyTo.senderId ?? "") : title)) : ""}
				onCancelReply={() => setReplyTo(null)}
				onCancelEdit={() => setEditing(null)}
				actions={actions}
				droppedFile={dropped}
				onDroppedFileHandled={() => setDropped(null)}
			/>

			{dragging && (
				<div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-wa-panel/90 text-lg text-wa-muted">Drop a file to send it</div>
			)}
		</section>
	);
}

function presenceLine(p: Presence | undefined, group: boolean, nameFor: (id: string) => string): { text: string; active: boolean } {
	if (!p) return { text: "", active: false };
	const fresh = Date.now() - p.at < 15000;
	const who = group ? `${nameFor(p.participant)} is ` : "";
	if (fresh && p.presence === "composing") return { text: `${who}typing…`, active: true };
	if (fresh && p.presence === "recording") return { text: `${who}recording audio…`, active: true };
	if (!group && p.presence === "available") return { text: "online", active: false };
	if (!group && p.presence === "unavailable" && p.lastSeen) return { text: lastSeenLabel(p.lastSeen), active: false };
	return { text: "", active: false };
}
