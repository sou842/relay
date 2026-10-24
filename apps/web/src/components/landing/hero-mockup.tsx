import { CheckCheck, Lock, MessagesSquare, Paperclip, Phone, Search, Send, Smile, Video, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// Illustration only: sample names and messages. The layout mirrors the real
// inbox (instance rail, chat list, conversation) so the preview matches what
// you get after signing up.

const chats = [
	{ name: "Aarav Mehta", last: "Perfect, thanks!", time: "10:42", unread: 0, tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", active: true },
	{ name: "Support line", last: "Your ticket was updated", time: "10:31", unread: 2, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
	{ name: "Priya Nair", last: "Photo", time: "09:58", unread: 0, tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
	{ name: "Warehouse team", last: "Truck arrives at 4 pm", time: "Yesterday", unread: 0, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
	{ name: "Rohan Das", last: "Sounds good", time: "Tue", unread: 0, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
];

function Avatar({ name, tone, size = 40 }: { name: string; tone: string; size?: number }) {
	return (
		<span className={cn("grid shrink-0 place-items-center rounded-full text-sm font-medium", tone)} style={{ width: size, height: size }}>
			{name.slice(0, 1)}
		</span>
	);
}

export function HeroMockup() {
	return (
		<div className="relative mx-auto mt-20 mb-8 w-full max-w-5xl text-left">
			<div aria-hidden className="absolute inset-x-10 top-6 -z-10 h-3/4 rounded-full bg-accent/15 blur-3xl" />

			{/* app window, fading into the page at the bottom */}
			<div className="overflow-hidden rounded-2xl border border-line bg-panel [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]">
				<div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-panel-2/70 px-4 py-2.5">
					<div className="flex gap-1.5" aria-hidden>
						<span className="size-2.5 rounded-full bg-fg/15" />
						<span className="size-2.5 rounded-full bg-fg/15" />
						<span className="size-2.5 rounded-full bg-fg/15" />
					</div>
					<div className="flex w-64 items-center justify-center gap-1.5 truncate rounded-md bg-panel px-3 py-1 text-xs text-muted shadow-[0_0_0_1px_var(--line)]">
						<Lock className="size-3" /> relay.local/app/i/support/chat
					</div>
					<div />
				</div>

				<div className="grid h-[470px] grid-cols-1 sm:grid-cols-[56px_280px_1fr]">
					{/* instance rail */}
					<div className="hidden flex-col items-center gap-3 border-r border-line bg-panel-2/40 py-4 sm:flex" aria-hidden>
						<span className="relative grid size-9 place-items-center rounded-xl bg-accent text-accent-fg shadow-sm">
							<MessagesSquare className="size-[18px]" />
							<span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-panel" />
						</span>
						<span className="grid size-9 place-items-center rounded-xl border border-dashed border-line text-[11px] font-medium text-muted">TG</span>
					</div>

					{/* chat list */}
					<div className="hidden border-r border-line sm:block">
						<div className="flex items-center justify-between px-4 pb-2 pt-4">
							<span className="text-[15px] font-semibold tracking-tight">Chats</span>
							<span className="text-[11px] text-muted">Support line</span>
						</div>
						<div className="px-3 pb-2">
							<div className="flex h-8 items-center gap-2 rounded-lg bg-panel-2 px-2.5 text-xs text-muted">
								<Search className="size-3.5" /> Search or start a new chat
							</div>
							<div className="mt-2.5 flex gap-1.5 text-[11px]">
								<span className="rounded-full bg-accent/12 px-2.5 py-1 font-medium text-accent-strong">All</span>
								<span className="rounded-full px-2.5 py-1 text-muted">Unread</span>
								<span className="rounded-full px-2.5 py-1 text-muted">Groups</span>
							</div>
						</div>
						<ul>
							{chats.map((c) => (
								<li key={c.name} className={cn("flex items-center gap-3 px-4 py-2.5", c.active && "bg-panel-2")}>
									<Avatar name={c.name} tone={c.tone} />
									<div className="min-w-0 flex-1">
										<div className="flex items-baseline justify-between gap-2">
											<span className="truncate text-[13px] font-medium">{c.name}</span>
											<span className={cn("shrink-0 text-[11px]", c.unread ? "font-medium text-accent-strong" : "text-muted")}>{c.time}</span>
										</div>
										<div className="mt-0.5 flex items-center justify-between gap-2">
											<span className="truncate text-xs text-muted">{c.last}</span>
											{c.unread > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-fg">{c.unread}</span>}
										</div>
									</div>
								</li>
							))}
						</ul>
					</div>

					{/* conversation */}
					<div className="flex min-w-0 flex-col bg-panel-2/40">
						<div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
							<Avatar name="Aarav Mehta" tone={chats[0].tone} size={36} />
							<div className="min-w-0">
								<div className="text-sm font-medium leading-tight">Aarav Mehta</div>
								<div className="text-xs text-accent-strong">typing…</div>
							</div>
							<div className="ml-auto flex items-center gap-4 text-muted" aria-hidden>
								<Video className="size-4" />
								<Phone className="size-4" />
								<Search className="size-4" />
							</div>
						</div>

						<div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-5 text-[13px] leading-snug">
							<span className="lp-pill-shadow mb-1 self-center rounded-full bg-panel px-3 py-0.5 text-[11px] text-muted">Today</span>
							<div className="max-w-[72%] self-start rounded-2xl rounded-tl-md bg-panel px-3.5 py-2 shadow-[0_0_0_1px_var(--line)]">
								Hi! Is my order out for delivery yet?
								<span className="mt-0.5 block text-right text-[10px] text-muted">10:39</span>
							</div>
							<div className="max-w-[72%] self-end rounded-2xl rounded-tr-md bg-accent px-3.5 py-2 text-accent-fg">
								Yes, it ships today. I&apos;ll send the tracking link in a minute.
								<span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/70">
									10:40 <CheckCheck className="size-3.5 text-sky-200" />
								</span>
							</div>
							<div className="max-w-[72%] self-end rounded-2xl rounded-tr-md bg-accent px-3.5 py-2 text-accent-fg">
								<span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-white/75">
									<Zap className="size-3" /> Sent via API
								</span>
								Order #1042 is on its way. Track it here: relay.example/t/1042
								<span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/70">
									10:41 <CheckCheck className="size-3.5 text-sky-200" />
								</span>
							</div>
							<div className="max-w-[72%] self-start rounded-2xl rounded-tl-md bg-panel px-3.5 py-2 shadow-[0_0_0_1px_var(--line)]">
								Perfect, thanks!
								<span className="mt-0.5 block text-right text-[10px] text-muted">10:42</span>
							</div>
						</div>

						<div className="flex items-center gap-3 border-t border-line bg-panel px-4 py-3 text-muted" aria-hidden>
							<Smile className="size-[18px]" />
							<Paperclip className="size-[18px]" />
							<div className="h-9 flex-1 rounded-lg bg-panel-2 px-3 text-xs leading-9">Type a message</div>
							<span className="grid size-9 place-items-center rounded-full bg-accent text-accent-fg">
								<Send className="size-4" />
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
