import fs from "node:fs";
import path from "node:path";
import makeWASocket, {
	Browsers,
	BufferJSON,
	DisconnectReason,
	downloadMediaMessage,
	fetchLatestBaileysVersion,
	generateMessageIDV2,
	isJidGroup,
	useMultiFileAuthState,
	type AnyMessageContent,
	type ConnectionState,
	type WAMessage,
	type WAMessageKey,
	type WASocket,
} from "baileys";
import type { FastifyBaseLogger } from "fastify";
import pino from "pino";
import QRCode from "qrcode";
import { config } from "../../config.ts";
import type { InstanceState } from "../../contract/instance.ts";
import { publish } from "../../events.ts";
import { extensionFromMime, mediaDir, mediaUrl } from "../../media.ts";
import { getInstance } from "../../store/instances.ts";
import { knownName, patchMessage, rawMessage, recordMessage, recordReaction, updateStatus } from "../../store/journal.ts";
import { enqueueNotification } from "../../store/notifications.ts";
import { WebhookDispatcher } from "../../webhooks.ts";
import type { ChannelWorker } from "../types.ts";
import { toBaileysJid, toGreenChatId } from "./jid.ts";
import { isMediaMessage, senderData, toMessageData } from "./notify.ts";

type SettingsKey = keyof NonNullable<ReturnType<typeof getInstance>>["settings"];

export interface QueuedSend {
	messageID: string;
	type: string;
	body: Record<string, unknown>;
	content: AnyMessageContent;
	quotedId?: string;
}

const receiptStatus: Record<number, string> = { 0: "failed", 2: "sent", 3: "delivered", 4: "read", 5: "read" };
const callStatus: Record<string, string> = {
	offer: "offer",
	accept: "pickUp",
	reject: "declined",
	timeout: "missed",
	terminate: "hangUp",
};
const RECENT_LIMIT = 2000;
const now = () => Math.floor(Date.now() / 1000);

export class WhatsAppWorker implements ChannelWorker {
	state: InstanceState = "starting";
	sock: WASocket | undefined;
	private qr: string | undefined;
	private readonly authDir: string;
	private readonly webhooks: WebhookDispatcher;
	private readonly queue: QueuedSend[] = [];
	private sending = false;
	private stopped = false;
	private connectedAt = 0;
	private reconnectAttempts = 0;
	private readonly apiSentIds = new Set<string>();
	private readonly recent = new Map<string, WAMessage>();
	private readonly groupNames = new Map<string, string>();
	private readonly avatars = new Map<string, { url: string; at: number }>();
	private readonly stateHistory: { stateInstance: InstanceState; timestamp: number }[] = [];

	constructor(
		readonly instanceId: number,
		private readonly log: FastifyBaseLogger,
	) {
		this.authDir = path.join(config.dataDir, "instances", String(instanceId), "auth");
		this.webhooks = new WebhookDispatcher(instanceId, log);
	}

	private get settings() {
		return getInstance(this.instanceId)!.settings;
	}

	get wid(): string {
		return this.sock?.user?.id ? toGreenChatId(this.sock.user.id) : "";
	}

	get history() {
		return this.stateHistory;
	}

