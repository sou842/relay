import { ArrowLeft, Code2, MessageSquareText, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

const points = [
	{ icon: QrCode, title: "Link in seconds", text: "Scan a QR code or use a phone code, no app to install." },
	{ icon: MessageSquareText, title: "Chat from the browser", text: "A familiar inbox with reactions, replies, media and voice notes." },
	{ icon: Code2, title: "API-compatible", text: "Works with the official GREEN-API SDKs and webhooks." },
	{ icon: ShieldCheck, title: "Self-hosted", text: "Your sessions and message history stay on your own server." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
			<aside className="cta-band relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
				<div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-40 [--line:rgba(255,255,255,0.25)]" />
				<div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
				<Logo className="relative text-white" />
				<div className="relative my-auto max-w-md">
					<h2 className="font-display text-5xl leading-[1.05] tracking-tight">Your messaging inbox and API, in one place.</h2>
					<p className="mt-4 text-white/75">Link a number, chat from the browser, and automate with a familiar HTTP API.</p>
					<ul className="mt-10 grid gap-5">
						{points.map(({ icon: Icon, title, text }) => (
							<li key={title} className="flex gap-4">
								<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
									<Icon className="size-5" />
								</span>
								<div>
									<div className="font-medium">{title}</div>
									<div className="text-sm text-white/70">{text}</div>
								</div>
							</li>
						))}
					</ul>
				</div>
				<p className="relative text-xs text-white/60">Use test numbers and message people who expect it.</p>
			</aside>

			<main className="relative flex min-h-screen flex-col px-4 py-6 sm:px-8">
				<div>
					<Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
						<ArrowLeft className="size-4" /> Back to home
					</Link>
				</div>
				<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
					<Logo className="mb-8 lg:hidden" />
					{children}
				</div>
			</main>
		</div>
	);
}
