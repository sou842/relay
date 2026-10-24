"use client";

import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
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

export function UserMenu({ name, email, compact = false }: { name: string; email: string; compact?: boolean }) {
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
				title={compact ? name || email : undefined}
				className={cn("flex w-full items-center rounded-xl p-2 text-left transition hover:bg-panel-2", compact ? "justify-center" : "gap-3")}
			>
				<span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-medium text-accent-fg">{initial}</span>
				{!compact && (
					<>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-medium">{name || email}</span>
							<span className="block truncate text-xs text-muted">{email}</span>
						</span>
						<ChevronsUpDown className="size-4 shrink-0 text-muted" />
					</>
				)}
			</button>

			{open && (
				<div role="menu" className={cn("absolute z-50 w-full min-w-60 rounded-2xl border border-line bg-panel p-1.5 shadow-xl", compact ? "bottom-0 left-[calc(100%+12px)]" : "bottom-[calc(100%+8px)] left-0")}>
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