	async start(): Promise<void> {
		this.stopped = false;
		this.setState("starting");
		fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 });
		const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
		const version = await fetchLatestBaileysVersion()
			.then((v) => v.version)
			.catch(() => undefined);

		const sock = makeWASocket({
			auth: state,
			version,
			logger: pino({ level: "silent" }),
			browser: Browsers.windows("Desktop"),
			markOnlineOnConnect: this.settings.keepOnlineStatus === "yes",
			syncFullHistory: false,
			getMessage: async (key) => (key.id ? this.loadMessage(key.id)?.message ?? undefined : undefined),
		});
		this.sock = sock;

		sock.ev.on("creds.update", saveCreds);
		sock.ev.on("connection.update", (u) => void this.onConnectionUpdate(sock, u));
		sock.ev.on("messages.upsert", ({ messages, type }) => {
			for (const m of messages) void this.onMessage(m, type).catch((err) => this.log.error(err, "message mapping failed"));
		});
		sock.ev.on("messages.update", (updates) => {
			for (const { key, update } of updates) {
				if (!key.fromMe || update.status == null || !key.id) continue;
				const status = receiptStatus[update.status];
				if (!status) continue;
				updateStatus(this.instanceId, key.id, status);
				this.notify("outgoingWebhook", {
					typeWebhook: "outgoingMessageStatus",
					chatId: toGreenChatId(key.remoteJid),
					timestamp: now(),
					idMessage: key.id,
					status,
					sendByApi: this.apiSentIds.has(key.id),
				});
			}
		});
		sock.ev.on("presence.update", ({ id, presences }) => {
			for (const [participant, p] of Object.entries(presences)) {
				publish(this.instanceId, {
					type: "presence",
					chatId: toGreenChatId(id),
					participant: toGreenChatId(participant),
					presence: p.lastKnownPresence,
					lastSeen: p.lastSeen,
				});
			}
		});
		sock.ev.on("call", (calls) => {
			for (const call of calls) {
				const status = callStatus[call.status];
				if (!status) continue;
				this.notify("incomingCallWebhook", {
					typeWebhook: "incomingCall",
					from: toGreenChatId(call.from),
					status,
					timestamp: Math.floor(new Date(call.date).getTime() / 1000),
					idMessage: call.id,
				});
			}
		});
	}

	private async onConnectionUpdate(sock: WASocket, u: Partial<ConnectionState>) {
		if (sock !== this.sock) return;
		if (u.qr) {
			this.qr = u.qr;
			this.setState("notAuthorized");
		}
		if (u.connection === "open") {
			this.qr = undefined;
			this.connectedAt = Date.now();
			this.reconnectAttempts = 0;
			this.setState("authorized");
			this.webhooks.kick();
			void this.processQueue();
		}
		if (u.connection === "close") {
			const code = (u.lastDisconnect?.error as any)?.output?.statusCode as number | undefined;
			this.log.info({ instance: this.instanceId, code }, "whatsapp connection closed");
			if (this.stopped) return;
			if (code === DisconnectReason.loggedOut) {
				// Unlinked from the phone (or logout()); wipe the session and show a fresh QR.
				fs.rmSync(this.authDir, { recursive: true, force: true });
				this.setState("notAuthorized");
				void this.start();
			} else if (code === DisconnectReason.forbidden) {
				this.setState("blocked");
			} else {
				const delay = code === DisconnectReason.restartRequired ? 0 : Math.min(30000, 1000 * 2 ** this.reconnectAttempts++);
				setTimeout(() => !this.stopped && void this.start(), delay);
			}
		}
	}

	private setState(next: InstanceState) {
		if (next === this.state && this.stateHistory.length) return;
		this.state = next;
		this.stateHistory.push({ stateInstance: next, timestamp: now() });
		if (this.stateHistory.length > 100) this.stateHistory.shift();
		publish(this.instanceId, { type: "state", stateInstance: next });
		this.notify("stateWebhook", { typeWebhook: "stateInstanceChanged", timestamp: now(), stateInstance: next });
	}

	/** Adds the common envelope and enqueues, if the matching settings toggle is on. */
	private notify(toggle: SettingsKey, body: Record<string, unknown>) {
		if (this.settings[toggle] !== "yes") return;
		enqueueNotification(this.instanceId, {
			typeWebhook: body.typeWebhook,
			instanceData: { idInstance: this.instanceId, wid: this.wid, typeInstance: "whatsapp" },
			...body,
		});
	}

	// ---- message memory -----------------------------------------------------

	private remember(m: WAMessage) {
		if (!m.key.id) return;
		this.recent.set(m.key.id, m);
		if (this.recent.size > RECENT_LIMIT) this.recent.delete(this.recent.keys().next().value!);
	}

	/** Recent in-memory copy first, then the serialized copy in the journal. */
	loadMessage(id: string): WAMessage | undefined {
		const hit = this.recent.get(id);
		if (hit) return hit;
		const row = rawMessage(this.instanceId, id);
		if (!row?.raw) return undefined;
		try {
			return JSON.parse(row.raw, BufferJSON.reviver) as WAMessage;
		} catch {
			return undefined;
		}
	}

	/** Key of a journaled message, reconstructed if the raw copy is missing. */
	keyOf(chatId: string, id: string): WAMessageKey {
		const stored = this.loadMessage(id);
		if (stored) return stored.key;
		const row = rawMessage(this.instanceId, id);
		const fromMe = row?.direction === "outgoing";
		return {
			remoteJid: toBaileysJid(chatId),
			id,
			fromMe,
			...(chatId.endsWith("@g.us") && !fromMe && row?.senderId ? { participant: toBaileysJid(row.senderId) } : {}),
		};
	}

	private async chatName(jid: string): Promise<string> {
		if (!isJidGroup(jid)) return "";
		if (!this.groupNames.has(jid)) {
			const meta = await this.sock?.groupMetadata(jid).catch(() => undefined);
			this.groupNames.set(jid, meta?.subject ?? "");
		}
		return this.groupNames.get(jid)!;
	}

	private async onMessage(m: WAMessage, upsertType: string) {
		const jid = m.key.remoteJid;
		if (!jid || jid === "status@broadcast" || !m.message) return;
		const ts = Number(m.messageTimestamp ?? 0);
		// Skip history sync replays; only live traffic becomes notifications.
		if (upsertType !== "notify" && ts * 1000 < this.connectedAt - 60_000) return;
		this.remember(m);

		let data = toMessageData(m.message);
		if (!data) return;
		const id = m.key.id!;
		const sender = senderData(m, await this.chatName(jid));
		const senderId = m.key.fromMe ? this.wid : sender.sender;

		// The journal keeps edits/revokes on the original entry and reactions in their own table.
		if (data.typeMessage === "editedMessage") {
			const edit = data.editedMessageData as { stanzaId: string; textMessage?: string; caption?: string };
			patchMessage(this.instanceId, edit.stanzaId, {
				edited: true,
				...(edit.textMessage !== undefined ? { textMessageData: { textMessage: edit.textMessage } } : {}),
			});
			if (this.settings.editedMessageWebhook !== "yes") return;
		} else if (data.typeMessage === "deletedMessage") {
			patchMessage(this.instanceId, (data.deletedMessageData as { stanzaId: string }).stanzaId, { deleted: true });
			if (this.settings.deletedMessageWebhook !== "yes") return;
		} else if (data.typeMessage === "reactionMessage") {
			const target = (data.quotedMessage as { stanzaId: string }).stanzaId;
			const text = (data.extendedTextMessageData as { text: string }).text;
			recordReaction(this.instanceId, sender.chatId, target, senderId, text, ts);
		} else {
			if (isMediaMessage(data)) {
				const url = await this.saveMedia(m, (data.fileMessageData as { mimeType: string }).mimeType);
				data = { ...data, fileMessageData: { ...(data.fileMessageData as object), downloadUrl: url } };
			}
			recordMessage({
				instanceId: this.instanceId,
				idMessage: id,
				chatId: sender.chatId,
				direction: m.key.fromMe ? "outgoing" : "incoming",
				timestamp: ts,
				senderId,
				senderName: sender.senderName,
				chatName: sender.chatName,
				status: m.key.fromMe ? "sent" : undefined,
				sendByApi: this.apiSentIds.has(id),
				data,
				raw: JSON.stringify(m, BufferJSON.replacer),
			});
		}

		const typeWebhook = !m.key.fromMe
			? "incomingMessageReceived"
			: this.apiSentIds.has(id)
				? "outgoingAPIMessageReceived"
				: "outgoingMessageReceived";
		const toggle: SettingsKey =
			typeWebhook === "incomingMessageReceived"
				? "incomingWebhook"
				: typeWebhook === "outgoingAPIMessageReceived"
					? "outgoingAPIMessageWebhook"
					: "outgoingMessageWebhook";

		this.notify(toggle, {
			typeWebhook,
			timestamp: ts,
			idMessage: id,
			senderData: sender,
			messageData: data,
		});

		if (!m.key.fromMe && this.settings.markIncomingMessagesReaded === "yes") {
			await this.sock?.readMessages([m.key]).catch(() => undefined);
		}
	}

	private async saveMedia(m: WAMessage, mimeType: string): Promise<string> {
		try {
			const buffer = await downloadMediaMessage(m, "buffer", {});
			const fileName = `${m.key.id}.${extensionFromMime(mimeType)}`;
			fs.writeFileSync(path.join(mediaDir(this.instanceId), fileName), buffer);
			return mediaUrl(config.publicUrl || `http://${config.host}:${config.port}`, this.instanceId, fileName);
		} catch (err) {
			this.log.warn({ instance: this.instanceId, err: (err as Error).message }, "media download failed");
			return "";
		}
	}

	// ---- account -----------------------------------------------------------

	async qrPng(): Promise<string | undefined> {
		if (!this.qr) return undefined;
		const dataUrl = await QRCode.toDataURL(this.qr, { margin: 1, width: 264 });
		return dataUrl.replace(/^data:image\/png;base64,/, "");
	}

	async pairingCode(phoneNumber: string): Promise<string> {
		if (!this.sock) throw new Error("Instance is starting");
		return this.sock.requestPairingCode(phoneNumber.replace(/\D/g, ""));
	}

	async logout(): Promise<void> {
		// Baileys emits close/loggedOut, which wipes the session and restarts for a new QR.
		await this.sock?.logout().catch(() => undefined);
	}

	async reboot(): Promise<void> {
		await this.stop();
		void this.start();
	}

	async stop(): Promise<void> {
		this.stopped = true;
		this.sock?.end(undefined);
		this.sock = undefined;
	}

	dispose(): void {
		this.webhooks.stop();
		void this.stop();
	}

	onSettingsChanged(): void {
		this.webhooks.kick();
	}

	// ---- chat operations (require an authorized socket) ---------------------

	private get live(): WASocket {
		if (this.state !== "authorized" || !this.sock) throw new Error(`Instance is ${this.state}, not authorized`);
		return this.sock;
	}

	async editMessage(chatId: string, id: string, text: string): Promise<void> {
		await this.live.sendMessage(toBaileysJid(chatId), { text, edit: this.keyOf(chatId, id) });
	}

	async deleteForEveryone(chatId: string, id: string): Promise<void> {
		await this.live.sendMessage(toBaileysJid(chatId), { delete: this.keyOf(chatId, id) });
	}

	async react(chatId: string, id: string, reaction: string): Promise<void> {
		await this.live.sendMessage(toBaileysJid(chatId), { react: { text: reaction, key: this.keyOf(chatId, id) } });
	}

	async markRead(entries: { chatId: string; idMessage: string }[]): Promise<void> {
		if (!entries.length) return;
		await this.live.readMessages(entries.map((e) => this.keyOf(e.chatId, e.idMessage)));
	}

	async subscribePresence(chatId: string): Promise<void> {
		await this.live.presenceSubscribe(toBaileysJid(chatId));
	}

	async avatar(chatId: string): Promise<string> {
		const cached = this.avatars.get(chatId);
		if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.url;
		const url = (await this.live.profilePictureUrl(toBaileysJid(chatId), "image").catch(() => undefined)) ?? "";
		this.avatars.set(chatId, { url, at: Date.now() });
		return url;
	}

	async contactInfo(chatId: string) {
		const jid = toBaileysJid(chatId);
		const status = (await this.live.fetchStatus(jid).catch(() => undefined)) as any;
		const about = Array.isArray(status) ? status[0]?.status?.status : status?.status;
		return {
			chatId,
			name: knownName(this.instanceId, chatId),
			contactName: "",
			avatar: await this.avatar(chatId),
			about: typeof about === "string" ? about : "",
			isBusiness: false,
			isArchive: false,
			isMute: false,
		};
	}

	async groupData(groupId: string) {
		const meta = await this.live.groupMetadata(toBaileysJid(groupId));
		return {
			groupId: meta.id,
			owner: toGreenChatId(meta.owner),
			subject: meta.subject,
			description: meta.desc ?? "",
			creation: meta.creation ?? 0,
			size: meta.participants.length,
			participants: meta.participants.map((p) => ({
				id: toGreenChatId((p as { phoneNumber?: string }).phoneNumber ?? p.id),
				isAdmin: p.admin === "admin" || p.admin === "superadmin",
				isSuperAdmin: p.admin === "superadmin",
			})),
		};
	}

	// ---- sending -----------------------------------------------------------

	enqueueSend(type: string, body: Record<string, unknown>, content: AnyMessageContent, quotedId?: string): string {
		const messageID = generateMessageIDV2(this.sock?.user?.id);
		this.queue.push({ messageID, type, body, content, quotedId });
		void this.processQueue();
		return messageID;
	}

	showQueue() {
		return this.queue.map(({ messageID, type, body }) => ({ messageID, type, body }));
	}

	clearQueue(): void {
		this.queue.length = 0;
	}

	private async processQueue(): Promise<void> {
		if (this.sending) return;
		this.sending = true;
		try {
			while (this.queue.length && this.state === "authorized" && this.sock) {
				const job = this.queue[0];
				const jid = toBaileysJid(String(job.body.chatId));
				this.apiSentIds.add(job.messageID);
				if (this.apiSentIds.size > RECENT_LIMIT) this.apiSentIds.delete(this.apiSentIds.values().next().value!);
				try {
					const quoted = job.quotedId ? this.loadMessage(job.quotedId) : undefined;
					const sent = await this.sock.sendMessage(jid, job.content, { messageId: job.messageID, quoted });
					if (sent) this.remember(sent);
				} catch (err) {
					this.log.warn({ instance: this.instanceId, err: (err as Error).message }, "send failed");
					recordMessage({
						instanceId: this.instanceId,
						idMessage: job.messageID,
						chatId: String(job.body.chatId),
						direction: "outgoing",
						timestamp: now(),
						senderId: this.wid,
						senderName: "",
						chatName: "",
						status: "failed",
						sendByApi: true,
						data: {
							typeMessage: "textMessage",
							textMessageData: { textMessage: String(job.body.message ?? job.body.caption ?? `[${job.type}]`) },
						},
					});
					this.notify("outgoingWebhook", {
						typeWebhook: "outgoingMessageStatus",
						chatId: job.body.chatId,
						timestamp: now(),
						idMessage: job.messageID,
						status: "failed",
						description: (err as Error).message,
						sendByApi: true,
					});
				}
				this.queue.shift();
				if (this.queue.length) {
					await new Promise((r) => setTimeout(r, Number(this.settings.delaySendMessagesMilliseconds) || 0));
				}
			}
		} finally {
			this.sending = false;
		}
	}
}
