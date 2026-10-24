"use client";

import { BookOpen, ChevronDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const themes: { id: ThemePref; label: string; icon: typeof Sun }[] = [
	{ id: "light", label: "Light", icon: Sun },
	{ id: "dark", label: "Dark", icon: Moon },
	{ id: "system", label: "System", icon: Monitor },
];

export function UserMenu({ name, email }: { name: string; email: string }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const theme = useThemePref();
	const initial = (name || email).slice(0, 1).toUpperCase();

	useEffect(() => {
		if (!open) return;
		const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", away);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("mousedown", away);
			document.removeEventListener("keydown", esc);
		};
	}, [open]);

	const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition hover:bg-panel-2";

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-2.5 transition hover:bg-panel-2"
			>
				<span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-medium text-accent-fg">{initial}</span>
				<span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">{name || email}</span>
				<ChevronDown className={cn("size-4 text-muted transition", open && "rotate-180")} />
			</button>

			{open && (
				<div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
					<div className="px-2.5 py-2">
						<div className="truncate text-sm font-medium">{name}</div>
						<div className="truncate text-xs text-muted">{email}</div>
					</div>
					<div className="my-1 h-px bg-line" />
					<Link href="/app/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
						<Settings className="size-4 text-muted" /> Settings
					</Link>
					<Link href="/docs" role="menuitem" className={item} onClick={() => setOpen(false)}>
						<BookOpen className="size-4 text-muted" /> Documentation
					</Link>
					<div className="my-1 h-px bg-line" />
					<div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Theme</div>
					<div className="mx-1 mb-1 grid grid-cols-3 gap-1 rounded-xl bg-panel-2 p-1" role="radiogroup" aria-label="Theme">
						{themes.map(({ id, label, icon: Icon }) => (
							<button
								key={id}
								type="button"
								role="radio"
								aria-checked={theme === id}
								title={label}
								onClick={() => setThemePref(id)}
								className={cn("flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs transition", theme === id ? "bg-panel font-medium shadow-sm" : "text-muted hover:text-fg")}
							>
								<Icon className="size-3.5" /> {label}
							</button>
						))}
					</div>
					<div className="my-1 h-px bg-line" />
					<button
						type="button"
						role="menuitem"
						className={cn(item, "text-danger")}
						onClick={async () => {
							await signOut();
							router.push("/sign-in");
							router.refresh();
						}}
					>
						<LogOut className="size-4" /> Sign out
					</button>
				</div>
			)}
		</div>
	);
}
