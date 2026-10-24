"use client";

import { BookOpen, ChevronLeft, ChevronRight, Layers, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo, LogoMark } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

interface NavItem {
	href: string;
	label: string;
	icon: typeof Layers;
	match: (p: string) => boolean;
}

const sections: { title: string; items: NavItem[] }[] = [
	{
		title: "Workspace",
		items: [
			{ href: "/app", label: "Instances", icon: Layers, match: (p) => p === "/app" || p.startsWith("/app/i/") },
			{ href: "/docs", label: "Documentation", icon: BookOpen, match: () => false },
			{ href: "/app/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/app/settings") },
		],
	}
];

const MIN_W = 208;
const MAX_W = 380;
const DEFAULT_W = 256;
const RAIL_W = 68;
const STORAGE_KEY = "relay.sidebar";

function SidebarContent({ name, email, onNavigate, collapsed = false }: { name: string; email: string; onNavigate?: () => void; collapsed?: boolean }) {
	const pathname = usePathname();
	return (
		<div className="flex h-full flex-col">
			<div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center" : "px-5")}>
				{collapsed ? (
					<Link href="/app" aria-label="Relay">
						<LogoMark />
					</Link>
				) : (
					<Logo href="/app" />
				)}
			</div>

			<nav aria-label="Main" className={cn("flex-1 overflow-y-auto pb-4 pt-2", collapsed ? "px-2" : "px-3")}>
				{sections.map((section) => (
					<div key={section.title} className="mb-6">
						{collapsed ? (
							<div className="mx-3 mb-2 h-px bg-line" />
						) : (
							<div className="truncate px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">{section.title}</div>
						)}
						<ul className="grid gap-0.5">
							{section.items.map(({ href, label, icon: Icon, match }) => {
								const active = match(pathname);
								return (
									<li key={href}>
										<Link
											href={href}
											onClick={onNavigate}
											title={collapsed ? label : undefined}
											aria-current={active ? "page" : undefined}
											className={cn(
												"group relative flex items-center gap-3 rounded-lg py-2 text-sm transition",
												collapsed ? "justify-center px-0" : "px-3",
												active ? "bg-accent/10 font-medium text-accent-strong" : "text-muted hover:bg-panel-2 hover:text-fg",
											)}
										>
											{active && <span className={cn("absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent", collapsed ? "-left-2" : "-left-3")} />}
											<Icon className="size-[18px] shrink-0" />
											{!collapsed && <span className="truncate">{label}</span>}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</nav>

			<div className={cn("shrink-0 border-t border-line", collapsed ? "p-2" : "p-3")}>
				<UserMenu name={name} email={email} compact={collapsed} />
			</div>
		</div>
	);
}

export function AppShell({ name, email, children }: { name: string; email: string; children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	const [width, setWidth] = useState(DEFAULT_W);
	const [collapsed, setCollapsed] = useState(false);
	const [dragging, setDragging] = useState(false);
	const widthRef = useRef(DEFAULT_W);
	const pathname = usePathname();

	// Restore the saved layout after mount (keeps server and client markup identical on first render).
	/* eslint-disable react-hooks/set-state-in-effect -- localStorage only exists on the client, so it can't seed initial state without a hydration mismatch */
	useEffect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
			if (saved && typeof saved.width === "number") {
				const w = Math.min(MAX_W, Math.max(MIN_W, saved.width));
				widthRef.current = w;
				setWidth(w);
				setCollapsed(Boolean(saved.collapsed));
			}
		} catch { }
	}, []);
	/* eslint-enable react-hooks/set-state-in-effect */

	const persist = useCallback((w: number, c: boolean) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: w, collapsed: c }));
		} catch { }
	}, []);

	const toggle = useCallback(() => {
		setCollapsed((c) => {
			persist(widthRef.current, !c);
			return !c;
		});
	}, [persist]);

	useEffect(() => {
		const key = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				toggle();
			}
		};
		document.addEventListener("keydown", key);
		return () => document.removeEventListener("keydown", key);
	}, [toggle]);

	function startResize(e: React.PointerEvent<HTMLDivElement>) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = widthRef.current;
		setDragging(true);
		const move = (ev: PointerEvent) => {
			const w = Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX));
			widthRef.current = w;
			setWidth(w);
		};
		const up = () => {
			setDragging(false);
			persist(widthRef.current, false);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	}

	function resetWidth() {
		widthRef.current = DEFAULT_W;
		setWidth(DEFAULT_W);
		persist(DEFAULT_W, false);
	}

	const sidebarW = collapsed ? RAIL_W : width;

	// Close the mobile drawer after navigating (adjusting state during render, not in an effect).
	const [drawerPath, setDrawerPath] = useState(pathname);
	if (drawerPath !== pathname) {
		setDrawerPath(pathname);
		setOpen(false);
	}
	useEffect(() => {
		if (!open) return;
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("keydown", esc);
		return () => document.removeEventListener("keydown", esc);
	}, [open]);

	return (
		<div className={cn("min-h-screen bg-bg", dragging && "cursor-col-resize select-none")} style={{ "--sbw": `${sidebarW}px` } as React.CSSProperties}>
			{/* Desktop sidebar */}
			<aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-[var(--sbw)] border-r border-line bg-panel lg:block", !dragging && "transition-[width] duration-200")}>
				<SidebarContent name={name} email={email} collapsed={collapsed} />

				<button
					type="button"
					onClick={toggle}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
					className="absolute -right-3 top-5 z-10 grid size-6 place-items-center rounded-full border border-line bg-panel text-muted shadow-sm transition hover:text-fg cursor-pointer"
				>
					{collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
				</button>
				{!collapsed && (
					<div
						role="separator"
						aria-orientation="vertical"
						aria-label="Resize sidebar"
						title="Drag to resize, double-click to reset"
						onPointerDown={startResize}
						onDoubleClick={resetWidth}
						className="group absolute inset-y-0 -right-1 z-[5] w-2 cursor-col-resize"
					>
						<div className={cn("mx-auto h-full w-0.5 transition", dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/60")} />
					</div>
				)}
			</aside>

			{/* Mobile top bar + drawer */}
			<header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-panel/90 px-4 backdrop-blur lg:hidden">
				<button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg">
					<Menu className="size-5" />
				</button>
				<Logo href="/app" />
			</header>
			{open && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
					<aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-panel shadow-2xl">
						<button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-3.5 grid size-8 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg">
							<X className="size-5" />
						</button>
						<SidebarContent name={name} email={email} onNavigate={() => setOpen(false)} />
					</aside>
				</div>
			)}

			<main className={cn("lg:pl-[var(--sbw)]", !dragging && "transition-[padding] duration-200")}>
				<div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</div>
			</main>
		</div>
	);
}
