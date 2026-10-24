// Gateway Console: a browser client that uses only the gateway's
// GREEN-API-compatible endpoints. Credentials live in localStorage.

const $ = (id) => document.getElementById(id);
const STORE_KEY = "gateway-console";

const state = {
	id: "",
	token: "",
	instanceState: "starting",
	phone: "",
	chats: [],
	chatId: null,
	extraChats: new Map(), // chats opened via "New chat" that have no messages yet
	historyKey: "",
	file: null,
	timer: null,
};

// ---------- helpers ----------

function h(tag, props = {}, ...children) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(props)) {
		if (v == null || v === false) continue;
		if (k === "class") el.className = v;
		else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
		else el.setAttribute(k, v === true ? "" : v);
	}
	for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
	return el;
}

function api(method, { verb = "GET", body, query, extra, form } = {}) {
	let url = `/waInstance${state.id}/${method}/${state.token}${extra ? `/${extra}` : ""}`;
	if (query) url += `?${new URLSearchParams(query)}`;
	const init = { method: verb };
	if (form) init.body = form;
	else if (body !== undefined) {
		init.body = JSON.stringify(body);
		init.headers = { "Content-Type": "application/json" };
	}
	return fetch(url, init).then(async (res) => {
		const data = await res.json().catch(() => null);
		if (!res.ok) throw new Error(data?.message || `${method} failed (${res.status})`);
		return data;
	});
}

function toast(text, ms = 3000) {
	const el = $("toast");
	el.textContent = text;
	el.hidden = false;
	clearTimeout(toast.t);
	toast.t = setTimeout(() => (el.hidden = true), ms);
}

const phoneOf = (chatId) => chatId.split("@")[0];
const isGroup = (chatId) => chatId.endsWith("@g.us");

function prettyPhone(digits) {
	if (!/^\d+$/.test(digits)) return digits;
	if (digits.startsWith("91") && digits.length === 12) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
	if (digits.startsWith("1") && digits.length === 11) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
	return `+${digits}`;
}

function chatLabel(chat) {
	if (chat.id === `${state.phone}@c.us`) return `${prettyPhone(state.phone)} (You)`;
	return chat.name || (isGroup(chat.id) ? "Group" : prettyPhone(phoneOf(chat.id)));
}

function initial(text) {
	const ch = [...(text || "?").replace(/^\+/, "")][0] || "?";
	return /\d/.test(ch) ? "#" : ch.toUpperCase();
}

function timeOf(ts) {
	return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortWhen(ts) {
	const d = new Date(ts * 1000);
	const today = new Date();
	if (d.toDateString() === today.toDateString()) return timeOf(ts);
	const y = new Date(today);
	y.setDate(today.getDate() - 1);
	if (d.toDateString() === y.toDateString()) return "Yesterday";
	return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function dayLabel(ts) {
	const w = shortWhen(ts);
	return w.includes(":") ? "Today" : w;
}

const preview = {
	textMessage: (t) => t,
	extendedTextMessage: (t) => t,
	quotedMessage: (t) => t,
	imageMessage: (t) => `📷 ${t || "Photo"}`,
	videoMessage: (t) => `🎥 ${t || "Video"}`,
	audioMessage: () => "🎤 Audio",
	documentMessage: (t) => `📄 ${t || "Document"}`,
	stickerMessage: () => "Sticker",
	locationMessage: () => "📍 Location",
	contactMessage: () => "👤 Contact",
	contactsArrayMessage: () => "👤 Contacts",
	pollMessage: () => "📊 Poll",
};

// ---------- connect ----------

function loadCreds() {
	const params = new URLSearchParams(location.hash.slice(1));
	if (params.get("chat")) state.pendingChat = params.get("chat");
	if (params.get("id") && params.get("token")) {
		history.replaceState(null, "", location.pathname);
		return { id: params.get("id"), token: params.get("token") };
	}
	try {
		return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
	} catch {
		return null;
	}
}

function saveCreds() {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify({ id: state.id, token: state.token }));
	} catch {}
}

function forgetCreds() {
	try {
		localStorage.removeItem(STORE_KEY);
	} catch {}
}

