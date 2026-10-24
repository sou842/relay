import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { HeroMockup } from "./hero-mockup";

export function Hero({ signedIn }: { signedIn: boolean }) {
	return (
		<section className="relative overflow-hidden border-b border-line">
			<div className="relative px-4 pb-20 pt-20 text-center sm:pt-28">

				<h1 className="animate-fade-up mx-auto mt-7 max-w-3xl text-balance font-display text-5xl font-normal leading-[1.02] tracking-tight [animation-delay:80ms] sm:text-7xl lg:text-[5.5rem]">
					Chat in the browser. Automate with one API.
				</h1>

				<p className="animate-fade-up mx-auto mt-7 max-w-xl text-balance text-sm leading-relaxed text-muted [animation-delay:160ms] sm:text-base">
					Link your WhatsApp as a device, get a familiar inbox in any browser, and call a GREEN-API-compatible HTTP API, all on hardware you control.
				</p>

				<div className="animate-fade-up mt-9 flex flex-wrap justify-center gap-3 [animation-delay:240ms]">
					<Link
						href={signedIn ? "/app" : "/sign-up"}
						className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[15px] font-medium text-accent-fg transition hover:brightness-110"
					>
						{signedIn ? "Open dashboard" : "Start for free"}
						<ArrowRight className="size-4" />
					</Link>
					<Link href="/docs/getting-started" className="lp-pill-shadow inline-flex h-12 items-center gap-2 rounded-full bg-panel px-6 text-base font-medium transition hover:bg-panel-2">
						<BookOpen className="size-4 text-muted" />
						Setup guide
					</Link>
				</div>

				<div className="pt-20 animate-fade-up [animation-delay:380ms]">
					<HeroMockup />
				</div>
			</div>
		</section>
	);
}
