import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export function CtaBand({ signedIn }: { signedIn: boolean }) {
	return (
		<section className="lp-hatch border-b border-line px-4 py-24 text-center">
			<h2 className="mx-auto max-w-2xl text-balance font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
				Ready to link your <em className="text-accent-strong">first number?</em>
			</h2>
			<p className="mx-auto mt-5 max-w-md text-balance leading-relaxed text-muted">Create an account, run the gateway, scan one QR code. You can be chatting in a few minutes.</p>
			<div className="mt-9 flex flex-wrap justify-center gap-3">
				<Link
					href={signedIn ? "/app" : "/sign-up"}
					className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[15px] font-medium text-accent-fg shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_20px_-8px_var(--accent)] transition hover:brightness-110"
				>
					{signedIn ? "Open dashboard" : "Start for free"}
					<ArrowRight className="size-4" />
				</Link>
				<Link href="/docs/getting-started" className="lp-pill-shadow inline-flex h-12 items-center rounded-full bg-panel px-6 text-[15px] font-medium transition hover:bg-panel-2">
					Setup guide
				</Link>
			</div>
		</section>
	);
}

const columns = [
	{
		title: "Product",
		links: [
			{ href: "#features", label: "Features" },
			{ href: "#how", label: "How it works" },
			{ href: "#api", label: "API" },
			{ href: "#faq", label: "FAQ" },
		],
	},
	{
		title: "Docs",
		links: [
			{ href: "/docs/getting-started", label: "Getting started" },
			{ href: "/docs/linking", label: "Linking WhatsApp" },
			{ href: "/docs/api", label: "HTTP API" },
			{ href: "/docs/webhooks", label: "Webhooks" },
		],
	},
	{
		title: "Account",
		links: [
			{ href: "/sign-in", label: "Sign in" },
			{ href: "/sign-up", label: "Create account" },
			{ href: "/docs/self-hosting", label: "Self-hosting" },
			{ href: "/docs/safety", label: "Staying safe" },
		],
	},
];

export function Footer() {
	return (
		<footer>
			<div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
				<div>
					<Logo />
					<p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">A self-hosted messaging gateway: a browser inbox and a GREEN-API-compatible HTTP API on your own hardware.</p>
				</div>
				{columns.map((c) => (
					<nav key={c.title} aria-label={c.title}>
						<h3 className="text-sm font-medium">{c.title}</h3>
						<ul className="mt-4 grid gap-2.5 text-sm">
							{c.links.map((l) => (
								<li key={l.label}>
									<Link href={l.href} className="text-muted transition hover:text-fg">
										{l.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				))}
			</div>
			<div className="border-t border-line">
				<p className="mx-auto max-w-5xl px-4 py-6 text-center text-xs leading-relaxed text-muted sm:px-10">
					Relay is an independent project, an unofficial client not affiliated with WhatsApp, Meta or GREEN-API. WhatsApp is a trademark of its owner. Use a test number and message people who expect it.
				</p>
			</div>
		</footer>
	);
}