async function connect(id, token) {
	state.id = String(id).trim();
	state.token = String(token).trim();
	await api("getStateInstance"); // throws on bad credentials
	saveCreds();
	$("connect").hidden = true;
	$("app").hidden = false;
	$("me-instance").textContent = `#${state.id}`;
	await tick();
	if (state.pendingChat && state.instanceState === "authorized") {
		await openChat(state.pendingChat);
		state.pendingChat = null;
	}
	clearInterval(state.timer);
	state.timer = setInterval(tick, 2500);
}

function showConnect(message) {
	clearInterval(state.timer);
	$("app").hidden = true;
	$("connect").hidden = false;
	const err = $("connect-error");
	err.hidden = !message;
	err.textContent = message || "";
	const form = $("connect-form");
	form.elements.instance.value = state.id || "";
	form.elements.token.value = state.token || "";
}

$("connect-form").addEventListener("submit", async (e) => {
	e.preventDefault();
	const f = e.currentTarget;
	try {
		await connect(f.elements.instance.value, f.elements.token.value);
	} catch (err) {
		showConnect(err.message === "Unauthorized" ? "Wrong idInstance or token." : err.message);
	}
});

// ---------- polling ----------

async function tick() {
	try {
		const { stateInstance } = await api("getStateInstance");
		setInstanceState(stateInstance);
		if (stateInstance === "authorized") {
			if (!state.phone) await loadMe();
			await refreshChats();
			if (state.chatId) await refreshHistory();
		} else {
			await refreshQr();
		}
	} catch (err) {
		if (err.message === "Unauthorized") return showConnect("Token no longer valid. Was it rotated?");
		setInstanceState("offline");
	}
}

function setInstanceState(s) {
	const changed = s !== state.instanceState;
	state.instanceState = s;
	const pill = $("state-pill");
	pill.textContent = s === "offline" ? "gateway offline" : s;
	pill.className = `pill ${s}`;
	const linked = s === "authorized";
	$("link-panel").hidden = linked || s === "offline";
	if (!linked) {
		$("chat").hidden = true;
		$("welcome").hidden = s !== "offline";
		$("app").classList.add("in-chat");
		if (changed) {
			state.phone = "";
			$("pair-code").hidden = true;
		}
	} else if (changed) {
		$("app").classList.toggle("in-chat", Boolean(state.chatId));
		showChatPane();
	}
}

async function loadMe() {
	const me = await api("getWaSettings");
	state.phone = me.phone || "";
	$("me-phone").textContent = state.phone ? prettyPhone(state.phone) : "—";
	const img = $("me-avatar");
	if (me.avatar) {
		img.src = me.avatar;
		img.hidden = false;
		$("me-initial").hidden = true;
	} else {
		img.hidden = true;
		$("me-initial").hidden = false;
		$("me-initial").textContent = "Me";
	}
}

// ---------- link (QR / pairing code) ----------

async function refreshQr() {
	const qr = await api("qr").catch(() => null);
	const img = $("qr-img");
	if (qr?.type === "qrCode") {
		img.src = `data:image/png;base64,${qr.message}`;
		img.hidden = false;
		$("qr-wait").hidden = true;
	} else {
		img.hidden = true;
		$("qr-wait").hidden = false;
		$("qr-wait").textContent = qr?.message ? "Preparing a new code…" : "Waiting for QR…";
	}
}

$("pair-form").addEventListener("submit", async (e) => {
	e.preventDefault();
	const phone = e.currentTarget.phone.value.replace(/\D/g, "");
	try {
		const { code } = await api("getAuthorizationCode", { verb: "POST", body: { phoneNumber: Number(phone) } });
		const box = $("pair-code");
		box.textContent = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
		box.hidden = false;
		toast("On your phone: Linked devices → Link with phone number → enter this code", 6000);
	} catch (err) {
		toast(err.message);
	}
});

// ---------- chat list ----------

async function refreshChats() {
	state.chats = await api("getChats");
	renderChats();
}

function allChats() {
	const known = new Set(state.chats.map((c) => c.id));
	const extra = [...state.extraChats.values()].filter((c) => !known.has(c.id));
	return [...extra, ...state.chats];
}

