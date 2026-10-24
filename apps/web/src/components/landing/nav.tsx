import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
	{ href: "#features", label: "Features" },
	{ href: "#how", label: "How it works" },
	{ href: "#api", label: "API" },
	{ href: "#faq", label: "FAQ" },
	{ href: "/docs", label: "Docs" },
];

const cell = "flex items-center border-line px-5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg";

// A ruled bar inside the page column: cells divided by hairlines, ending in a solid call-to-action.
// Not sticky; it scrolls away with the page.
export function LandingNav({ signedIn }: { signedIn: boolean }) {
	return (
		<header className="relative z-40 border-b border-line bg-bg">
			<div className="flex h-14 items-stretch">
				<Link href="/" className="flex items-center gap-2.5 border-r border-line px-5 font-medium tracking-tight text-fg sm:px-6">
					<LogoMark className="size-7" />
					<span className="text-[17px]">Relay</span>
				</Link>

				<nav className="hidden items-stretch md:flex" aria-label="Main">
					{links.map((l) => (
						<Link key={l.href} href={l.href} className={`${cell} border-r`}>
							{l.label}
						</Link>
					))}
				</nav>

				<div className="ml-auto flex items-stretch">
					<span className="flex items-center border-l border-line px-2">
						<ThemeToggle />
					</span>
					{!signedIn && (
						<Link href="/sign-in" className={`${cell} hidden border-l sm:flex`}>
							Log in
						</Link>
					)}
					<Link
						href={signedIn ? "/app" : "/sign-up"}
						className="group flex items-center gap-2 bg-accent px-5 text-sm font-medium text-accent-fg transition hover:brightness-110 sm:px-7"
					>
						{signedIn ? "Dashboard" : "Get started"}
						<ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
					</Link>

					{/* mobile menu: a plain <details>, so it needs no JavaScript */}
					<details className="md:hidden">
						<summary
							className="grid h-14 w-14 cursor-pointer list-none place-items-center border-l border-line text-muted transition hover:bg-panel-2 hover:text-fg [&::-webkit-details-marker]:hidden"
							aria-label="Menu"
						>
							<Menu className="size-[18px]" />
						</summary>
						<div className="absolute inset-x-0 top-full border-b border-line bg-bg shadow-xl">
							{links?.map((l) => (
								<Link key={l.href} href={l.href} className="block border-t border-line px-6 py-4 text-[15px] transition hover:bg-panel-2 first:border-t-0">
									{l.label}
								</Link>
							))}
							{!signedIn && (
								<Link href="/sign-in" className="block border-t border-line px-6 py-4 text-[15px] text-muted transition hover:bg-panel-2 sm:hidden">
									Log in
								</Link>
							)}
						</div>
					</details>
				</div>
			</div>
		</header>
	);
}
