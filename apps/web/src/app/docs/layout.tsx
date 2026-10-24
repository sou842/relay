import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClass } from "@/components/ui";
import { DocsNav } from "./docs-nav";
import { DOCS_PAGES } from "./docs-pages";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-bg">
			<header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
					<div className="flex items-center gap-3">
						<Logo />
						<span className="rounded-md bg-panel-2 px-2 py-0.5 text-xs font-medium text-muted">Docs</span>
					</div>
					<div className="flex items-center gap-2">
						<ThemeToggle />
						<Link href="/app" className={buttonClass("primary", "h-9")}>
							Open dashboard
						</Link>
					</div>
				</div>
			</header>
			<div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[220px_1fr]">
				<DocsNav pages={DOCS_PAGES} />
				<article className="prose-docs min-w-0 max-w-3xl">{children}</article>
			</div>
		</div>
	);
}