function renderChats() {
	const q = $("search").value.trim().toLowerCase();
	const chats = allChats().filter((c) => !q || chatLabel(c).toLowerCase().includes(q) || c.id.includes(q));
	const list = $("chat-list");
	list.replaceChildren(
		...chats.map((c) => {
			const label = chatLabel(c);
			const prefix = c.lastMessageDirection === "outgoing" ? "You: " : "";
			const text = c.lastMessageType ? (preview[c.lastMessageType] ?? (() => "Message"))(c.lastMessageText || "") : "New chat";
			return h(
				"li",
				{ class: `chat-item${c.id === state.chatId ? " active" : ""}`, onclick: () => openChat(c.id) },
				h("div", { class: "avatar avatar-fallback" }, initial(label)),
				h(
					"div",
					{ class: "chat-item-body" },
					h("div", { class: "chat-item-top" }, h("span", { class: "chat-item-name" }, label), c.lastMessageTime ? h("span", { class: "chat-item-time" }, shortWhen(c.lastMessageTime)) : null),
					h("div", { class: "chat-item-last" }, prefix + text),
				),
			);
		}),
	);
	$("chat-empty").hidden = chats.length > 0 || Boolean(q);
}

$("search").addEventListener("input", renderChats);

// ---------- conversation ----------

function showChatPane() {
	const open = Boolean(state.chatId) && state.instanceState === "authorized";
	$("chat").hidden = !open;
	$("welcome").hidden = open || state.instanceState !== "authorized";
}

async function openChat(chatId) {
	state.chatId = chatId;
	state.historyKey = "";
	const chat = allChats().find((c) => c.id === chatId) ?? { id: chatId };
	const label = chatLabel(chat);
	$("chat-name").textContent = label;
	$("chat-initial").textContent = initial(label);
	$("chat-sub").textContent = isGroup(chatId) ? "Group" : prettyPhone(phoneOf(chatId));
	$("messages").replaceChildren();
	$("app").classList.add("in-chat");
	showChatPane();
	renderChats();
	await refreshHistory();
	$("text").focus();
}

$("btn-back").addEventListener("click", () => {
	state.chatId = null;
	$("app").classList.remove("in-chat");
	showChatPane();
	renderChats();
});

async function refreshHistory() {
	const chatId = state.chatId;
	const history = await api("getChatHistory", { verb: "POST", body: { chatId, count: 300 } });
	if (chatId !== state.chatId) return;
	const key = history.map((m) => `${m.idMessage}:${m.statusMessage ?? ""}:${m.deleted ?? ""}:${m.edited ?? ""}`).join("|");
	if (key === state.historyKey) return;
	state.historyKey = key;
	renderMessages(history.reverse());
}

function renderMessages(messages) {
	const box = $("messages");
	const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
	const nodes = [];
	let lastDay = "";
	for (const m of messages) {
		const day = new Date(m.timestamp * 1000).toDateString();
		if (day !== lastDay) {
			nodes.push(h("div", { class: "day" }, dayLabel(m.timestamp)));
			lastDay = day;
		}
		nodes.push(renderBubble(m));
	}
	if (!messages.length) nodes.push(h("div", { class: "day" }, "No messages yet. Say hi 👋"));
	box.replaceChildren(...nodes);
	if (nearBottom || !state.rendered) box.scrollTop = box.scrollHeight;
	state.rendered = true;
}

const ticks = { pending: "🕓", sent: "✓", delivered: "✓✓", read: "✓✓", failed: "⚠" };

function renderBubble(m) {
	const out = m.type === "outgoing";
	const meta = h(
		"span",
		{ class: "meta" },
		m.edited ? "edited · " : "",
		timeOf(m.timestamp),
		out ? h("span", { class: `tick ${m.statusMessage}`, title: m.statusMessage }, " ", ticks[m.statusMessage] ?? "") : null,
	);
	const parts = [];
	if (!out && isGroup(m.chatId)) parts.push(h("div", { class: "sender" }, m.senderName || prettyPhone(phoneOf(m.senderId))));
	if (m.deleted) {
		parts.push(h("span", { class: "deleted" }, "🚫 This message was deleted"));
		return h("div", { class: `bubble ${out ? "out" : "in"}` }, parts, meta);
	}
	if (m.quotedMessage) {
		const q = m.quotedMessage;
		const qText = q.textMessage ?? q.textMessageData?.textMessage ?? q.extendedTextMessageData?.text ?? q.caption ?? (preview[q.typeMessage]?.("") || "Message");
		parts.push(h("div", { class: "quote" }, qText));
	}
	parts.push(...renderContent(m));
	return h("div", { class: `bubble ${out ? "out" : "in"}` }, parts, meta);
}

function safeUrl(url) {
	return /^(https?:\/\/|\/media\/)/.test(url || "") ? url : null;
}

