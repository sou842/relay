"use client";

import { ArrowLeft, Check, Copy, Eye, EyeOff, LogOut, MessageSquareText, Pencil, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/dialog";
import { Button, buttonClass, Card, Field, Input, StatePill } from "@/components/ui";
import { api, callMethod } from "@/lib/client-api";
import type { InstanceSummary } from "@/lib/instances";
import { providerInfo } from "@/lib/providers";
import { useInstanceEvents } from "@/lib/use-instance-events";
import { formatPhone } from "@/lib/utils";

interface Account {
	stateInstance: string;
	phone: string;
	avatar: string;
}

export function InstanceDetail({ instance }: { instance: InstanceSummary }) {
	const [name, setName] = useState(instance.name);
	const [account, setAccount] = useState<Account>({ stateInstance: "starting", phone: "", avatar: "" });
	const provider = providerInfo(instance.provider);

	const refreshAccount = useCallback(async () => {
		const info = await api<Account>(`/api/instances/${instance.id}`).catch(() => ({ stateInstance: "offline", phone: "", avatar: "" }));
		setAccount(info);
	}, [instance.id]);

	useEffect(() => {
		let alive = true;
		api<Account>(`/api/instances/${instance.id}`)
			.catch(() => ({ stateInstance: "offline", phone: "", avatar: "" }))
			.then((info) => alive && setAccount(info));
		return () => {
			alive = false;
		};
	}, [instance.id]);

	const connected = useInstanceEvents(instance.id, (event) => {
		if (event.type !== "state") return;
		setAccount((a) => ({ ...a, stateInstance: event.stateInstance }));
		if (event.stateInstance === "authorized") void refreshAccount();
	});
	const state = connected || account.stateInstance !== "starting" ? account.stateInstance : "starting";
	const authorized = state === "authorized";

	return (
		<div className="grid gap-6">
			<div>
				<Link href="/app" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
					<ArrowLeft className="size-4" /> All instances
				</Link>
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						{account.avatar ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={account.avatar} alt="" className="size-14 rounded-full object-cover" />
						) : (
							<div className="grid size-14 place-items-center rounded-full bg-accent/15 text-xl font-semibold text-accent-strong">
								{name.slice(0, 1).toUpperCase()}
							</div>
						)}
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
								<RenameButton instanceId={instance.id} name={name} onRenamed={setName} />
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
								<StatePill state={state} />
								<span>
									{provider.label} · #{instance.gatewayId}
								</span>
								{account.phone && <span>· {formatPhone(account.phone)}</span>}
							</div>
						</div>
					</div>
					<Link
						href={`/app/i/${instance.id}/chat`}
						aria-disabled={!authorized}
						className={buttonClass("primary", authorized ? "" : "pointer-events-none opacity-50")}
					>
						<MessageSquareText className="size-4" /> Open chats
					</Link>
				</div>
			</div>

			{state === "offline" && (
				<Card className="border-danger/40">
					<p className="text-sm">
						The gateway is not reachable. Start it with <code className="rounded bg-panel-2 px-1.5 py-0.5">npm run gateway</code> and refresh.
					</p>
				</Card>
			)}

			{!authorized && state !== "offline" && <LinkCard instanceId={instance.id} state={state} />}

			<div className="grid items-start gap-6 lg:grid-cols-2">
				{authorized && <AccountCard instanceId={instance.id} />}
				<CredentialsCard instanceId={instance.id} urlPrefix={provider.urlPrefix} />
				<SettingsCard instanceId={instance.id} />
				<DangerZone instance={{ ...instance, name }} />
			</div>
		</div>
	);
}

function RenameButton({ instanceId, name, onRenamed }: { instanceId: string; name: string; onRenamed: (n: string) => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)} aria-label="Rename" className="grid size-8 place-items-center rounded-full text-muted hover:bg-panel-2">
				<Pencil className="size-4" />
			</button>
			<Dialog open={open} onClose={() => setOpen(false)} title="Rename instance">
				<form
					className="grid gap-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const next = String(new FormData(e.currentTarget).get("name") ?? "").trim();
						try {
							await api(`/api/instances/${instanceId}`, { method: "PATCH", body: { name: next } });
							onRenamed(next);
							setOpen(false);
						} catch (err) {
							toast.error((err as Error).message);
						}
					}}
				>
					<Input name="name" defaultValue={name} required maxLength={60} autoFocus />
					<div className="flex justify-end gap-2">
						<Button type="button" variant="secondary" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit">Save</Button>
					</div>
				</form>
			</Dialog>
		</>
	);
}

// ---- linking ---------------------------------------------------------------

