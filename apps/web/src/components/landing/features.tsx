import { Check, Code2, Layers, MessagesSquare, QrCode, ShieldCheck, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pre, Rails, SectionHeading } from "./section";

function Card({ className, icon: Icon, title, text, children }: { className?: string; icon: React.ComponentType<{ className?: string }>; title: string; text: string; children?: React.ReactNode }) {
	return (
		<div className={cn("group relative flex min-w-0 flex-col overflow-hidden bg-bg p-8 transition-colors hover:bg-panel/60", className)}>
			<div className="text-accent-strong">
				<Icon className="size-[22px]" />
			</div>
			<h3 className="mt-5 text-xl font-medium tracking-tight">{title}</h3>
			<p className="mt-2 leading-relaxed text-muted">{text}</p>
			{children && <div className="mt-6 flex-1">{children}</div>}
		</div>
	);
}

const inboxFeatures = ["Reply", "React", "Edit", "Forward", "Delete for everyone", "Voice notes", "Photos & video", "Documents", "Polls", "Locations", "Contacts", "Emoji", "Typing & online", "Read ticks"];

// Decorative pseudo-QR: fixed pattern, not a real code.
const qrCells = (() => {
	let seed = 7;
	const size = 11;
	return Array.from({ length: size * size }, (_, i) => {
		const x = i % size;
		const y = Math.floor(i / size);
		const finder = (x < 3 && y < 3) || (x > size - 4 && y < 3) || (x < 3 && y > size - 4);
		seed = (seed * 48271) % 2147483647;
		return finder || seed % 100 < 46;
	});
})();

const events = [
	{ type: "incomingMessageReceived", detail: "“Hi, is it in stock?”" },
	{ type: "outgoingMessageStatus", detail: "delivered → read" },
	{ type: "stateInstanceChanged", detail: "authorized" },
];

export function Features() {
	return (
		<section id="features" className="border-b border-line">
			<SectionHeading
				eyebrow="Features"
				title="Everything between your phone and your code"
				text="A real inbox for people, a clean API for programs, and a gateway you run yourself."
				className="py-20"
			/>

			<Rails className="border-t border-line">
			<div className="grid grid-cols-1 gap-px bg-line md:grid-cols-6">
				<Card className="md:col-span-4" icon={MessagesSquare} title="A familiar inbox in any browser" text="Search, filters, unread badges, replies with quotes, reactions, drag-and-drop uploads, and live updates without refreshing.">
					<div className="flex flex-wrap gap-2">
						{inboxFeatures.map((f) => (
							<span key={f} className="lp-pill-shadow rounded-full bg-panel px-3 py-1 text-xs text-muted">
								{f}
							</span>
						))}
					</div>
					{/* illustration: a quoted reply with a reaction */}
					<div aria-hidden className="mt-6 grid max-w-md gap-1.5 text-[13px]">
						<div className="w-fit max-w-[80%] rounded-2xl rounded-tl-sm bg-panel-2 px-3.5 py-2">Can you resend the invoice?</div>
						<div className="relative ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2 text-accent-fg">
							<div className="mb-1 rounded-md border-l-2 border-white/60 bg-white/10 px-2 py-1 text-[11px] text-white/80">Can you resend the invoice?</div>
							Sent! Check your inbox 📨
							<span className="absolute -bottom-3 left-2 rounded-full border border-line bg-panel px-1.5 text-xs shadow-sm">👍</span>
						</div>
					</div>
				</Card>

				<Card className="md:col-span-2" icon={QrCode} title="Link in seconds" text="Scan a QR code or type a phone code. Sessions survive restarts.">
					<div aria-hidden className="mx-auto grid w-fit grid-cols-11 gap-[3px] rounded-2xl bg-white p-3 shadow-inner ring-1 ring-black/10">
						{qrCells.map((on, i) => (
							<span key={i} className={cn("size-[9px] rounded-[2px]", on ? "bg-[#12132a]" : "bg-transparent")} />
						))}
					</div>
				</Card>

				<Card className="md:col-span-2" icon={Code2} title="GREEN-API compatible" text="Same URLs, methods and payloads, so existing SDKs and scripts keep working.">
					<Pre>{`POST /waInstance{id}/sendMessage/{token}
{
  "chatId": "9198…@c.us",
  "message": "Hello"
}`}</Pre>
				</Card>

				<Card className="md:col-span-4" icon={Webhook} title="Webhooks or polling, never lost" text="Every message, status and call becomes a notification. Pull them with receiveNotification, or let the gateway push to your URL and retry until you answer 2xx.">
					<ul className="grid gap-2">
						{events.map((e) => (
							<li key={e.type} className="flex items-center justify-between gap-3 lp-pill-shadow rounded-xl bg-panel px-4 py-2.5 text-xs">
								<code className="font-mono text-accent-strong">{e.type}</code>
								<span className="truncate text-muted">{e.detail}</span>
							</li>
						))}
					</ul>
				</Card>

				<Card className="md:col-span-3" icon={ShieldCheck} title="Yours to run" text="Sessions, history and media stay on your machine. Instance tokens never reach the browser, and every call is checked against the signed-in account.">
					<ul className="grid gap-2 text-sm">
						{["Runs on a PC, a Pi or a free cloud VM", "Per-account isolation", "Rotate tokens any time"].map((t) => (
							<li key={t} className="flex items-center gap-2">
								<Check className="size-4 text-accent-strong" /> {t}
							</li>
						))}
					</ul>
				</Card>

				<Card className="md:col-span-3" icon={Layers} title="Built for more than one messenger" text="Messengers are providers behind one interface. WhatsApp ships today; Telegram is next, without rewriting the apps.">
					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
							<div className="text-sm font-medium">WhatsApp</div>
							<div className="text-xs text-accent-strong">Available</div>
						</div>
						<div className="rounded-xl border border-dashed border-line p-3">
							<div className="text-sm font-medium">Telegram</div>
							<div className="text-xs text-muted">Planned</div>
						</div>
					</div>
				</Card>
			</div>
			</Rails>
		</section>
	);
}