function renderContent(m) {
	const caption = m.caption ? [h("div", {}, linkify(m.caption))] : [];
	const url = safeUrl(m.downloadUrl);
	switch (m.typeMessage) {
		case "textMessage":
		case "extendedTextMessage":
		case "quotedMessage":
			return [h("span", {}, linkify(m.textMessage ?? ""))];
		case "imageMessage":
			return [url ? h("a", { href: url, target: "_blank", rel: "noopener" }, h("img", { class: "media", src: url, alt: "image", loading: "lazy" })) : h("i", {}, "📷 Photo"), ...caption];
		case "stickerMessage":
			return [url ? h("img", { class: "media sticker", src: url, alt: "sticker", loading: "lazy" }) : h("i", {}, "Sticker")];
		case "videoMessage":
			return [url ? h("video", { class: "media", src: url, controls: true, preload: "metadata" }) : h("i", {}, "🎥 Video"), ...caption];
		case "audioMessage":
			return [url ? h("audio", { src: url, controls: true, preload: "none" }) : h("i", {}, "🎤 Audio")];
		case "documentMessage":
			return [h(url ? "a" : "div", { class: "doc", href: url, target: "_blank", rel: "noopener" }, "📄 ", m.fileName || "Document"), ...caption];
		case "locationMessage": {
			const d = m.locationMessageData ?? {};
			const map = `https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=16/${d.latitude}/${d.longitude}`;
			return [h("a", { href: map, target: "_blank", rel: "noopener" }, `📍 ${d.nameLocation || "Location"}`), d.address ? h("div", { class: "small muted" }, d.address) : null];
		}
		case "contactMessage":
			return [h("span", {}, `👤 ${m.contactMessageData?.displayName ?? "Contact"}`)];
		case "contactsArrayMessage":
			return [h("span", {}, `👤 ${(m.messageData?.contacts ?? []).map((c) => c.displayName).join(", ")}`)];
		case "pollMessage": {
			const p = m.pollMessageData ?? {};
			return [h("b", {}, `📊 ${p.name ?? "Poll"}`), ...(p.options ?? []).map((o) => h("div", { class: "poll-opt" }, o.optionName))];
		}
		default:
			return [h("i", { class: "muted" }, `[${m.typeMessage}]`)];
	}
}

function linkify(text) {
	const out = [];
	let last = 0;
	for (const match of text.matchAll(/https?:\/\/[^\s<]+/g)) {
		out.push(text.slice(last, match.index));
		out.push(h("a", { href: match[0], target: "_blank", rel: "noopener noreferrer" }, match[0]));
		last = match.index + match[0].length;
	}
	out.push(text.slice(last));
	return out;
}

// ---------- composer ----------

const textArea = $("text");
textArea.addEventListener("input", () => {
	textArea.style.height = "auto";
	textArea.style.height = `${Math.min(textArea.scrollHeight, 140)}px`;
});
textArea.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		$("composer").requestSubmit();
	}
});

$("composer").addEventListener("submit", async (e) => {
	e.preventDefault();
	const text = textArea.value.trim();
	if (!state.chatId || (!text && !state.file)) return;
	const chatId = state.chatId;
	try {
		if (state.file) {
			const form = new FormData();
			form.append("chatId", chatId);
			form.append("fileName", state.file.name);
			if (text) form.append("caption", text);
			form.append("file", state.file);
			setFile(null);
			toast("Uploading…", 1500);
			await api("sendFileByUpload", { verb: "POST", form });
		} else {
			await api("sendMessage", { verb: "POST", body: { chatId, message: text } });
		}
		textArea.value = "";
		textArea.style.height = "auto";
		afterSend(chatId);
	} catch (err) {
		toast(err.message);
	}
});

function afterSend(chatId) {
	// The message is queued; the journal entry appears once WhatsApp accepts it.
	const delay = [600, 1600, 3500];
	delay.forEach((ms) => setTimeout(() => state.chatId === chatId && refreshHistory().then(refreshChats), ms));
}

function setFile(file) {
	state.file = file;
	$("file-chip").hidden = !file;
	$("file-name").textContent = file ? file.name : "";
	textArea.placeholder = file ? "Add a caption (optional)" : "Type a message";
	if (!file) $("file-input").value = "";
}

