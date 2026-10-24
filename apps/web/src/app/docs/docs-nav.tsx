"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DocsNav({ pages }: { pages: { href: string; title: string }[] }) {
	const pathname = usePathname();
	return (
		<nav className="md:sticky md:top-24 md:self-start">
			<ul className="flex gap-1 overflow-x-auto pb-2 md:grid md:overflow-visible md:pb-0">
				{pages.map((p) => (
					<li key={p.href}>
						<Link
							href={p.href}
							className={cn(
								"block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition",
								pathname === p.href ? "bg-accent/12 font-medium text-accent-strong" : "text-muted hover:bg-panel-2 hover:text-fg",
							)}
						>
							{p.title}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
