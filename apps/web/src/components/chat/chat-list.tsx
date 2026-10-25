"use client";

import { ArrowLeft, Ban, LayoutDashboard, MessageSquarePlus, Moon, MoreVertical, Search, Sun, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toggleTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { chatTitle, isGroup, listStamp, previewText } from "./format";
import { Ticks } from "./icons";
import type { Chat, Presence } from "./types";

type Filter = "all" | "unread" | "groups";

export function ChatList({
	instanceId,
	selfId,
	chats,
	selected,
	presence,
	onSelect,
	onNewChat,
	accountName,
}: {
	instanceId: string;
	selfId: string;
	chats: Chat[];
	selected: string | null;
	presence: Map<string, Presence>;
	onSelect: (chatId: string) => void;
	onNewChat: () => void;
	accountName: string;
}) {
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [menuOpen, setMenuOpen] = useState(false);

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		return chats.filter((c) => {
			if (filter === "unread" && !c.unreadCount) return false;
			if (filter === "groups" && !isGroup(c.id)) return false;
			if (!q) return true;
			return chatTitle(c, selfId).toLowerCase().includes(q) || c.id.includes(q) || (c.lastMessageText ?? "").toLowerCase().includes(q);
		});
	}, [chats, filter, query, selfId]);

	return (
		<section data-private className="flex h-full min-h-0 flex-col border-r border-wa-line bg-wa-list">
			<header className="flex h-16 shrink-0 items-center justify-between px-4">
				<div className="flex min-w-0 items-center gap-3">
					{selfId && <Avatar instanceId={instanceId} chatId={selfId} size={36} />}
					<div className="min-w-0">
						<h2 className="text-[22px] font-semibold leading-tight tracking-tight text-wa-text">Chats</h2>
						<p className="truncate text-xs text-wa-muted">{accountName}</p>
					</div>
				</div>
				<div className="relative flex items-center gap-1 text-wa-icon">
					<IconButton label="New chat" onClick={onNewChat}>
						<MessageSquarePlus className="size-5" />
					</IconButton>
					<IconButton label="Menu" onClick={() => setMenuOpen((v) => !v)}>
						<MoreVertical className="size-5" />
					</IconButton>
					{menuOpen && (
						<>
							<button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuOpen(false)} />
							<div className="absolute right-0 top-11 z-40 w-56 rounded-md bg-wa-list py-2 text-[14.5px] text-wa-text shadow-xl ring-1 ring-black/5">
								<Link href={`/app/i/${instanceId}`} className="flex items-center gap-3 px-6 py-2.5 hover:bg-wa-hover">
									<LayoutDashboard className="size-4 text-wa-icon" /> Instance settings
								</Link>
								<Link href="/app" className="flex items-center gap-3 px-6 py-2.5 hover:bg-wa-hover">
									<ArrowLeft className="size-4 text-wa-icon" /> All instances
								</Link>
								<button type="button" onClick={toggleTheme} className="cursor-pointer flex w-full items-center gap-3 px-6 py-2.5 text-left hover:bg-wa-hover">
									<Moon className="size-4 text-wa-icon dark:hidden" />
									<Sun className="hidden size-4 text-wa-icon dark:block" /> Switch theme
								</button>
							</div>
						</>
					)}
				</div>
			</header>

			<div className="shrink-0 px-3 pb-2">
				<div className="flex h-10 items-center gap-3 rounded-lg bg-wa-panel px-3 ring-accent/40 transition focus-within:ring-2">
					<Search className="size-4 shrink-0 text-wa-icon" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search or start a new chat"
						className="min-w-0 flex-1 bg-transparent text-sm text-wa-text outline-none placeholder:text-wa-muted"
					/>
					{query && (
						<button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="cursor-pointer text-wa-icon">
							<X className="size-4" />
						</button>
					)}
				</div>
				<div className="mt-2 flex gap-2">
					{(["all", "unread", "groups"] as Filter[]).map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => setFilter(f)}
							className={cn(
								"cursor-pointer rounded-full border px-3 py-1 text-[13px] transition",
								filter === f ? "border-transparent bg-accent/15 font-medium text-accent-strong" : "border-wa-line text-wa-muted hover:bg-wa-hover",
							)}
						>
							{f === "all" ? "All" : f === "unread" ? "Unread" : "Groups"}
						</button>
					))}
				</div>
			</div>

			<ul className="wa-scroll min-h-0 flex-1 overflow-y-auto">
				{visible.map((chat) => (
					<ChatRow
						key={chat.id}
						instanceId={instanceId}
						chat={chat}
						title={chatTitle(chat, selfId)}
						active={chat.id === selected}
						typing={presenceText(presence.get(chat.id), chat.id)}
						onClick={() => onSelect(chat.id)}
					/>
				))}
				{!visible.length && (
					<li className="px-8 py-12 text-center text-sm text-wa-muted">
						{chats.length ? "No chats match." : "No chats yet. Start one with the new chat button. Messages you send or receive will appear here."}
					</li>
				)}
			</ul>
		</section>
	);
}

function presenceText(p: Presence | undefined, chatId: string): string | null {
	if (!p || Date.now() - p.at > 15000) return null;
	if (p.presence === "composing") return isGroup(chatId) ? "someone is typing…" : "typing…";
	if (p.presence === "recording") return "recording audio…";
	return null;
}

function ChatRow({
	instanceId,
	chat,
	title,
	active,
	typing,
	onClick,
}: {
	instanceId: string;
	chat: Chat;
	title: string;
	active: boolean;
	typing: string | null;
	onClick: () => void;
}) {
	const unread = chat.unreadCount > 0;
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className={cn("cursor-pointer flex w-full items-center gap-3 pl-3 text-left transition-colors", active ? "bg-wa-active" : "hover:bg-wa-hover")}
			>
				<Avatar instanceId={instanceId} chatId={chat.id} size={49} />
				<div className="min-w-0 flex-1 border-b border-wa-line py-3 pr-4">
					<div className="flex items-baseline justify-between gap-2">
						<span className={cn("truncate text-[16px] text-wa-text", unread && "font-semibold")}>{title}</span>
						{chat.lastMessageTime ? (
							<span className={cn("shrink-0 text-xs", unread ? "font-medium text-wa-badge" : "text-wa-muted")}>{listStamp(chat.lastMessageTime)}</span>
						) : null}
					</div>
					<div className="mt-0.5 flex items-center justify-between gap-2">
						<span className="flex min-w-0 items-center gap-1 text-sm text-wa-muted">
							{typing ? (
								<span className="truncate text-accent-strong">{typing}</span>
							) : chat.lastMessageDeleted ? (
								<span className="flex items-center gap-1 truncate italic">
									<Ban className="size-3.5" /> This message was deleted
								</span>
							) : (
								<>
									{chat.lastMessageDirection === "outgoing" && <Ticks status={chat.lastMessageStatus} className="shrink-0" />}
									<span className="truncate">{chat.lastMessageType ? previewText(chat.lastMessageType, chat.lastMessageText) : ""}</span>
								</>
							)}
						</span>
						{unread && (
							<span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-wa-badge px-1.5 text-xs font-medium text-white dark:text-[#111b21]">
								{chat.unreadCount}
							</span>
						)}
					</div>
				</div>
			</button>
		</li>
	);
}

export function IconButton({ label, onClick, children, active }: { label: string; onClick?: () => void; children: React.ReactNode; active?: boolean }) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			onClick={onClick}
			className={cn("cursor-pointer grid size-10 place-items-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10", active && "bg-black/10 dark:bg-white/10")}
		>
			{children}
		</button>
	);
}