$("file-input").addEventListener("change", (e) => setFile(e.target.files[0] ?? null));
$("file-clear").addEventListener("click", () => setFile(null));

// Drag & drop onto the conversation.
$("chat").addEventListener("dragover", (e) => e.preventDefault());
$("chat").addEventListener("drop", (e) => {
	e.preventDefault();
	if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

// ---------- menus ----------

function toggleMenu(menu, show) {
	const open = show ?? menu.hidden;
	document.querySelectorAll(".menu").forEach((m) => (m.hidden = true));
	menu.hidden = !open;
}

$("btn-menu").addEventListener("click", (e) => {
	e.stopPropagation();
	toggleMenu($("menu"));
});
$("btn-attach-menu").addEventListener("click", (e) => {
	e.stopPropagation();
	toggleMenu($("attach-menu"));
});
document.addEventListener("click", () => document.querySelectorAll(".menu").forEach((m) => (m.hidden = true)));

$("menu").addEventListener("click", async (e) => {
	const action = e.target.dataset?.action;
	if (!action) return;
	if (action === "settings") return openSettings();
	if (action === "disconnect") {
		forgetCreds();
		state.chatId = null;
		return showConnect();
	}
	if (action === "reboot") {
		await api("reboot").catch((err) => toast(err.message));
		return toast("Rebooting instance…");
	}
	if (action === "logout") {
		const ok = await modal("Log out WhatsApp?", [h("p", {}, "This unlinks the gateway from your phone. You will need to scan a new QR code.")], { okText: "Log out" });
		if (!ok) return;
		await api("logout").catch((err) => toast(err.message));
		toast("Logged out");
	}
});

$("attach-menu").addEventListener("click", async (e) => {
	const kind = e.target.dataset?.attach;
	if (!kind || !state.chatId) return;
	const chatId = state.chatId;
	if (kind === "file") return $("file-input").click();

	const forms = {
		url: {
			title: "Send file from URL",
			fields: [field("urlFile", "File URL", { placeholder: "https://example.com/photo.jpg", required: true }), field("fileName", "File name (with extension)", { placeholder: "photo.jpg", required: true }), field("caption", "Caption")],
			send: (v) => api("sendFileByUrl", { verb: "POST", body: { chatId, ...v } }),
		},
		location: {
			title: "Send location",
			fields: [field("latitude", "Latitude", { required: true, placeholder: "22.5726" }), field("longitude", "Longitude", { required: true, placeholder: "88.3639" }), field("nameLocation", "Name"), field("address", "Address")],
			send: (v) => api("sendLocation", { verb: "POST", body: { chatId, ...v, latitude: Number(v.latitude), longitude: Number(v.longitude) } }),
		},
		poll: {
			title: "Send poll",
			fields: [field("message", "Question", { required: true }), field("options", "Options (one per line, 2-12)", { textarea: true, required: true }), check("multipleAnswers", "Allow multiple answers")],
			send: (v) =>
				api("sendPoll", {
					verb: "POST",
					body: { chatId, message: v.message, multipleAnswers: v.multipleAnswers, options: v.options.split("\n").map((s) => s.trim()).filter(Boolean).map((optionName) => ({ optionName })) },
				}),
		},
		contact: {
			title: "Send contact",
			fields: [field("phoneContact", "Phone (with country code)", { required: true, placeholder: "919876543210" }), field("firstName", "First name"), field("lastName", "Last name"), field("company", "Company")],
			send: (v) => api("sendContact", { verb: "POST", body: { chatId, contact: { ...v, phoneContact: Number(v.phoneContact.replace(/\D/g, "")) } } }),
		},
	};
	const f = forms[kind];
	const values = await modal(f.title, f.fields, { okText: "Send", collect: true });
	if (!values) return;
	try {
		await f.send(values);
		afterSend(chatId);
	} catch (err) {
		toast(err.message);
	}
});

// ---------- new chat ----------

$("btn-new-chat").addEventListener("click", async () => {
	const values = await modal("New chat", [field("phone", "Phone number with country code", { placeholder: "919876543210", required: true })], {
		okText: "Open chat",
		collect: true,
		validate: async (v) => {
			const digits = v.phone.replace(/\D/g, "");
			if (digits.length < 8) return "Enter the full number including country code.";
			const { existsWhatsapp } = await api("checkWhatsapp", { verb: "POST", body: { phoneNumber: Number(digits) } });
			if (!existsWhatsapp) return "This number is not on WhatsApp.";
		},
	});
	if (!values) return;
	const chatId = `${values.phone.replace(/\D/g, "")}@c.us`;
	if (!state.chats.some((c) => c.id === chatId)) state.extraChats.set(chatId, { id: chatId, name: "" });
	openChat(chatId);
});

// ---------- settings ----------

const toggles = [
	["incomingWebhook", "Incoming messages"],
	["outgoingMessageWebhook", "Messages sent from phone"],
	["outgoingAPIMessageWebhook", "Messages sent via API"],
	["outgoingWebhook", "Delivery / read statuses"],
	["stateWebhook", "Instance state changes"],
	["incomingCallWebhook", "Incoming calls"],
	["editedMessageWebhook", "Edited messages"],
	["deletedMessageWebhook", "Deleted messages"],
	["markIncomingMessagesReaded", "Auto-mark incoming as read"],
	["keepOnlineStatus", "Appear online"],
];

async function openSettings() {
	const s = await api("getSettings");
	const values = await modal(
		"Instance settings",
		[
			field("webhookUrl", "Webhook URL (empty = use receiveNotification polling)", { value: s.webhookUrl, placeholder: "http://127.0.0.1:5000/hook" }),
			field("webhookUrlToken", "Webhook token (sent as Bearer)", { value: s.webhookUrlToken }),
			field("delaySendMessagesMilliseconds", "Delay between sends (ms)", { value: s.delaySendMessagesMilliseconds, type: "number" }),
			h("div", { class: "small muted" }, "Notifications"),
			...toggles.map(([k, label]) => check(k, label, s[k] === "yes")),
		],
		{ okText: "Save", collect: true },
	);
	if (!values) return;
	const patch = { ...values, delaySendMessagesMilliseconds: Number(values.delaySendMessagesMilliseconds) || 0 };
	for (const [k] of toggles) patch[k] = values[k] ? "yes" : "no";
	await api("setSettings", { verb: "POST", body: patch }).then(() => toast("Settings saved"), (err) => toast(err.message));
}

// ---------- modal ----------

function field(name, label, { value = "", placeholder = "", required = false, type = "text", textarea = false } = {}) {
	const input = textarea ? h("textarea", { name, rows: 4, placeholder, required }) : h("input", { name, type, placeholder, required, autocomplete: "off" });
	input.value = value ?? "";
	return h("label", {}, label, input);
}

function check(name, label, checked = false) {
	const input = h("input", { type: "checkbox", name });
	input.checked = checked;
	return h("label", { class: "toggle" }, label, input);
}

function modal(title, nodes, { okText = "OK", collect = false, validate } = {}) {
	const dlg = $("modal");
	const form = $("modal-form");
	$("modal-title").textContent = title;
	$("modal-body").replaceChildren(...nodes);
	$("modal-ok").textContent = okText;
	$("modal-error").hidden = true;

	return new Promise((resolve) => {
		const values = () => {
			const v = {};
			for (const el of form.querySelectorAll("#modal-body [name]")) v[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
			return v;
		};
		const onSubmit = async (e) => {
			if (e.submitter?.value !== "ok") return;
			e.preventDefault();
			const v = values();
			if (validate) {
				$("modal-ok").disabled = true;
				const problem = await validate(v).catch((err) => err.message);
				$("modal-ok").disabled = false;
				if (problem) {
					$("modal-error").textContent = problem;
					$("modal-error").hidden = false;
					return;
				}
			}
			cleanup();
			dlg.close();
			resolve(collect ? v : true);
		};
		const onClose = () => {
			cleanup();
			resolve(null);
		};
		const cleanup = () => {
			form.removeEventListener("submit", onSubmit);
			dlg.removeEventListener("close", onClose);
		};
		form.addEventListener("submit", onSubmit);
		dlg.addEventListener("close", onClose);
		dlg.showModal();
		form.querySelector("#modal-body input, #modal-body textarea")?.focus();
	});
}

// ---------- boot ----------

const saved = loadCreds();
if (saved?.id && saved?.token) {
	connect(saved.id, saved.token).catch((err) => {
		state.id = saved.id;
		state.token = saved.token;
		showConnect(err.message === "Unauthorized" ? "Saved credentials are no longer valid." : `Cannot reach the gateway: ${err.message}`);
	});
} else {
	showConnect();
}
