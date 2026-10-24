import { Pre, Rails, SectionHeading } from "./section";

const steps = [
	{
		title: "Run the gateway and the web app",
		text: "Two commands from the repository root. Point the web app at your MongoDB and you are set.",
		code: "npm run gateway\nnpm run web",
	},
	{
		title: "Create an instance and scan the code",
		text: "Sign up, click New instance, then open Linked devices on your phone and scan. Status turns to Connected.",
		code: "WhatsApp → Linked devices\n→ Link a device → scan",
	},
	{
		title: "Chat, or call the API",
		text: "Use the inbox with your team, or send from your own code with the credentials on the instance page.",
		code: 'curl -X POST ".../sendMessage/TOKEN" \\n  -d \'{"chatId":"9198…@c.us","message":"Hi"}\'',
	},
];

export function HowItWorks() {
	return (
		<section id="how" className="border-b border-line">
			<SectionHeading className="py-20" eyebrow="How it works" title="From zero to your first message in minutes" />
			<Rails className="border-t border-line">
				<ol className="grid grid-cols-1 gap-px bg-line md:grid-cols-3">
					{steps.map((s, i) => (
						<li key={s.title} className="flex min-w-0 flex-col bg-bg p-8">
							<span className="font-display text-6xl leading-none text-accent-strong/80">{String(i + 1).padStart(2, "0")}</span>
							<h3 className="mt-6 text-xl font-medium tracking-tight">{s.title}</h3>
							<p className="mt-2 leading-relaxed text-muted">{s.text}</p>
							{/* <Pre className="mt-6">{s.code}</Pre> */}
						</li>
					))}
				</ol>
			</Rails>
		</section>
	);
}
