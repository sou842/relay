import { BookOpen, Code2, MessageSquareText, QrCode, Rocket, Server, ShieldCheck, Webhook } from "lucide-react";

export const DOCS_SECTIONS = [
	{
		title: "Introduction",
		pages: [
			{ href: "/docs", title: "Overview", icon: BookOpen },
			{ href: "/docs/getting-started", title: "Getting started", icon: Rocket },
		],
	},
	{
		title: "Using Relay",
		pages: [
			{ href: "/docs/linking", title: "Linking WhatsApp", icon: QrCode },
			{ href: "/docs/chat", title: "Using the chat", icon: MessageSquareText },
		],
	},
	{
		title: "Developers",
		pages: [
			{ href: "/docs/api", title: "HTTP API", icon: Code2 },
			{ href: "/docs/webhooks", title: "Receiving messages", icon: Webhook },
		],
	},
	{
		title: "Operations",
		pages: [
			{ href: "/docs/self-hosting", title: "Self-hosting & access", icon: Server },
			{ href: "/docs/safety", title: "Staying safe", icon: ShieldCheck },
		],
	},
];

export const DOCS_PAGES = DOCS_SECTIONS.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.title })));
