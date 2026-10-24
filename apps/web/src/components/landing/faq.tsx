import { ChevronDown } from "lucide-react";
import Link from "next/link";

const faqs = [
	{
		q: "Is this official WhatsApp software?",
		a: "No. Relay connects as a linked device through an open-source client library. WhatsApp's terms don't allow unofficial clients, and accounts that look automated can be banned. Use a secondary number, message people who expect it, and keep a human pace. For business messaging at scale, use Meta's official Cloud API.",
	},
	{
		q: "Does my phone have to stay online?",
		a: "No, the gateway works on its own once linked. WhatsApp does unlink a device when the phone has been offline for about two weeks, so open WhatsApp on it now and then.",
	},
	{
		q: "Where are my messages stored?",
		a: "In the gateway's data folder on your machine (a SQLite database plus media files), with account records in your MongoDB. Messages still travel through WhatsApp's servers like any other chat.",
	},
	{
		q: "Can I use GREEN-API's SDKs?",
		a: "Yes, for the methods Relay implements. The official JavaScript SDK (v1) accepts a custom host and passes our compatibility checks. Not every GREEN-API method exists yet; the API docs list what's available.",
	},
	{
		q: "What about Telegram?",
		a: "It's planned. Messengers are providers behind one interface, so Telegram adds a provider rather than a rewrite. It isn't available yet.",
	},
	{
		q: "How much does it cost?",
		a: "There is nothing to pay Relay. You run it, so the cost is whatever your hardware or cloud VM costs, and free tiers work.",
	},
];

export function Faq() {
	return (
		<section id="faq" className="border-b border-line">
			<div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-4 py-24 sm:px-10 md:grid-cols-[1fr_1.5fr]">
				<div>
					<h2 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Frequently asked questions</h2>
					<p className="mt-5 max-w-sm leading-relaxed text-muted">
						Straight answers, including the uncomfortable ones. More in the{" "}
						<Link href="/docs/safety" className="text-accent-strong underline underline-offset-4">
							safety guide
						</Link>{" "}
						and the{" "}
						<Link href="/docs" className="text-accent-strong underline underline-offset-4">
							docs
						</Link>
						.
					</p>
				</div>
				<div className="divide-y divide-line border-y border-line">
					{faqs.map((f) => (
						<details key={f.q} className="group">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium transition hover:text-accent-strong [&::-webkit-details-marker]:hidden">
								{f.q}
								<ChevronDown className="size-5 shrink-0 text-muted transition group-open:rotate-180" />
							</summary>
							<p className="pb-5 pr-8 text-[15px] leading-relaxed text-muted">{f.a}</p>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}