function LinkCard({ instanceId, state }: { instanceId: string; state: string }) {
	const [qr, setQr] = useState<string | null>(null);
	const [mode, setMode] = useState<"qr" | "code">("qr");
	const [code, setCode] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (mode !== "qr") return;
		let cancelled = false;
		const load = async () => {
			const res = await callMethod<{ type: string; message: string }>(instanceId, "qr").catch(() => null);
			if (!cancelled) setQr(res?.type === "qrCode" ? res.message : null);
		};
		void load();
		// WhatsApp rotates the code roughly every 20 seconds.
		const timer = setInterval(load, 3000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [instanceId, mode]);

	return (
		<Card className="grid gap-8 md:grid-cols-[1fr_auto]">
			<div>
				<h2 className="text-lg font-semibold">Link your phone</h2>
				{mode === "qr" ? (
					<ol className="mt-4 grid gap-3 text-sm">
						<li className="flex gap-3">
							<Step n={1} />
							<span>Open WhatsApp on your phone</span>
						</li>
						<li className="flex gap-3">
							<Step n={2} />
							<span>
								Tap <b>Settings</b> (iPhone) or <b>⋮</b> (Android) → <b>Linked devices</b>
							</span>
						</li>
						<li className="flex gap-3">
							<Step n={3} />
							<span>
								Tap <b>Link a device</b> and point your phone at this code
							</span>
						</li>
					</ol>
				) : (
					<form
						className="mt-4 grid max-w-sm gap-3"
						onSubmit={async (e) => {
							e.preventDefault();
							const phone = String(new FormData(e.currentTarget).get("phone") ?? "").replace(/\D/g, "");
							setPending(true);
							try {
								const res = await callMethod<{ code: string }>(instanceId, "getAuthorizationCode", { body: { phoneNumber: Number(phone) } });
								setCode(res.code.length === 8 ? `${res.code.slice(0, 4)}-${res.code.slice(4)}` : res.code);
							} catch (err) {
								toast.error((err as Error).message);
							} finally {
								setPending(false);
							}
						}}
					>
						<Field label="Phone number with country code" hint="Then on your phone: Linked devices → Link a device → Link with phone number instead.">
							<Input name="phone" inputMode="numeric" placeholder="919876543210" required />
						</Field>
						<Button type="submit" disabled={pending}>
							{pending ? "Requesting…" : "Get code"}
						</Button>
						{code && <div className="rounded-xl bg-panel-2 p-4 text-center font-mono text-3xl font-semibold tracking-[0.3em]">{code}</div>}
					</form>
				)}
				<button type="button" className="mt-6 text-sm font-medium text-accent-strong hover:underline" onClick={() => setMode(mode === "qr" ? "code" : "qr")}>
					{mode === "qr" ? "Link with phone number instead" : "Use QR code instead"}
				</button>
			</div>
			{mode === "qr" && (
				<div className="grid size-[280px] place-items-center justify-self-center rounded-2xl border border-line bg-white p-2">
					{qr ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={`data:image/png;base64,${qr}`} alt="QR code to link WhatsApp" className="size-[264px] [image-rendering:pixelated]" />
					) : (
						<div className="flex flex-col items-center gap-2 text-sm text-zinc-500">
							<RefreshCw className="size-5 animate-spin" />
							{state === "starting" ? "Starting…" : "Loading QR…"}
						</div>
					)}
				</div>
			)}
		</Card>
	);
}

function Step({ n }: { n: number }) {
	return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent-strong">{n}</span>;
}

// ---- account ---------------------------------------------------------------

