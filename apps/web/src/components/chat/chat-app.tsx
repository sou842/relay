"use client";

import { Loader2, MessageSquarePlus, SlidersHorizontal, WifiOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/dialog";
import { Button, buttonClass } from "@/components/ui";
import { callMethod } from "@/lib/client-api";
import { useMethod } from "@/lib/swr";
import type { InstanceSummary } from "@/lib/instances";
import { useInstanceEvents, type LiveEvent } from "@/lib/use-instance-events";
import { chatPhone, cn, formatPhone } from "@/lib/utils";
import { ContactDialog, ForwardDialog, LocationDialog, NewChatDialog, PollDialog } from "./chat-dialogs";
import { ChatList } from "./chat-list";
import { ContactInfoPanel } from "./contact-info";
import type { ComposerActions } from "./composer";
import { Conversation } from "./conversation";
import { chatTitle, isGroup } from "./format";
import { EmptyChatsArt } from "./icons";
import { Lightbox } from "./lightbox";
import { NavRail } from "./nav-rail";
import type { MessageAction } from "./message-bubble";
import type { Chat, Message, Presence } from "./types";

const PAGE = 50;
const now = () => Math.floor(Date.now() / 1000);

function sortChats(chats: Chat[]) {
	return [...chats].sort((a, b) => (b.lastMessageTime ?? Infinity) - (a.lastMessageTime ?? Infinity));
}

function upsertMessage(list: Message[], m: Message): Message[] {
	const i = list.findIndex((x) => x.idMessage === m.idMessage);
	if (i >= 0) {
		const next = [...list];
		// Keep reactions gathered locally; the journal copy carries them too once stored.
		next[i] = { ...list[i], ...m, local: false };
		return next;
	}
	const next = [...list, m];
	next.sort((a, b) => a.timestamp - b.timestamp);
	return next;
}

function mediaType(file: File): string {
	if (file.type.startsWith("image/")) return "imageMessage";
	if (file.type.startsWith("video/")) return "videoMessage";
	if (file.type.startsWith("audio/")) return "audioMessage";
	return "documentMessage";
}

export function ChatApp({ instance }: { instance: InstanceSummary }) {
	const id = instance.id;
	const { data: stateRes, error: stateError, mutate: mutateState } = useMethod<{ stateInstance: string }>(id, "getStateInstance");
	const state = stateError ? "offline" : (stateRes?.stateInstance ?? "starting");
	const { data: waSettings } = useMethod<{ phone: string }>(state === "authorized" ? id : null, "getWaSettings");
	const selfPhone = waSettings?.phone ?? "";
	// The chat list lives in SWR's cache; live events patch it in place without refetching.
	const { data: serverChats, mutate: mutateChats } = useMethod<Chat[]>(id, "getChats");
	// Chats opened via "New chat" that have no messages yet, so the server doesn't list them.
	const [draftChats, setDraftChats] = useState<Chat[]>([]);
	const chatsLoaded = serverChats !== undefined;
	const chats = useMemo(() => {
		const list = serverChats ?? [];
		const known = new Set(list.map((c) => c.id));
		return sortChats([...draftChats.filter((c) => !known.has(c.id)), ...list]);
	}, [serverChats, draftChats]);
	const setChats = useCallback((fn: (prev: Chat[]) => Chat[]) => void mutateChats((prev) => fn(prev ?? []), { revalidate: false }), [mutateChats]);
	const [selected, setSelected] = useState<string | null>(null);
	const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
	const [hasMore, setHasMore] = useState<Map<string, boolean>>(new Map());
	const [loadingChat, setLoadingChat] = useState(false);
	const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
	const [infoOpen, setInfoOpen] = useState(false);
	const [replyTo, setReplyTo] = useState<Message | null>(null);
	const [editing, setEditing] = useState<Message | null>(null);
	const [lightbox, setLightbox] = useState<Message | null>(null);
	const [dialog, setDialog] = useState<null | "new" | "poll" | "location" | "contact">(null);
	const [forwarding, setForwarding] = useState<Message | null>(null);
	const [deleting, setDeleting] = useState<Message | null>(null);
	// Event handlers read the open chat through a ref so the live-feed callback stays stable.
	const selectedRef = useRef<string | null>(null);
	useEffect(() => {
		selectedRef.current = selected;
	}, [selected]);

	const selfId = selfPhone ? `${selfPhone}@c.us` : "";
	const names = useMemo(() => new Map(chats.filter((c) => c.name).map((c) => [c.id, c.name])), [chats]);
	const nameFor = useCallback((cid: string) => names.get(cid) || formatPhone(chatPhone(cid)), [names]);

	// ---- loading -----------------------------------------------------------

	const loadChats = useCallback(() => void mutateChats(), [mutateChats]);

	const loadHistory = useCallback(
		async (chatId: string, before?: number) => {
			const page = await callMethod<Message[]>(id, "getChatHistory", { body: { chatId, count: PAGE, ...(before ? { before } : {}) } });
			setMessages((prev) => {
				const next = new Map(prev);
				let list = next.get(chatId) ?? [];
				for (const m of page) list = upsertMessage(list, m);
				next.set(chatId, list);
				return next;
			});
			setHasMore((prev) => new Map(prev).set(chatId, page.length === PAGE));
		},
		[id],
	);

	const markRead = useCallback(
		(chatId: string) => {
			setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
			void callMethod(id, "readChat", { body: { chatId } }).catch(() => undefined);
		},
		[id, setChats],
	);

	const openChat = useCallback(
		async (chatId: string) => {
			setSelected(chatId);
			setReplyTo(null);
			setEditing(null);
			if (!chats.some((c) => c.id === chatId)) setDraftChats((prev) => [{ id: chatId, name: "", unreadCount: 0 }, ...prev]);
			markRead(chatId);
			void callMethod(id, "subscribePresence", { body: { chatId } }).catch(() => undefined);
			if (!messages.has(chatId)) {
				setLoadingChat(true);
				await loadHistory(chatId).catch((err) => toast.error(err.message));
				setLoadingChat(false);
			}
		},
		[id, chats, loadHistory, markRead, messages],
	);

	// ---- live events -------------------------------------------------------

	const patchMessage = useCallback((chatId: string, idMessage: string, fn: (m: Message) => Message) => {
		setMessages((prev) => {
			const list = prev.get(chatId);
			if (!list) return prev;
			const i = list.findIndex((m) => m.idMessage === idMessage);
			if (i < 0) return prev;
			const next = new Map(prev);
			const copy = [...list];
			copy[i] = fn(copy[i]);
			next.set(chatId, copy);
			return next;
		});
	}, []);

	const onEvent = useCallback(
		(event: LiveEvent) => {
			switch (event.type) {
				case "state":
					// Once authorized, the getWaSettings query switches on and loads the own number.
					void mutateState({ stateInstance: event.stateInstance }, { revalidate: false });
					break;
				case "message": {
					const m = event.message as unknown as Message;
					setMessages((prev) => (prev.has(m.chatId) ? new Map(prev).set(m.chatId, upsertMessage(prev.get(m.chatId)!, m)) : prev));
					const viewing = selectedRef.current === m.chatId && document.visibilityState === "visible";
					setChats((prev) => {
						const existing = prev.find((c) => c.id === m.chatId);
						const isNewer = !existing?.lastMessageTime || m.timestamp >= existing.lastMessageTime;
						const updated: Chat = {
							id: m.chatId,
							name: existing?.name || (m.type === "incoming" && !isGroup(m.chatId) ? m.senderName ?? "" : ""),
							unreadCount: (existing?.unreadCount ?? 0) + (m.type === "incoming" && !viewing ? 1 : 0),
							...(isNewer
								? {
										lastMessageTime: m.timestamp,
										lastMessageType: m.typeMessage,
										lastMessageDirection: m.type,
										lastMessageStatus: m.statusMessage,
										lastMessageDeleted: Boolean(m.deleted),
										lastMessageText: m.textMessage ?? m.caption ?? "",
									}
								: {
										lastMessageTime: existing?.lastMessageTime,
										lastMessageType: existing?.lastMessageType,
										lastMessageDirection: existing?.lastMessageDirection,
										lastMessageStatus: existing?.lastMessageStatus,
										lastMessageDeleted: existing?.lastMessageDeleted,
										lastMessageText: existing?.lastMessageText,
									}),
						};
						return sortChats([updated, ...prev.filter((c) => c.id !== m.chatId)]);
					});
					if (m.type === "incoming" && viewing) markRead(m.chatId);
					break;
				}
				case "message.status":
					patchMessage(event.chatId, event.idMessage, (m) => ({ ...m, statusMessage: event.status }));
					setChats((prev) => prev.map((c) => (c.id === event.chatId && c.lastMessageDirection === "outgoing" ? { ...c, lastMessageStatus: event.status } : c)));
					break;
				case "message.update":
					patchMessage(event.chatId, event.idMessage, (m) => {
						const patch = event.patch as { deleted?: boolean; edited?: boolean; textMessageData?: { textMessage?: string } };
						return { ...m, ...patch, ...(patch.textMessageData?.textMessage !== undefined ? { textMessage: patch.textMessageData.textMessage } : {}) };
					});
					if ((event.patch as { deleted?: boolean }).deleted) void loadChats();
					break;
				case "reaction":
					patchMessage(event.chatId, event.idMessage, (m) => {
						const others = (m.reactions ?? []).filter((r) => r.senderId !== event.senderId);
						return { ...m, reactions: event.reaction ? [...others, { senderId: event.senderId, reaction: event.reaction }] : others };
					});
					break;
				case "presence":
					setPresence((prev) => new Map(prev).set(event.chatId, { presence: event.presence, participant: event.participant, lastSeen: event.lastSeen, at: Date.now() }));
					break;
				case "chat.read":
					setChats((prev) => prev.map((c) => (c.id === event.chatId ? { ...c, unreadCount: 0 } : c)));
					break;
			}
		},
		[mutateState, loadChats, markRead, patchMessage, setChats],
	);

	const live = useInstanceEvents(id, onEvent);

	// After the live feed reconnects, catch up on anything missed.
	const wasLive = useRef(false);
	useEffect(() => {
		if (live && !wasLive.current && chatsLoaded) {
			void loadChats();
			if (selectedRef.current) void loadHistory(selectedRef.current);
		}
		wasLive.current = live;
	}, [live, chatsLoaded, loadChats, loadHistory]);

	// Typing indicators expire if no update arrives.
	useEffect(() => {
		const timer = setInterval(() => setPresence((p) => (p.size ? new Map(p) : p)), 5000);
		return () => clearInterval(timer);
	}, []);

	// Read the open chat when the tab comes back into view.
	useEffect(() => {
		const onVisible = () => {
			const chat = chats.find((c) => c.id === selectedRef.current);
			if (document.visibilityState === "visible" && chat?.unreadCount) markRead(chat.id);
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, [chats, markRead]);

	// ---- sending -------------------------------------------------------------

	const addLocal = useCallback((m: Message) => {
		setMessages((prev) => new Map(prev).set(m.chatId, upsertMessage(prev.get(m.chatId) ?? [], m)));
		setChats((prev) => {
			const existing = prev.find((c) => c.id === m.chatId);
			return sortChats([
				{
					...(existing ?? { id: m.chatId, name: "", unreadCount: 0 }),
					lastMessageTime: m.timestamp,
					lastMessageType: m.typeMessage,
					lastMessageDirection: "outgoing",
					lastMessageStatus: "pending",
					lastMessageDeleted: false,
					lastMessageText: m.textMessage ?? m.caption ?? "",
				},
				...prev.filter((c) => c.id !== m.chatId),
			]);
		});
	}, [setChats]);

	const quoteOf = (q?: Message) =>
		q ? { stanzaId: q.idMessage, participant: q.type === "outgoing" ? selfId : q.senderId || q.chatId, typeMessage: q.typeMessage, textMessage: q.textMessage, caption: q.caption } : undefined;

	const actions: ComposerActions = {
		sendText: async (text, quoted) => {
			const chatId = selectedRef.current!;
			const { idMessage } = await callMethod<{ idMessage: string }>(id, "sendMessage", { body: { chatId, message: text, ...(quoted ? { quotedMessageId: quoted.idMessage } : {}) } });
			addLocal({ type: "outgoing", idMessage, chatId, timestamp: now(), typeMessage: "textMessage", textMessage: text, statusMessage: "pending", quotedMessage: quoteOf(quoted), local: true });
		},
		sendFile: async (file, caption, opts) => {
			const chatId = selectedRef.current!;
			const form = new FormData();
			form.append("chatId", chatId);
			form.append("fileName", file.name);
			if (caption) form.append("caption", caption);
			if (opts?.voiceNote) form.append("voiceNote", "true");
			if (opts?.quoted) form.append("quotedMessageId", opts.quoted.idMessage);
			form.append("file", file);
			const pendingToast = toast.loading("Sending file…");
			try {
				const { idMessage } = await callMethod<{ idMessage: string }>(id, "sendFileByUpload", { form });
				addLocal({
					type: "outgoing",
					idMessage,
					chatId,
					timestamp: now(),
					typeMessage: mediaType(file),
					caption,
					fileName: file.name,
					mimeType: file.type,
					downloadUrl: URL.createObjectURL(file),
					statusMessage: "pending",
					quotedMessage: quoteOf(opts?.quoted),
					local: true,
				});
			} finally {
				toast.dismiss(pendingToast);
			}
		},
		editText: async (m, text) => {
			await callMethod(id, "editMessage", { body: { chatId: m.chatId, idMessage: m.idMessage, message: text } });
			patchMessage(m.chatId, m.idMessage, (x) => ({ ...x, textMessage: text, edited: true }));
		},
		openPoll: () => setDialog("poll"),
		openLocation: () => setDialog("location"),
		openContact: () => setDialog("contact"),
		typing: (kind) => {
			const chatId = selectedRef.current;
			if (chatId) void callMethod(id, "sendTyping", { body: { chatId, typingTime: 5000, typingType: kind === "recording" ? "recording" : "typing" } }).catch(() => undefined);
		},
	};

	const sendQueued = async (method: string, body: Record<string, unknown>, local: Partial<Message>) => {
		const chatId = selectedRef.current!;
		const { idMessage } = await callMethod<{ idMessage: string }>(id, method, { body: { chatId, ...body } });
		addLocal({ type: "outgoing", idMessage, chatId, timestamp: now(), statusMessage: "pending", typeMessage: "textMessage", local: true, ...local });
	};

	const react = useCallback(
		async (m: Message, emoji: string) => {
			const mine = m.reactions?.find((r) => r.senderId === selfId)?.reaction;
			const next = mine === emoji ? "" : emoji;
			patchMessage(m.chatId, m.idMessage, (x) => {
				const others = (x.reactions ?? []).filter((r) => r.senderId !== selfId);
				return { ...x, reactions: next ? [...others, { senderId: selfId, reaction: next }] : others };
			});
			await callMethod(id, "sendReaction", { body: { chatId: m.chatId, idMessage: m.idMessage, reaction: next } }).catch((err) => toast.error(err.message));
		},
		[id, patchMessage, selfId],
	);

	const onAction = (action: MessageAction, m: Message) => {
		switch (action) {
			case "reply":
				setEditing(null);
				setReplyTo(m);
				break;
			case "copy":
				void navigator.clipboard.writeText(m.textMessage ?? m.caption ?? "").then(() => toast.success("Copied"));
				break;
			case "forward":
				setForwarding(m);
				break;
			case "edit":
				setReplyTo(null);
				setEditing(m);
				break;
			case "delete":
				setDeleting(m);
				break;
			case "download":
				if (m.downloadUrl) window.open(m.downloadUrl, "_blank", "noopener");
				break;
		}
	};

	// ---- render ----------------------------------------------------------------

	const selectedChat = chats.find((c) => c.id === selected);
	const title = selectedChat ? chatTitle(selectedChat, selfId) : selected ? chatTitle({ id: selected, name: "" }, selfId) : "";

	if (state !== "authorized" && state !== "starting") {
		return (
			<div className="wa-theme grid h-dvh place-items-center bg-wa-app p-6">
				<div className="w-full max-w-md rounded-2xl border border-wa-line bg-wa-list p-8 text-center shadow-sm">
					<div className="mx-auto grid size-14 place-items-center rounded-full bg-wa-panel">
						<WifiOff className="size-6 text-wa-muted" />
					</div>
					<h1 className="mt-4 text-xl font-medium text-wa-text">{state === "offline" ? "Gateway is offline" : "This instance isn't linked"}</h1>
					<p className="mt-2 text-sm text-wa-muted">
						{state === "offline" ? "Start the gateway (npm run gateway), then reload this page." : "Link your phone from the instance page, then come back."}
					</p>
					<Link href={`/app/i/${id}`} className={buttonClass("primary", "mt-6")}>
						Go to instance
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="wa-theme relative flex h-dvh justify-center bg-wa-app">
			<div className="relative flex h-full w-full max-w-[1700px] overflow-hidden bg-wa-list">
			<NavRail instanceId={id} unread={chats.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0)} />
			<div
				className={cn(
					"grid h-full min-w-0 flex-1 overflow-hidden bg-wa-list",
					infoOpen && selected ? "md:grid-cols-[minmax(300px,30%)_1fr] xl:grid-cols-[minmax(340px,30%)_1fr_minmax(320px,28%)]" : "md:grid-cols-[minmax(300px,30%)_1fr]",
				)}
			>
				<div className={cn("min-h-0", selected ? "hidden md:block" : "block")}>
					{chatsLoaded ? (
						<ChatList
							instanceId={id}
							selfId={selfId}
							chats={chats}
							selected={selected}
							presence={presence}
							onSelect={openChat}
							onNewChat={() => setDialog("new")}
							accountName={instance.name}
						/>
					) : (
						<div className="grid h-full place-items-center border-r border-wa-line">
							<Loader2 className="size-6 animate-spin text-wa-muted" />
						</div>
					)}
				</div>

				<div className={cn("min-h-0 min-w-0", selected ? "block" : "hidden md:block", infoOpen && selected && "hidden xl:block")}>
					{selected ? (
						<Conversation
							key={selected}
							instanceId={id}
							chatId={selected}
							title={title}
							selfId={selfId}
							messages={messages.get(selected) ?? []}
							loading={loadingChat}
							hasMore={hasMore.get(selected) ?? false}
							presence={presence.get(selected)}
							nameFor={nameFor}
							onLoadOlder={async () => {
								const oldest = messages.get(selected)?.[0];
								if (oldest) await loadHistory(selected, oldest.timestamp);
							}}
							onBack={() => setSelected(null)}
							onToggleInfo={() => setInfoOpen((v) => !v)}
							infoOpen={infoOpen}
							onAction={onAction}
							onReact={react}
							onOpenMedia={setLightbox}
							actions={actions}
							replyTo={replyTo}
							editing={editing}
							setReplyTo={setReplyTo}
							setEditing={setEditing}
						/>
					) : (
						<div className="relative flex h-full flex-col items-center justify-center bg-wa-panel px-8 text-center">
							<EmptyChatsArt className="w-72 max-w-full" />
							<h1 className="mt-6 text-[28px] font-light tracking-tight text-wa-text">Relay for {instance.name}</h1>
							<p className="mt-3 max-w-md text-sm leading-relaxed text-wa-muted">Send and receive messages from your linked phone. Pick a chat on the left or start a new one.</p>
							<div className="mt-7 flex flex-wrap justify-center gap-3">
								<button type="button" onClick={() => setDialog("new")} className="cursor-pointer inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition hover:brightness-110">
									<MessageSquarePlus className="size-4" /> New chat
								</button>
								<Link href={`/app/i/${id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-wa-line bg-wa-list px-5 text-sm font-medium text-wa-text transition hover:bg-wa-hover">
									<SlidersHorizontal className="size-4" /> Instance settings
								</Link>
							</div>
							<p className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-1.5 text-xs text-wa-muted">
								<span className={cn("size-1.5 rounded-full", live ? "bg-wa-badge" : "animate-pulse bg-amber-500")} />
								{live ? "Live updates connected · relayed by your own gateway" : "Connecting to live updates…"}
							</p>
						</div>
					)}
				</div>

				{infoOpen && selected && (
					<div className="min-h-0">
						<ContactInfoPanel key={selected} instanceId={id} chatId={selected} title={title} selfId={selfId} nameFor={nameFor} onClose={() => setInfoOpen(false)} onOpenChat={openChat} />
					</div>
				)}
			</div>
			</div>

			{lightbox && <Lightbox message={lightbox} title={lightbox.type === "outgoing" ? "You" : lightbox.senderName || title} onClose={() => setLightbox(null)} />}

			<NewChatDialog instanceId={id} open={dialog === "new"} onClose={() => setDialog(null)} onOpenChat={openChat} />
			<PollDialog
				open={dialog === "poll"}
				onClose={() => setDialog(null)}
				onSend={(question, options, multiple) =>
					sendQueued("sendPoll", { message: question, options: options.map((optionName) => ({ optionName })), multipleAnswers: multiple }, {
						typeMessage: "pollMessage",
						pollMessageData: { name: question, options: options.map((optionName) => ({ optionName })), multipleAnswers: multiple },
					})
				}
			/>
			<LocationDialog
				open={dialog === "location"}
				onClose={() => setDialog(null)}
				onSend={(loc) => sendQueued("sendLocation", loc, { typeMessage: "locationMessage", locationMessageData: loc })}
			/>
			<ContactDialog
				open={dialog === "contact"}
				onClose={() => setDialog(null)}
				onSend={(contact) =>
					sendQueued("sendContact", { contact }, { typeMessage: "contactMessage", contactMessageData: { displayName: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || String(contact.phoneContact), vcard: "" } })
				}
			/>
			<ForwardDialog
				instanceId={id}
				selfId={selfId}
				chats={chats}
				open={Boolean(forwarding)}
				onClose={() => setForwarding(null)}
				onForward={async (targets) => {
					const m = forwarding!;
					for (const chatId of targets) {
						await callMethod(id, "forwardMessages", { body: { chatId, chatIdFrom: m.chatId, messages: [m.idMessage] } });
					}
					toast.success(targets.length > 1 ? `Forwarded to ${targets.length} chats` : "Forwarded");
					void loadChats();
				}}
			/>
			<Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete message?">
				<p className="text-sm text-muted">It will be deleted for everyone in this chat.</p>
				<div className="mt-6 flex justify-end gap-2">
					<Button variant="secondary" onClick={() => setDeleting(null)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={async () => {
							const m = deleting!;
							setDeleting(null);
							try {
								await callMethod(id, "deleteMessage", { body: { chatId: m.chatId, idMessage: m.idMessage } });
								patchMessage(m.chatId, m.idMessage, (x) => ({ ...x, deleted: true }));
							} catch (err) {
								toast.error((err as Error).message);
							}
						}}
					>
						Delete for everyone
					</Button>
				</div>
			</Dialog>
		</div>
	);
}
