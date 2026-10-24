"use client";

import { BookOpen, Layers, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
	{ href: "/app", label: "Instances", icon: Layers, match: (p: string) => p === "/app" || p.startsWith("/app/i/") },
	{ href: "/app/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/app/settings") },
	{ href: "/docs", label: "Docs", icon: BookOpen, match: () => false },
];

export function AppNav() {
	const pathname = usePathname();
	return (
		<nav aria-label="Main" className="flex items-center gap-0.5 rounded-full bg-panel-2 p-1 text-sm">
			{tabs.map(({ href, label, icon: Icon, match }) => {
				const active = match(pathname);
				return (
					<Link
						key={href}
						href={href}
						aria-current={active ? "page" : undefined}
						className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition", active ? "bg-panel font-medium shadow-sm" : "text-muted hover:text-fg")}
					>
						<Icon className="size-4" />
						<span className="hidden sm:inline">{label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
