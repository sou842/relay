import { ApiError, badRequest } from "../api/errors.ts";
import { storeUpload } from "../media.ts";
import { rotateToken, updateSettings } from "../store/instances.ts";
import { chatHistory, getMessage, lastMessages, listChats } from "../store/journal.ts";
import { clearNotifications, countNotifications, deleteNotification, receiveNotification } from "../store/notifications.ts";
import type { MethodDef } from "./types.ts";

// Methods that behave the same for every provider: they only touch shared
// state (settings, notification queue, journal, media store).

export function requireChatId(body: Record<string, any>, pattern: RegExp): string {
	if (typeof body.chatId !== "string" || !pattern.test(body.chatId)) throw badRequest("chatId is missing or malformed");
	return body.chatId;
}

export const commonMethods: Record<string, MethodDef> = {
	// ---- account
	getSettings: {
		verb: "GET",
		handler: ({ instance, worker }) => ({ wid: worker.wid, ...instance.settings }),
	},
	setSettings: {
		verb: "POST",
		handler: ({ instance, worker, body }) => {
			updateSettings(instance.id, body);
			worker.onSettingsChanged();
			return { saveSettings: true };
		},
	},
	getStateInstance: { verb: "GET", handler: ({ worker }) => ({ stateInstance: worker.state }) },
	logout: {
		verb: "GET",
		handler: async ({ worker }) => {
			await worker.logout();
			return { isLogout: true };
		},
	},
	updateApiToken: {
		verb: "GET",
		handler: ({ instance }) => ({ apiTokenInstance: rotateToken(instance.id) }),
	},

	// ---- receiving
	receiveNotification: {
		verb: "GET",
		handler: async ({ instance, query, signal }) => {
			const timeout = Math.min(60, Math.max(5, Number(query.receiveTimeout) || 5));
			const item = await receiveNotification(instance.id, timeout, signal);
			return item ? { receiptId: item.receiptId, body: item.body } : null;
		},
	},
	deleteNotification: {
		verb: "DELETE",
		handler: ({ instance, extra }) => {
			const receiptId = Number(extra);
			if (!Number.isInteger(receiptId)) throw badRequest("receiptId is required after the token");
			return { result: deleteNotification(instance.id, receiptId) };
		},
	},
	getWebhooksCount: { verb: "GET", handler: ({ instance }) => ({ count: countNotifications(instance.id) }) },
	clearWebhooksQueue: {
		verb: "DELETE",
		handler: ({ instance }) => {
			clearNotifications(instance.id);
			return { isCleared: true };
		},
	},

	// ---- journals
	getChatHistory: {
		verb: "POST",
		handler: ({ instance, body }) => {
			if (typeof body.chatId !== "string" || !body.chatId) throw badRequest("chatId is required");
			const before = body.before != null ? Number(body.before) : undefined;
			return chatHistory(instance.id, body.chatId, Number(body.count) || 100, before);
		},
	},
	getMessage: {
		verb: "POST",
		handler: ({ instance, body }) => {
			const msg = getMessage(instance.id, String(body.chatId ?? ""), String(body.idMessage ?? ""));
			if (!msg) throw new ApiError(404, "Message not found");
			return msg;
		},
	},
	lastIncomingMessages: {
		verb: "GET",
		handler: ({ instance, query }) => lastMessages(instance.id, "incoming", Number(query.minutes) || 1440),
	},
	lastOutgoingMessages: {
		verb: "GET",
		handler: ({ instance, query }) => lastMessages(instance.id, "outgoing", Number(query.minutes) || 1440),
	},
	getChats: { verb: "GET", handler: ({ instance }) => listChats(instance.id) },

	// ---- files
	uploadFile: {
		verb: "POST",
		handler: ({ instance, baseUrl, file, body }) => {
			if (!file) throw badRequest("multipart field 'file' is required");
			const name = body["GA-Filename"] || file.filename || "file";
			return { urlFile: storeUpload(instance.id, baseUrl, file, name).urlFile };
		},
	},
};