function AccountCard({ instanceId }: { instanceId: string }) {
	const [confirmLogout, setConfirmLogout] = useState(false);
	return (
		<Card>
			<h2 className="text-lg font-semibold">Session</h2>
			<p className="mt-1 text-sm text-muted">The gateway runs as a linked device. Your phone can be offline; open WhatsApp on it at least every two weeks.</p>
			<div className="mt-5 flex flex-wrap gap-2">
				<Button
					variant="secondary"
					onClick={async () => {
						await callMethod(instanceId, "reboot").catch((err) => toast.error(err.message));
						toast.success("Reconnecting…");
					}}
				>
					<RotateCw className="size-4" /> Reconnect
				</Button>
				<Button variant="secondary" onClick={() => setConfirmLogout(true)}>
					<LogOut className="size-4" /> Unlink phone
				</Button>
			</div>
			<Dialog open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Unlink this phone?">
				<p className="text-sm text-muted">The gateway is removed from your phone&apos;s linked devices. Your chat history here is kept; scan a new QR code to link again.</p>
				<div className="mt-6 flex justify-end gap-2">
					<Button variant="secondary" onClick={() => setConfirmLogout(false)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={async () => {
							setConfirmLogout(false);
							await callMethod(instanceId, "logout").catch((err) => toast.error(err.message));
						}}
					>
						Unlink
					</Button>
				</div>
			</Dialog>
		</Card>
	);
}

// ---- credentials -----------------------------------------------------------

interface Credentials {
	apiUrl: string;
	urlPrefix: string;
	idInstance: number;
	apiTokenInstance: string;
}

function CopyButton({ value }: { value: string }) {
	const [done, setDone] = useState(false);
	return (
		<button
			type="button"
			aria-label="Copy"
			className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
			onClick={async () => {
				await navigator.clipboard.writeText(value);
				setDone(true);
				setTimeout(() => setDone(false), 1500);
			}}
		>
			{done ? <Check className="size-4 text-accent-strong" /> : <Copy className="size-4" />}
		</button>
	);
}

function CredentialsCard({ instanceId, urlPrefix }: { instanceId: string; urlPrefix: string }) {
	const [cred, setCred] = useState<Credentials | null>(null);
	const [reveal, setReveal] = useState(false);
	const [confirmRotate, setConfirmRotate] = useState(false);

	useEffect(() => {
		api<Credentials>(`/api/instances/${instanceId}/credentials`).then(setCred, () => setCred(null));
	}, [instanceId]);

	if (!cred) return <Card><h2 className="text-lg font-semibold">API credentials</h2><p className="mt-2 text-sm text-muted">Loading…</p></Card>;

	const masked = `${cred.apiTokenInstance.slice(0, 6)}${"•".repeat(20)}${cred.apiTokenInstance.slice(-4)}`;
	const example = `curl -X POST "${cred.apiUrl}/${urlPrefix}${cred.idInstance}/sendMessage/${reveal ? cred.apiTokenInstance : "{apiTokenInstance}"}" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId":"919876543210@c.us","message":"Hello"}'`;

	return (
		<Card>
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-lg font-semibold">API credentials</h2>
				<Link href="/docs/api" className="text-sm text-accent-strong hover:underline">
					API docs
				</Link>
			</div>
			<p className="mt-1 text-sm text-muted">GREEN-API-compatible. Works with their official SDKs (set the host to the URL below).</p>
			<dl className="mt-4 grid gap-3 text-sm">
				{[
					["apiUrl", cred.apiUrl],
					["idInstance", String(cred.idInstance)],
				].map(([label, value]) => (
					<div key={label}>
						<dt className="text-xs text-muted">{label}</dt>
						<dd className="flex items-center justify-between gap-2 rounded-lg bg-panel-2 py-1 pl-3 pr-1 font-mono">
							<span className="truncate">{value}</span>
							<CopyButton value={value} />
						</dd>
					</div>
				))}
				<div>
					<dt className="text-xs text-muted">apiTokenInstance</dt>
					<dd className="flex items-center justify-between gap-1 rounded-lg bg-panel-2 py-1 pl-3 pr-1 font-mono">
						<span className="truncate">{reveal ? cred.apiTokenInstance : masked}</span>
						<span className="flex">
							<button type="button" aria-label={reveal ? "Hide" : "Show"} onClick={() => setReveal(!reveal)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel hover:text-fg">
								{reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
							</button>
							<CopyButton value={cred.apiTokenInstance} />
						</span>
					</dd>
				</div>
			</dl>
			<pre className="mt-4 overflow-x-auto rounded-xl bg-(--code-bg) p-4 text-xs leading-relaxed text-(--code-fg)">{example}</pre>
			<button type="button" onClick={() => setConfirmRotate(true)} className="mt-3 text-sm font-medium text-danger hover:underline">
				Rotate token
			</button>
			<Dialog open={confirmRotate} onClose={() => setConfirmRotate(false)} title="Rotate API token?">
				<p className="text-sm text-muted">Scripts using the current token stop working immediately.</p>
				<div className="mt-6 flex justify-end gap-2">
					<Button variant="secondary" onClick={() => setConfirmRotate(false)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={async () => {
							setConfirmRotate(false);
							try {
								const { apiTokenInstance } = await api<{ apiTokenInstance: string }>(`/api/instances/${instanceId}/credentials`, { method: "POST" });
								setCred({ ...cred, apiTokenInstance });
								setReveal(true);
								toast.success("Token rotated");
							} catch (err) {
								toast.error((err as Error).message);
							}
						}}
					>
						Rotate
					</Button>
				</div>
			</Dialog>
		</Card>
	);
}

// ---- settings ----------------------------------------------------------------

type Settings = Record<string, string | number>;

const TOGGLES: [string, string][] = [
	["incomingWebhook", "Incoming messages"],
	["outgoingMessageWebhook", "Messages sent from phone"],
	["outgoingAPIMessageWebhook", "Messages sent via API"],
	["outgoingWebhook", "Delivery & read statuses"],
	["stateWebhook", "Instance state changes"],
	["incomingCallWebhook", "Incoming calls"],
	["editedMessageWebhook", "Edited messages"],
	["deletedMessageWebhook", "Deleted messages"],
	["markIncomingMessagesReaded", "Auto-mark incoming as read"],
	["keepOnlineStatus", "Appear online"],
];

function SettingsCard({ instanceId }: { instanceId: string }) {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		callMethod<Settings>(instanceId, "getSettings").then(setSettings, () => setSettings(null));
	}, [instanceId]);

	if (!settings) return <Card><h2 className="text-lg font-semibold">Settings</h2><p className="mt-2 text-sm text-muted">Loading…</p></Card>;

	const set = (key: string, value: string | number) => setSettings({ ...settings, [key]: value });

	return (
		<Card>
			<h2 className="text-lg font-semibold">Webhooks &amp; settings</h2>
			<form
				className="mt-4 grid gap-4"
				onSubmit={async (e) => {
					e.preventDefault();
					setSaving(true);
					try {
						const { wid: _wid, ...patch } = settings;
						void _wid;
						await callMethod(instanceId, "setSettings", { body: { ...patch, delaySendMessagesMilliseconds: Number(settings.delaySendMessagesMilliseconds) || 0 } });
						toast.success("Settings saved");
					} catch (err) {
						toast.error((err as Error).message);
					} finally {
						setSaving(false);
					}
				}}
			>
				<Field label="Webhook URL" hint="Leave empty to read notifications with receiveNotification instead.">
					<Input value={String(settings.webhookUrl ?? "")} onChange={(e) => set("webhookUrl", e.target.value)} placeholder="https://example.com/hook" />
				</Field>
				<Field label="Webhook token" hint="Sent as Authorization: Bearer <token>.">
					<Input value={String(settings.webhookUrlToken ?? "")} onChange={(e) => set("webhookUrlToken", e.target.value)} />
				</Field>
				<Field label="Delay between API sends (ms)" hint="Spacing out messages lowers the risk of a ban.">
					<Input type="number" min={0} value={settings.delaySendMessagesMilliseconds} onChange={(e) => set("delaySendMessagesMilliseconds", e.target.value)} />
				</Field>
				<fieldset className="grid gap-2">
					<legend className="mb-1 text-sm font-medium">Notifications</legend>
					{TOGGLES.map(([key, label]) => (
						<label key={key} className="flex items-center justify-between gap-3 text-sm">
							{label}
							<input
								type="checkbox"
								className="size-4 accent-[var(--accent)]"
								checked={settings[key] === "yes"}
								onChange={(e) => set(key, e.target.checked ? "yes" : "no")}
							/>
						</label>
					))}
				</fieldset>
				<Button type="submit" disabled={saving} className="justify-self-start">
					{saving ? "Saving…" : "Save settings"}
				</Button>
			</form>
		</Card>
	);
}

// ---- danger zone -------------------------------------------------------------

function DangerZone({ instance }: { instance: InstanceSummary }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");
	return (
		<Card className="border-danger/30">
			<h2 className="text-lg font-semibold">Delete instance</h2>
			<p className="mt-1 text-sm text-muted">Unlinks the phone and permanently deletes the session, message history and media stored for this instance.</p>
			<Button variant="danger" className="mt-5" onClick={() => setOpen(true)}>
				<Trash2 className="size-4" /> Delete instance
			</Button>
			<Dialog open={open} onClose={() => setOpen(false)} title="Delete instance?">
				<p className="text-sm text-muted">
					Type <b className="text-fg">{instance.name}</b> to confirm. This cannot be undone.
				</p>
				<Input className="mt-4" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
				<div className="mt-6 flex justify-end gap-2">
					<Button variant="secondary" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						disabled={typed !== instance.name}
						onClick={async () => {
							try {
								await api(`/api/instances/${instance.id}`, { method: "DELETE" });
								toast.success("Instance deleted");
								router.push("/app");
								router.refresh();
							} catch (err) {
								toast.error((err as Error).message);
							}
						}}
					>
						Delete
					</Button>
				</div>
			</Dialog>
		</Card>
	);
}
