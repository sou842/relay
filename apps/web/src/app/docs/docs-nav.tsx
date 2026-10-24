"use client";

import { ArrowLeft, ArrowRight, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { DOCS_PAGES, DOCS_SECTIONS } from "./docs-pages";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
	const pathname = usePathname();
	return (
		<nav aria-label="Documentation" className="px-3 pb-6 pt-2">
			{DOCS_SECTIONS.map((section) => (
				<div key={section.title} className="mb-6">
					<div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">{section.title}</div>
					<ul className="grid gap-0.5">
						{section.pages.map(({ href, title, icon: Icon }) => {
							const active = pathname === href;
							return (
								<li key={href}>
									<Link
										href={href}
										onClick={onNavigate}
										aria-current={active ? "page" : undefined}
										className={cn(
											"relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
											active ? "bg-accent/10 font-medium text-accent-strong" : "text-muted hover:bg-panel-2 hover:text-fg",
										)}
									>
										{active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />}
										<Icon className="size-4.5 shrink-0" />
										<span className="truncate">{title}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}

/** Fixed sidebar on desktop, slide-in drawer on smaller screens. */
export function DocsSidebar() {
	const [open, setOpen] = useState(false);
	const pathname = usePathname();
	const [path, setPath] = useState(pathname);
	if (path !== pathname) {
		setPath(pathname);
		setOpen(false);
	}

	return (
		<>
			<aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-panel lg:flex">
				<div className="flex h-16 shrink-0 items-center gap-2 px-5">
					<Logo />
					<span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent-strong">Docs</span>
				</div>
				<div className="flex-1 overflow-y-auto">
					<NavLinks />
				</div>
			</aside>

			<button type="button" aria-label="Open navigation" onClick={() => setOpen(true)} className="cursor-pointer grid size-9 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg lg:hidden">
				<Menu className="size-5" />
			</button>
			{open && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
					<aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel shadow-2xl">
						<div className="flex h-14 shrink-0 items-center justify-between px-5">
							<Logo />
							<button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="cursor-pointer grid size-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg">
								<X className="size-5" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto">
							<NavLinks onNavigate={() => setOpen(false)} />
						</div>
					</aside>
				</div>
			)}
		</>
	);
}

export function DocsBreadcrumb() {
	const pathname = usePathname();
	const page = DOCS_PAGES.find((p) => p.href === pathname);
	if (!page) return null;
	return (
		<div className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
			<span className="hidden sm:inline">Docs</span>
			<ChevronRight className="hidden size-3.5 sm:block" />
			<span className="hidden truncate sm:inline">{page.section}</span>
			<ChevronRight className="hidden size-3.5 sm:block" />
			<span className="truncate text-fg">{page.title}</span>
		</div>
	);
}

export function DocsPager() {
	const pathname = usePathname();
	const i = DOCS_PAGES.findIndex((p) => p.href === pathname);
	if (i < 0) return null;
	const prev = DOCS_PAGES[i - 1];
	const next = DOCS_PAGES[i + 1];
	const card = "group flex flex-col gap-1 rounded-xl border border-line bg-panel px-4 py-3 transition hover:border-accent/50";
	return (
		<div className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
			{prev ? (
				<Link href={prev.href} className={card}>
					<span className="flex items-center gap-1 text-xs text-muted">
						<ArrowLeft className="size-3.5" /> Previous
					</span>
					<span className="font-medium group-hover:text-accent-strong">{prev.title}</span>
				</Link>
			) : (
				<span />
			)}
			{next && (
				<Link href={next.href} className={cn(card, "text-right sm:col-start-2")}>
					<span className="flex items-center justify-end gap-1 text-xs text-muted">
						Next <ArrowRight className="size-3.5" />
					</span>
					<span className="font-medium group-hover:text-accent-strong">{next.title}</span>
				</Link>
			)}
		</div>
	);
}

const slug = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/** "On this page": reads the article's h2s, gives them ids and highlights the one in view. */
export function DocsToc() {
	const pathname = usePathname();
	const [items, setItems] = useState<{ id: string; text: string }[]>([]);
	const [active, setActive] = useState("");

	useEffect(() => {
		const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>("article.prose-docs h2"));
		const list = headings.map((h) => {
			h.id ||= slug(h.textContent ?? "");
			return { id: h.id, text: h.textContent ?? "" };
		});
		// The headings only exist in the DOM after render, so the list can't be computed earlier.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setItems(list);
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.find((e) => e.isIntersecting);
				if (visible) setActive(visible.target.id);
			},
			{ rootMargin: "-80px 0px -70% 0px" },
		);
		headings.forEach((h) => observer.observe(h));
		return () => observer.disconnect();
	}, [pathname]);

	if (items.length < 2) return null;
	return (
		<nav aria-label="On this page" className="sticky top-24 hidden max-h-[calc(100vh-8rem)] w-52 shrink-0 self-start overflow-y-auto xl:block">
			<div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted">On this page</div>
			<ul className="grid gap-1 border-l border-line text-sm">
				{items.map((item) => (
					<li key={item.id}>
						<a
							href={`#${item.id}`}
							className={cn("-ml-px block border-l-2 py-1 pl-3 transition", active === item.id ? "border-accent font-medium text-accent-strong" : "border-transparent text-muted hover:text-fg")}
						>
							{item.text}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
