import type { AnyMessageContent } from "baileys";
import { ApiError, badRequest } from "../../api/errors.ts";
import { mimeFromFileName, storeUpload } from "../../media.ts";
import { markChatRead } from "../../store/journal.ts";
import { requireChatId as requireChatIdLike } from "../common-methods.ts";
import type { MethodContext, MethodDef } from "../types.ts";
import { isValidChatId, toBaileysJid } from "./jid.ts";
import type { WhatsAppWorker } from "./worker.ts";

// WhatsApp-specific methods. Shared ones (settings, notifications, journal,
// uploadFile) come from common-methods.ts. Names and shapes follow the
// GREEN-API contract; methods marked "extension" are ours.

type Ctx = MethodContext<WhatsAppWorker>;
type Def = MethodDef<WhatsAppWorker>;

const MAX_TEXT = 20000;
const CHAT_ID = /^(\d{5,20}@c\.us|[\d-]+@g\.us)$/;

const requireChatId = (body: Record<string, any>) => requireChatIdLike(body, CHAT_ID);

function requireGroupId(body: Record<string, any>): string {
	if (typeof body.groupId !== "string" || !body.groupId.endsWith("@g.us")) throw badRequest("groupId must look like 123-456@g.us");
	return body.groupId;
}

function requireText(value: unknown, field: string): string {
	if (typeof value !== "string" || !value) throw badRequest(`${field} is required`);
	if (value.length > MAX_TEXT) throw badRequest(`${field} exceeds ${MAX_TEXT} characters`);
	return value;
}

function requireAuthorized(worker: WhatsAppWorker) {
	if (worker.state !== "authorized") throw new ApiError(400, `Instance is ${worker.state}, not authorized`);
}

function queueSend(ctx: Ctx, type: string, content: AnyMessageContent) {
	requireAuthorized(ctx.worker);
	const quotedId = typeof ctx.body.quotedMessageId === "string" ? ctx.body.quotedMessageId : undefined;
	return { idMessage: ctx.worker.enqueueSend(type, ctx.body, content, quotedId) };
}

function mediaContent(mimetype: string, media: { url: string } | Buffer, fileName: string, caption?: string, ptt = false): AnyMessageContent {
	if (mimetype.startsWith("image/")) return { image: media, caption };
	if (mimetype.startsWith("video/")) return { video: media, caption };
	if (mimetype.startsWith("audio/")) {
		// Phones only play push-to-talk notes encoded as Ogg/Opus; other audio goes as a normal file.
		const voice = ptt && mimetype.includes("ogg");
		return { audio: media, mimetype: voice ? "audio/ogg; codecs=opus" : mimetype, ptt: voice };
	}
	return { document: media, fileName, mimetype, caption };
}

