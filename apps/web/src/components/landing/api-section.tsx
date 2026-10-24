import { Check } from "lucide-react";
import Link from "next/link";
import { CodeTabs, type CodeTab } from "./code-tabs";
import { SectionHeading } from "./section";

const tabs: CodeTab[] = [
	{
		id: "curl",
		label: "curl",
		code: `curl -X POST "http://127.0.0.1:7700/waInstance1101000001/sendMessage/YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId":"919876543210@c.us","message":"Hello from Relay"}'

# → {"idMessage":"3EB0…"}`,
	},
	{
		id: "node",
		label: "Node.js SDK",
		code: `import whatsAppClient from "@green-api/whatsapp-api-client";

const api = whatsAppClient.restAPI({
  host: "http://127.0.0.1:7700",
  media: "http://127.0.0.1:7700",
  idInstance: "1101000001",
  apiTokenInstance: "YOUR_TOKEN",
});

await api.message.sendMessage("919876543210@c.us", null, "Hello from Relay");`,
	},
	{
		id: "webhook",
		label: "Webhook payload",
		code: `{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": { "idInstance": 1101000001, "typeInstance": "whatsapp" },
  "timestamp": 1792874702,
  "idMessage": "F7AEC1B7…",
  "senderData": { "chatId": "919812345678@c.us", "senderName": "Aarav" },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": { "textMessage": "Hi, is it in stock?" }
  }
}`,
	},
];

export function ApiSection() {
	return (
		<section id="api" className="border-b border-line px-4 py-24 sm:px-10">
			<div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
				<div className="min-w-0">
					<SectionHeading className="mx-0 items-start px-0 text-left" eyebrow="HTTP API" title="Send from code in one request" />
					<p className="mt-4 text-muted sm:text-lg">
						Every instance has an id and a token. Use plain HTTP, GREEN-API&apos;s official SDK, or receive events by webhook, all against your own server.
					</p>
					<ul className="mt-6 grid gap-3 text-sm">
						{[
							"Text, files, polls, locations, contacts, reactions, edits",
							"Paced send queue to keep a human rhythm",
							"Notification queue with 24-hour retention",
							"Live event stream for custom dashboards",
						].map((t) => (
							<li key={t} className="flex items-start gap-3">
								<span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/12 text-accent-strong">
									<Check className="size-3" />
								</span>
								{t}
							</li>
						))}
					</ul>
					<Link href="/docs/api" className="lp-pill-shadow mt-8 inline-flex h-11 items-center rounded-full bg-panel px-6 text-sm font-medium transition hover:bg-panel-2">
						Read the API docs
					</Link>
				</div>
				<div className="min-w-0">
					<CodeTabs tabs={tabs} />
				</div>
			</div>
		</section>
	);
}
