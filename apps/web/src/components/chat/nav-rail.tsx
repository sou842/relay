"use client";

import { Layers, MessageCircle, Moon, Settings, SlidersHorizontal, Sun } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { toggleTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

function RailItem({ href, label, active, children }: { href?: string; label: string; active?: boolean; children: React.ReactNode }) {
	const className = cn(
		"group relative grid size-10 cursor-pointer place-items-center rounded-full text-wa-icon transition-colors",
		active ? "bg-wa-active text-wa-text" : "hover:bg-black/5 dark:hover:bg-white/10",
	);
	const tip = (
		<span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#111b21] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 dark:bg-[#e9edef] dark:text-[#111b21]">
			{label}
		</span>
	);
	if (href) {
		return (
			<Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
				{children}
				{tip}
			</Link>
		);
	}
	return (
		<button type="button" aria-label={label} onClick={toggleTheme} className={className}>
			{children}
			{tip}
		</button>
	);
}

/** Slim app rail on the left of the chat for tablet widths. From lg up the dashboard sidebar (collapsed to its rail) replaces it. */
export function NavRail({ instanceId, unread }: { instanceId: string; unread: number }) {
	return (
		<nav aria-label="App" className="hidden w-16 shrink-0 flex-col items-center justify-between border-r border-wa-line bg-wa-panel py-3 md:flex lg:hidden">
			<div className="flex flex-col items-center gap-2">
				<Link href="/app" aria-label="Relay dashboard" className="mb-2">
					<LogoMark className="size-8" />
				</Link>
				<RailItem href={`/app/i/${instanceId}/chat`} label="Chats" active>
					<MessageCircle className="size-5" />
					{unread > 0 && (
						<span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-wa-badge px-1 text-[10px] font-semibold text-white dark:text-[#111b21]">
							{unread > 99 ? "99+" : unread}
						</span>
					)}
				</RailItem>
				<RailItem href="/app" label="All instances">
					<Layers className="size-5" />
				</RailItem>
				<RailItem href={`/app/i/${instanceId}`} label="Instance settings">
					<SlidersHorizontal className="size-5" />
				</RailItem>
			</div>
			<div className="flex flex-col items-center gap-2">
				<RailItem label="Switch theme">
					<Moon className="size-5 dark:hidden" />
					<Sun className="hidden size-5 dark:block" />
				</RailItem>
				<RailItem href="/app/settings" label="Settings">
					<Settings className="size-5" />
				</RailItem>
			</div>
		</nav>
	);
}
