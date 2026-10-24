import { getContentType, normalizeMessageContent, type WAMessage, type proto } from "baileys";
import { toGreenChatId } from "./jid.ts";

// Translates Baileys messages into GREEN-API's `messageData` shapes
// (src/contract/messages.ts, WebhookMessageData). Unhandled kinds return null.

export type MessageData = Record<string, unknown> & { typeMessage: string };

function forwardInfo(ctx: proto.IContextInfo | null | undefined) {
	return { isForwarded: Boolean(ctx?.isForwarded), forwardingScore: ctx?.forwardingScore ?? 0 };
}

function thumb(bytes: Uint8Array | null | undefined): string {
	return bytes ? Buffer.from(bytes).toString("base64") : "";
}

function quoted(ctx: proto.IContextInfo | null | undefined): Record<string, unknown> | undefined {
	if (!ctx?.stanzaId || !ctx.quotedMessage) return undefined;
	const inner = toMessageData(ctx.quotedMessage);
	return {
		stanzaId: ctx.stanzaId,
		participant: toGreenChatId(ctx.participant),
		...(inner ?? { typeMessage: "unknownMessage" }),
	};
}

export function toMessageData(raw: proto.IMessage | null | undefined, downloadUrl = ""): MessageData | null {
	const message = normalizeMessageContent(raw);
	if (!message) return null;
	const type = getContentType(message);

	switch (type) {
		case "conversation":
			return { typeMessage: "textMessage", textMessageData: { textMessage: message.conversation ?? "" } };

		case "extendedTextMessage": {
			const m = message.extendedTextMessage!;
			const q = quoted(m.contextInfo);
			const data = {
				text: m.text ?? "",
				description: m.description ?? "",
				title: m.title ?? "",
				previewType: m.previewType ? "Image" : "None",
				jpegThumbnail: thumb(m.jpegThumbnail),
				...forwardInfo(m.contextInfo),
			};
			if (q) return { typeMessage: "quotedMessage", extendedTextMessageData: data, quotedMessage: q };
			return { typeMessage: "extendedTextMessage", extendedTextMessageData: data };
		}

		case "imageMessage":
		case "videoMessage":
		case "audioMessage":
		case "documentMessage":
		case "stickerMessage": {
			const m = message[type]! as proto.Message.IImageMessage &
				proto.Message.IDocumentMessage &
				proto.Message.IStickerMessage;
			const q = quoted(m.contextInfo);
			return {
				typeMessage: type,
				fileMessageData: {
					downloadUrl,
					caption: m.caption ?? "",
					fileName: m.fileName ?? "",
					jpegThumbnail: thumb(m.jpegThumbnail),
					mimeType: m.mimetype ?? "",
					...(type === "stickerMessage" ? { isAnimated: Boolean(m.isAnimated) } : {}),
					...forwardInfo(m.contextInfo),
				},
				...(q ? { quotedMessage: q } : {}),
			};
		}

		case "locationMessage": {
			const m = message.locationMessage!;
			return {
				typeMessage: "locationMessage",
				locationMessageData: {
					nameLocation: m.name ?? "",
					address: m.address ?? "",
					latitude: m.degreesLatitude ?? 0,
					longitude: m.degreesLongitude ?? 0,
					jpegThumbnail: thumb(m.jpegThumbnail),
					...forwardInfo(m.contextInfo),
				},
			};
		}

		case "contactMessage": {
			const m = message.contactMessage!;
			return {
				typeMessage: "contactMessage",
				contactMessageData: { displayName: m.displayName ?? "", vcard: m.vcard ?? "", ...forwardInfo(m.contextInfo) },
			};
		}

		case "contactsArrayMessage": {
			const m = message.contactsArrayMessage!;
			return {
				typeMessage: "contactsArrayMessage",
				messageData: {
					contacts: (m.contacts ?? []).map((c) => ({ displayName: c.displayName ?? "", vcard: c.vcard ?? "" })),
					...forwardInfo(m.contextInfo),
				},
			};
		}

		case "reactionMessage": {
			const m = message.reactionMessage!;
			return {
				typeMessage: "reactionMessage",
				extendedTextMessageData: { text: m.text ?? "" },
				quotedMessage: { stanzaId: m.key?.id ?? "", participant: toGreenChatId(m.key?.participant ?? m.key?.remoteJid) },
			};
		}

		case "protocolMessage": {
			const m = message.protocolMessage!;
			if (m.type === 0 /* REVOKE */) {
				return { typeMessage: "deletedMessage", deletedMessageData: { stanzaId: m.key?.id ?? "" } };
			}
			if (m.type === 14 /* MESSAGE_EDIT */) {
				const edited = normalizeMessageContent(m.editedMessage);
				return {
					typeMessage: "editedMessage",
					editedMessageData: {
						stanzaId: m.key?.id ?? "",
						textMessage: edited?.conversation ?? edited?.extendedTextMessage?.text ?? undefined,
						caption: edited?.imageMessage?.caption ?? edited?.videoMessage?.caption ?? undefined,
					},
				};
			}
			return null;
		}

		case "pollCreationMessage":
		case "pollCreationMessageV2":
		case "pollCreationMessageV3": {
			const m = message[type]!;
			return {
				typeMessage: "pollMessage",
				pollMessageData: {
					name: m.name ?? "",
					options: (m.options ?? []).map((o) => ({ optionName: o.optionName ?? "" })),
					multipleAnswers: (m.selectableOptionsCount ?? 0) !== 1,
				},
			};
		}

		default:
			return null;
	}
}

export function isMediaMessage(data: MessageData | null): boolean {
	return Boolean(data && "fileMessageData" in data);
}

export function senderData(msg: WAMessage, chatName: string) {
	const key = msg.key;
	// Baileys v7 may address chats by LID; the "*Alt" fields carry the phone-number JID when known.
	const chatJid = key.remoteJidAlt && key.remoteJid?.endsWith("@lid") ? key.remoteJidAlt : key.remoteJid;
	const participant = key.participantAlt && key.participant?.endsWith("@lid") ? key.participantAlt : key.participant;
	const chatId = toGreenChatId(chatJid);
	const sender = toGreenChatId(participant || chatJid);
	return {
		chatId,
		chatName: chatName || msg.pushName || "",
		sender,
		senderName: msg.pushName ?? "",
		senderContactName: "",
	};
}