function vcard(contact: Record<string, any>): string {
	const phone = String(contact.phoneContact ?? "").replace(/\D/g, "");
	const name = [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(" ") || phone;
	return [
		"BEGIN:VCARD",
		"VERSION:3.0",
		`FN:${name}`,
		`N:${contact.lastName ?? ""};${contact.firstName ?? ""};${contact.middleName ?? ""};;`,
		contact.company ? `ORG:${contact.company}` : "",
		`TEL;type=CELL;waid=${phone}:+${phone}`,
		"END:VCARD",
	]
		.filter(Boolean)
		.join("\n");
}

export const whatsappMethods: Record<string, Def> = {
	// ---- account
	getStateInstanceHistory: { verb: "GET", handler: ({ worker }) => worker.history },
	getWaSettings: {
		verb: "GET",
		handler: async ({ worker }) => ({
			avatar: worker.wid && worker.state === "authorized" ? await worker.avatar(worker.wid) : "",
			phone: worker.wid.replace(/@c\.us$/, ""),
			stateInstance: worker.state,
			deviceId: worker.sock?.authState.creds.me?.id ?? "",
		}),
	},
	reboot: {
		verb: "GET",
		handler: async ({ worker }) => {
			await worker.reboot();
			return { isReboot: true };
		},
	},
	qr: {
		verb: "GET",
		handler: async ({ worker }) => {
			if (worker.state === "authorized") return { type: "alreadyLogged", message: "instance account already authorized" };
			const png = await worker.qrPng();
			if (!png) return { type: "error", message: `QR not available yet, instance is ${worker.state}` };
			return { type: "qrCode", message: png };
		},
	},
	getAuthorizationCode: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			if (worker.state === "authorized") throw badRequest("Instance is already authorized");
			if (!body.phoneNumber) throw badRequest("phoneNumber is required");
			return { status: true, code: await worker.pairingCode(String(body.phoneNumber)) };
		},
	},

	// ---- sending
	sendMessage: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			const text = requireText(ctx.body.message, "message");
			return queueSend(ctx, "sendMessage", { text, linkPreview: ctx.body.linkPreview === false ? null : undefined });
		},
	},
	sendFileByUrl: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			const { urlFile, fileName, caption } = ctx.body;
			if (typeof urlFile !== "string" || !/^https?:\/\//.test(urlFile)) throw badRequest("urlFile must be an http(s) URL");
			if (typeof fileName !== "string" || !fileName) throw badRequest("fileName is required");
			return queueSend(ctx, "sendFileByUrl", mediaContent(mimeFromFileName(fileName), { url: urlFile }, fileName, caption));
		},
	},
	sendFileByUpload: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			if (!ctx.file) throw badRequest("multipart field 'file' is required");
			const fileName = String(ctx.body.fileName || ctx.file.filename || "file");
			const stored = storeUpload(ctx.instance.id, ctx.baseUrl, ctx.file, fileName);
			// Extension: voiceNote=true sends audio as a push-to-talk voice message.
			const ptt = ctx.body.voiceNote === "true" || ctx.body.voiceNote === true;
			const content = mediaContent(stored.mimetype, ctx.file.buffer, fileName, ctx.body.caption || undefined, ptt);
			return { ...queueSend(ctx, "sendFileByUpload", content), urlFile: stored.urlFile };
		},
	},
	sendLocation: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			const { latitude, longitude, nameLocation, address } = ctx.body;
			if (typeof latitude !== "number" || typeof longitude !== "number") throw badRequest("latitude and longitude must be numbers");
			return queueSend(ctx, "sendLocation", {
				location: { degreesLatitude: latitude, degreesLongitude: longitude, name: nameLocation, address },
			});
		},
	},
	sendContact: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			const contact = ctx.body.contact;
			if (!contact?.phoneContact) throw badRequest("contact.phoneContact is required");
			const displayName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || String(contact.phoneContact);
			return queueSend(ctx, "sendContact", { contacts: { displayName, contacts: [{ displayName, vcard: vcard(contact) }] } });
		},
	},
	sendPoll: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			const { options, multipleAnswers } = ctx.body;
			const message = requireText(ctx.body.message, "message");
			if (!Array.isArray(options) || options.length < 2 || options.length > 12) throw badRequest("options must have 2-12 entries");
			return queueSend(ctx, "sendPoll", {
				poll: { name: message, values: options.map((o: any) => String(o.optionName)), selectableCount: multipleAnswers ? 0 : 1 },
			});
		},
	},
	forwardMessages: {
		verb: "POST",
		handler: (ctx) => {
			requireChatId(ctx.body);
			const { chatIdFrom, messages } = ctx.body;
			if (typeof chatIdFrom !== "string" || !isValidChatId(chatIdFrom)) throw badRequest("chatIdFrom is required");
			if (!Array.isArray(messages) || !messages.length) throw badRequest("messages must be a non-empty array of ids");
			requireAuthorized(ctx.worker);
			const ids = messages.map((id: unknown) => {
				const original = ctx.worker.loadMessage(String(id));
				if (!original) throw badRequest(`Message ${id} is not in the journal`);
				return ctx.worker.enqueueSend("ForwardMessages", ctx.body, { forward: original });
			});
			return { messages: ids };
		},
	},
	sendTyping: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			requireAuthorized(worker);
			const jid = toBaileysJid(requireChatId(body));
			const presence = body.typingType === "recording" ? "recording" : "composing";
			await worker.sock!.sendPresenceUpdate(presence, jid);
			const ms = Math.min(Number(body.typingTime) || 5000, 20000);
			setTimeout(() => void worker.sock?.sendPresenceUpdate("paused", jid).catch(() => undefined), ms);
			return {};
		},
	},
	// Extension: emoji reaction; an empty reaction removes it.
	sendReaction: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			const chatId = requireChatId(body);
			if (typeof body.idMessage !== "string") throw badRequest("idMessage is required");
			await worker.react(chatId, body.idMessage, typeof body.reaction === "string" ? body.reaction : "");
			return { sendReaction: true };
		},
	},
	editMessage: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			const chatId = requireChatId(body);
			if (typeof body.idMessage !== "string") throw badRequest("idMessage is required");
			await worker.editMessage(chatId, body.idMessage, requireText(body.message, "message"));
			return { idMessage: body.idMessage };
		},
	},
	deleteMessage: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			const chatId = requireChatId(body);
			if (typeof body.idMessage !== "string") throw badRequest("idMessage is required");
			await worker.deleteForEveryone(chatId, body.idMessage);
			return {};
		},
	},

	// ---- queues
	showMessagesQueue: { verb: "GET", handler: ({ worker }) => worker.showQueue() },
	clearMessagesQueue: {
		verb: "GET",
		handler: ({ worker }) => {
			worker.clearQueue();
			return { isCleared: true };
		},
	},

	// ---- service
	checkWhatsapp: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			requireAuthorized(worker);
			const phone = String(body.phoneNumber ?? "").replace(/\D/g, "");
			if (!phone) throw badRequest("phoneNumber is required");
			const [hit] = (await worker.sock!.onWhatsApp(phone)) ?? [];
			return { existsWhatsapp: Boolean(hit?.exists) };
		},
	},
	getAvatar: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			const url = await worker.avatar(requireChatId(body));
			return { urlAvatar: url, available: Boolean(url) };
		},
	},
	getContactInfo: {
		verb: "POST",
		handler: ({ worker, body }) => worker.contactInfo(requireChatId(body)),
	},
	getGroupData: {
		verb: "POST",
		handler: ({ worker, body }) => worker.groupData(requireGroupId(body)),
	},
	readChat: {
		verb: "POST",
		handler: async ({ instance, worker, body }) => {
			const chatId = requireChatId(body);
			// Without idMessage the whole chat is marked read (GREEN-API semantics).
			const unread = markChatRead(instance.id, chatId);
			const targets = body.idMessage ? unread.filter((u) => u.idMessage === body.idMessage) : unread;
			if (worker.state === "authorized") await worker.markRead(targets).catch(() => undefined);
			return { setRead: true };
		},
	},
	// Extension: ask WhatsApp to push online/typing updates for a chat (delivered over the event stream).
	subscribePresence: {
		verb: "POST",
		handler: async ({ worker, body }) => {
			await worker.subscribePresence(requireChatId(body));
			return { subscribed: true };
		},
	},
};
