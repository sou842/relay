import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { DocsBreadcrumb, DocsPager, DocsSidebar, DocsToc } from "./docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-bg">
			<div className="lg:pl-64">
				{/* No backdrop-filter here: it would make the fixed sidebar and drawer position against the header. */}
				<header className="sticky top-0 z-20 border-b border-line bg-panel">
					<div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-8 lg:h-16">
						<div className="flex min-w-0 items-center gap-2">
							{/* Fixed sidebar on desktop; on mobile only its menu button shows here. */}
							<DocsSidebar />
							<DocsBreadcrumb />
						</div>
						<Link href="/app" className={buttonClass("primary", "h-9 shrink-0")}>
							<LayoutDashboard className="size-4" />
							<span className="hidden sm:inline">Open dashboard</span>
						</Link>
					</div>
				</header>
				<div className="mx-auto flex max-w-6xl gap-12 px-4 py-10 sm:px-8">
					<div className="min-w-0 flex-1">
						<article className="prose-docs max-w-3xl">{children}</article>
						<div className="max-w-3xl">
							<DocsPager />
						</div>
					</div>
					<DocsToc />
				</div>
			</div>
		</div>
	);
}
