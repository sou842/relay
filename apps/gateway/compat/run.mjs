// Drives GREEN-API's official v1 SDK against our gateway and prints a scorecard.
//   ID=1101000001 TOKEN=... node run.mjs
import whatsAppClient from "@green-api/whatsapp-api-client";

const host = process.env.HOST ?? "http://127.0.0.1:7700";
const api = whatsAppClient.restAPI({ host, media: host, idInstance: process.env.ID, apiTokenInstance: process.env.TOKEN });
const authorized = (await api.instance.getStateInstance()).stateInstance === "authorized";
const self = process.env.SELF_CHAT; // e.g. 919876543210@c.us, your own number, for send tests

const checks = [
	["instance.getStateInstance", () => api.instance.getStateInstance(), (r) => "stateInstance" in r],
	["instance.getStateInstanceHistory", () => api.instance.getStateInstanceHistory(), Array.isArray],
	["instance.qr", () => api.instance.qr(), (r) => ["qrCode", "alreadyLogged", "error"].includes(r.type)],
	["instance.getWaSettings", () => api.instance.getWaSettings(), (r) => "stateInstance" in r],
	["settings.getSettings", () => api.settings.getSettings(), (r) => "delaySendMessagesMilliseconds" in r],
	["settings.setSettings", () => api.settings.setSettings({ delaySendMessagesMilliseconds: 3000 }), (r) => r.saveSettings === true],
	["message.showMessagesQueue", () => api.message.showMessagesQueue(), Array.isArray],
	["message.clearMessagesQueue", () => api.message.clearMessagesQueue(), (r) => r.isCleared === true],
	[
		"webhookService.receive+deleteNotification",
		async () => {
			const n = await api.webhookService.receiveNotification();
			if (!n) return { empty: true };
			return { receipt: n.receiptId, type: n.body.typeWebhook, deleted: await api.webhookService.deleteNotification(n.receiptId) };
		},
		(r) => r.empty || r.deleted?.result === true,
	],
];

if (authorized) {
	checks.push(["instance.checkWhatsapp", () => api.instance.checkWhatsapp(Number(self?.split("@")[0] ?? 0)), (r) => "existsWhatsapp" in r]);
	if (self) {
		checks.push(["message.sendMessage", () => api.message.sendMessage(self, null, "Hello from the compat test"), (r) => typeof r.idMessage === "string"]);
		checks.push(["message.sendLocation", () => api.message.sendLocation(self, null, "Test", "Somewhere", 12.97, 77.59), (r) => typeof r.idMessage === "string"]);
		checks.push([
			"message.sendPoll",
			() => api.message.sendPoll(self, null, "Does the compat test work?", [{ optionName: "Yes" }, { optionName: "No" }]),
			(r) => typeof r.idMessage === "string",
		]);
	}
}

let pass = 0;
for (const [name, call, ok] of checks) {
	try {
		const result = await call();
		const good = ok(result);
		if (good) pass++;
		console.log(`${good ? "PASS" : "FAIL"}  ${name}  ${JSON.stringify(result).slice(0, 110)}`);
	} catch (err) {
		console.log(`FAIL  ${name}  ${err.message}${err.response ? ` [${err.response.status}] ${JSON.stringify(err.response.data)}` : ""}`);
	}
}
console.log(`\n${pass}/${checks.length} official-SDK calls passed (authorized: ${authorized})`);
