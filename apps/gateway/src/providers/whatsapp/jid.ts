import { jidNormalizedUser } from "baileys";

// GREEN-API speaks WhatsApp Web's legacy ids ("79001234567@c.us"); Baileys uses
// "79001234567@s.whatsapp.net". Groups are "@g.us" in both.

export function toBaileysJid(chatId: string): string {
	const id = chatId.trim();
	if (id.endsWith("@c.us")) return id.replace(/@c\.us$/, "@s.whatsapp.net");
	if (/^\d+$/.test(id)) return `${id}@s.whatsapp.net`;
	return id;
}

export function toGreenChatId(jid: string | null | undefined): string {
	if (!jid) return "";
	const normalized = jidNormalizedUser(jid);
	return normalized.endsWith("@s.whatsapp.net") ? normalized.replace(/@s\.whatsapp\.net$/, "@c.us") : normalized;
}

export function isValidChatId(chatId: unknown): chatId is string {
	return typeof chatId === "string" && /^(\d{5,20}@c\.us|[\d-]+@g\.us)$/.test(chatId);
}
