import { Cloud, Cpu, Laptop } from "lucide-react";
import Link from "next/link";
import { Rails, SectionHeading } from "./section";

const options = [
	{ icon: Laptop, title: "Your own PC", cost: "Free", text: "The quickest way to try it. Works while the computer is on; add a tunnel to reach it from your phone." },
	{ icon: Cpu, title: "Home server or Pi", cost: "Free to run", text: "An old laptop or Raspberry Pi gives you an always-on gateway on your own network." },
	{ icon: Cloud, title: "Free cloud VM", cost: "Free tiers", text: "Oracle Always Free or Google Cloud e2-micro keep it online 24/7. Serverless platforms can't hold the connection." },
];

export function RunYourWay() {
	return (
		<section className="border-b border-line">
			<SectionHeading className="py-20" eyebrow="Self-hosting" title="Run it your way" text="Relay has nothing to subscribe to. Pick where the gateway lives; free options work fine." />
			<Rails className="border-t border-line">
				<div className="grid grid-cols-1 gap-px bg-line md:grid-cols-3">
					{options.map(({ icon: Icon, title, cost, text }) => (
						<div key={title} className="flex min-w-0 flex-col bg-bg p-8">
							<div className="flex items-center justify-between">
								<Icon className="size-[22px] text-accent-strong" />
								<span className="lp-pill-shadow rounded-full bg-panel px-2.5 py-1 text-xs font-medium">{cost}</span>
							</div>
							<h3 className="mt-5 text-xl font-medium tracking-tight">{title}</h3>
							<p className="mt-2 leading-relaxed text-muted">{text}</p>
						</div>
					))}
				</div>
			</Rails>
			<div className="border-t border-line px-4 py-8 text-center">
				<Link href="/docs/self-hosting" className="lp-pill-shadow inline-flex h-11 items-center rounded-full bg-panel px-6 text-sm font-medium transition hover:bg-panel-2">
					Self-hosting guide
				</Link>
			</div>
		</section>
	);
}
