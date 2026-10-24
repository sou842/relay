import { chatPhone, formatPhone } from "@/lib/utils";
import type { Chat, Message, QuotedMessage } from "./types";

export const isGroup = (chatId: string) => chatId.endsWith("@g.us");

export function chatTitle(chat: Pick<Chat, "id" | "name">, selfId: string): string {
	if (chat.id === selfId) return `${formatPhone(chatPhone(chat.id))} (You)`;
	if (chat.name) return chat.name;
	return isGroup(chat.id) ? "Group" : formatPhone(chatPhone(chat.id));
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function timeOfDay(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Chat list stamp: time today, "Yesterday", weekday within a week, else a date. */
export function listStamp(ts: number): string {
	const d = new Date(ts * 1000);
	const now = new Date();
	if (sameDay(d, now)) return timeOfDay(ts);
	const y = new Date(now);
	y.setDate(now.getDate() - 1);
	if (sameDay(d, y)) return "Yesterday";
	if (now.getTime() - d.getTime() < 6 * 86400_000) return d.toLocaleDateString([], { weekday: "long" });
	return d.toLocaleDateString();
}

/** Day separator inside a conversation. */
export function dayLabel(ts: number): string {
	const d = new Date(ts * 1000);
	const now = new Date();
	if (sameDay(d, now)) return "Today";
	const y = new Date(now);
	y.setDate(now.getDate() - 1);
	if (sameDay(d, y)) return "Yesterday";
	if (now.getTime() - d.getTime() < 6 * 86400_000) return d.toLocaleDateString([], { weekday: "long" });
	return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

export function lastSeenLabel(lastSeen?: number): string {
	if (!lastSeen) return "";
	return `last seen ${dayLabel(lastSeen).toLowerCase()} at ${timeOfDay(lastSeen)}`;
}

const kindLabel: Record<string, string> = {
	imageMessage: "Photo",
	videoMessage: "Video",
	audioMessage: "Audio",
	documentMessage: "Document",
	stickerMessage: "Sticker",
	locationMessage: "Location",
	contactMessage: "Contact",
	contactsArrayMessage: "Contacts",
	pollMessage: "Poll",
};

export const kindIcon: Record<string, string> = {
	imageMessage: "📷",
	videoMessage: "🎥",
	audioMessage: "🎤",
	documentMessage: "📄",
	stickerMessage: "💟",
	locationMessage: "📍",
	contactMessage: "👤",
	contactsArrayMessage: "👥",
	pollMessage: "📊",
};

export function previewText(type: string | undefined, text: string | undefined): string {
	if (!type) return "";
	if (type === "textMessage" || type === "extendedTextMessage" || type === "quotedMessage") return text ?? "";
	const label = kindLabel[type] ?? "Message";
	return `${kindIcon[type] ?? ""} ${text || label}`.trim();
}

export function messagePreview(m: Message): string {
	if (m.deleted) return "This message was deleted";
	if (m.typeMessage === "pollMessage") return `📊 ${m.pollMessageData?.name ?? "Poll"}`;
	return previewText(m.typeMessage, m.textMessage ?? m.caption ?? m.fileName);
}

export function quotedText(q: QuotedMessage): string {
	const text = q.textMessage ?? q.textMessageData?.textMessage ?? q.extendedTextMessageData?.text ?? q.caption ?? q.fileMessageData?.caption;
	return previewText(q.typeMessage ?? "textMessage", text);
}

/** Stable per-person color for group sender names, like WhatsApp Web. */
const senderColors = ["#06cf9c", "#25d366", "#53bdeb", "#a5b337", "#fa6533", "#ff2e74", "#c4532d", "#7f66ff", "#e542a3", "#02a698", "#5e47de", "#d3a91d"];
export function senderColor(id: string): string {
	let h = 0;
	for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return senderColors[h % senderColors.length];
}

export function fileSizeLabel(bytes?: number): string {
	if (!bytes) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
