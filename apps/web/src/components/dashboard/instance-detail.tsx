"use client";

import { Activity, Check, ChevronRight, Copy, Eye, EyeOff, Hash, KeyRound, LayoutDashboard, LogOut, MessageSquareText, Pencil, RefreshCw, RotateCw, Server, ShieldAlert, Smartphone, Trash2, Webhook } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Dialog } from "@/components/dialog";
import { Button, buttonClass, Field, Input, StatePill, Switch } from "@/components/ui";
import { api, callMethod } from "@/lib/client-api";
import type { InstanceSummary } from "@/lib/instances";
import { providerInfo } from "@/lib/providers";
import { useApi, useMethod } from "@/lib/swr";
import { useInstanceEvents } from "@/lib/use-instance-events";
import { cn, formatPhone } from "@/lib/utils";

interface Account {
	stateInstance: string;
	phone: string;
	avatar: string;
}

type TabId = "overview" | "api" | "webhooks" | "danger";

const TABS: { id: TabId; label: string; icon: typeof Webhook }[] = [
	{ id: "overview", label: "Overview", icon: LayoutDashboard },
	{ id: "api", label: "API access", icon: KeyRound },
	{ id: "webhooks", label: "Webhooks & settings", icon: Webhook },
	{ id: "danger", label: "Danger zone", icon: ShieldAlert },
];

/** Section with a header row; the building block for every tab. */
function Panel({ title, description, action, danger, children }: { title: string; description?: string; action?: React.ReactNode; danger?: boolean; children: React.ReactNode }) {
	return (
		<section className={cn("overflow-hidden rounded-xl border bg-panel", danger ? "border-danger/30" : "border-line")}>
			<div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
				<div>
					<h2 className="font-medium">{title}</h2>
					{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
				</div>
				{action}
			</div>
			<div className="p-5">{children}</div>
		</section>
	);
}

function InfoTile({ label, icon: Icon, children }: { label: string; icon: typeof Webhook; children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-line bg-panel p-4">
			<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
				<Icon className="size-3.5" /> {label}
			</div>
			<div className="mt-2 truncate text-base font-medium">{children}</div>
		</div>
	);
}

export function InstanceDetail({ instance }: { instance: InstanceSummary }) {
	const [name, setName] = useState(instance.name);
	const [tab, setTab] = useState<TabId>("overview");
	const provider = providerInfo(instance.provider);
	const { data: accountData, error: accountError, mutate: mutateAccount } = useApi<Account>(`/api/instances/${instance.id}`);
	const account: Account = accountError ? { stateInstance: "offline", phone: "", avatar: "" } : (accountData ?? { stateInstance: "starting", phone: "", avatar: "" });

	// Restore the tab from the URL hash (#api, #webhooks, …) so links and reloads land where you were.
	useEffect(() => {
		const id = window.location.hash.slice(1) as TabId;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- the hash only exists on the client, so it can't seed the initial state without a hydration mismatch
		if (TABS.some((t) => t.id === id)) setTab(id);
	}, []);
	const selectTab = (id: TabId) => {
		setTab(id);
		window.history.replaceState(null, "", id === "overview" ? window.location.pathname : `#${id}`);
	};

	const connected = useInstanceEvents(instance.id, (event) => {
		if (event.type !== "state") return;
		// Show the new state at once; once linked, refetch to pick up the phone number and avatar.
		void mutateAccount((a) => ({ ...(a ?? account), stateInstance: event.stateInstance }), { revalidate: event.stateInstance === "authorized" });
	});
	const state = connected || account.stateInstance !== "starting" ? account.stateInstance : "starting";
	const authorized = state === "authorized";

	return (
		<div className="grid gap-6">
			<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
				<Link href="/app" className="hover:text-fg">
					Instances
				</Link>
				<ChevronRight className="size-3.5" />
				<span className="truncate text-fg">{name}</span>
			</nav>

			<div className="overflow-hidden rounded-xl border border-line bg-panel">
				<div className="h-16 bg-linear-to-r from-accent/25 via-accent/10 to-transparent" />
				<div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5">
					<div className="-mt-8 flex min-w-0 items-end gap-4">
						{account.avatar ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={account.avatar} alt="" className="size-20 shrink-0 rounded-2xl border-4 border-panel object-cover" />
						) : (
							<div className="grid size-20 shrink-0 place-items-center rounded-2xl border-4 border-panel bg-accent text-3xl font-semibold text-accent-fg">{name.slice(0, 1).toUpperCase()}</div>
						)}
						<div className="min-w-0 pb-1">
							<div className="flex items-center gap-1">
								<h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
								<RenameButton instanceId={instance.id} name={name} onRenamed={setName} />
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
								<StatePill state={state} />
								<span>
									{provider.label} · #{instance.gatewayId}
								</span>
								{account.phone && <span>{formatPhone(account.phone)}</span>}
							</div>
						</div>
					</div>
					<Link href={`/app/i/${instance.id}/chat`} aria-disabled={!authorized} className={buttonClass("primary", authorized ? "" : "pointer-events-none opacity-50")}>
						<MessageSquareText className="size-4" /> Open chats
					</Link>
				</div>
				<div role="tablist" aria-label="Instance sections" className="flex gap-1 overflow-x-auto border-t border-line px-3">
					{TABS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							onClick={() => selectTab(id)}
							className={cn(
								"cursor-pointer relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm transition",
								tab === id ? "font-medium text-fg" : "text-muted hover:text-fg",
								id === "danger" && tab !== id && "hover:text-danger",
							)}
						>
							<Icon className="size-4" />
							{label}
							{tab === id && <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full", id === "danger" ? "bg-danger" : "bg-accent")} />}
						</button>
					))}
				</div>
			</div>

			{state === "offline" && (
				<div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">
					The gateway is not reachable. Start it with <code className="rounded bg-panel-2 px-1.5 py-0.5">npm run gateway</code> and refresh.
				</div>
			)}

			{tab === "overview" && (
				<>
					{!authorized && state !== "offline" && <LinkCard instanceId={instance.id} state={state} />}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<InfoTile label="Status" icon={Activity}>
							<StatePill state={state} />
						</InfoTile>
						<InfoTile label="Phone" icon={Smartphone}>
							{account.phone ? formatPhone(account.phone) : <span className="text-muted">Not linked</span>}
						</InfoTile>
						<InfoTile label="Instance ID" icon={Hash}>
							<span className="font-mono">{instance.gatewayId}</span>
						</InfoTile>
						<InfoTile label="Provider" icon={Server}>
							{provider.label}
						</InfoTile>
					</div>
					{authorized && <AccountCard instanceId={instance.id} />}
				</>
			)}
			{tab === "api" && <CredentialsCard instanceId={instance.id} urlPrefix={provider.urlPrefix} />}
			{tab === "webhooks" && <SettingsCard instanceId={instance.id} />}
			{tab === "danger" && <DangerZone instance={{ ...instance, name }} />}
		</div>
	);
}

function RenameButton({ instanceId, name, onRenamed }: { instanceId: string; name: string; onRenamed: (n: string) => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)} aria-label="Rename" className="cursor-pointer grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg">
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
	const [mode, setMode] = useState<"qr" | "code">("qr");
	const [code, setCode] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	// WhatsApp rotates the code roughly every 20 seconds; poll faster so the shown code is never stale.
	const { data: qrRes } = useMethod<{ type: string; message: string }>(mode === "qr" ? instanceId : null, "qr", undefined, { refreshInterval: 3000, dedupingInterval: 0 });
	const qr = qrRes?.type === "qrCode" ? qrRes.message : null;

	return (
		<Panel title="Link your phone" description="Scan the QR code, or request a pairing code with your phone number.">
			<div className="grid gap-8 md:grid-cols-[1fr_auto]">
				<div>
					{mode === "qr" ? (
						<ol className="grid gap-3 text-sm">
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
							className="grid max-w-sm gap-3"
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
					<button type="button" className="cursor-pointer mt-6 text-sm font-medium text-accent-strong hover:underline" onClick={() => setMode(mode === "qr" ? "code" : "qr")}>
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
			</div>
		</Panel>
	);
}

function Step({ n }: { n: number }) {
	return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent-strong">{n}</span>;
}

// ---- account ---------------------------------------------------------------

function AccountCard({ instanceId }: { instanceId: string }) {
	const [confirmLogout, setConfirmLogout] = useState(false);
	const { mutate } = useSWRConfig();
	return (
		<Panel
			title="Session"
			description="The gateway runs as a linked device. Your phone can be offline; open WhatsApp on it at least every two weeks."
			action={
				<div className="flex shrink-0 flex-wrap gap-2">
					<Button
						variant="secondary"
						onClick={async () => {
							await callMethod(instanceId, "reboot").catch((err) => toast.error(err.message));
							toast.success("Reconnecting…");
							void mutate(`/api/instances/${instanceId}`);
						}}
					>
						<RotateCw className="size-4" /> Reconnect
					</Button>
					<Button variant="secondary" onClick={() => setConfirmLogout(true)}>
						<LogOut className="size-4" /> Unlink phone
					</Button>
				</div>
			}
		>
			<p className="text-sm text-muted">Reconnect restarts the connection to WhatsApp. Unlink removes the gateway from your phone&apos;s linked devices; chat history here is kept.</p>
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
							void mutate(`/api/instances/${instanceId}`);
						}}
					>
						Unlink
					</Button>
				</div>
			</Dialog>
		</Panel>
	);
}

// ---- credentials -----------------------------------------------------------

interface Credentials {
	apiUrl: string;
	urlPrefix: string;
	idInstance: number;
	apiTokenInstance: string;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
	const [done, setDone] = useState(false);
	return (
		<button
			type="button"
			aria-label={label}
			className="cursor-pointer grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
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
	const { data: cred, mutate: mutateCred } = useApi<Credentials>(`/api/instances/${instanceId}/credentials`);
	const [reveal, setReveal] = useState(false);
	const [confirmRotate, setConfirmRotate] = useState(false);

	if (!cred)
		return (
			<Panel title="API credentials">
				<p className="text-sm text-muted">Loading…</p>
			</Panel>
		);

	const masked = `${cred.apiTokenInstance.slice(0, 6)}${"•".repeat(20)}${cred.apiTokenInstance.slice(-4)}`;
	const example = `curl -X POST "${cred.apiUrl}/${urlPrefix}${cred.idInstance}/sendMessage/${reveal ? cred.apiTokenInstance : "{apiTokenInstance}"}" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId":"919876543210@c.us","message":"Hello"}'`;

	const row = "flex items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/60 py-1 pl-3 pr-1 font-mono text-sm";

	return (
		<div className="grid items-start gap-6 lg:grid-cols-2">
			<Panel
				title="API credentials"
				description="GREEN-API-compatible. Works with their official SDKs (set the host to the URL below)."
				action={
					<Link href="/docs/api" className="shrink-0 text-sm text-accent-strong hover:underline">
						API docs
					</Link>
				}
			>
				<dl className="grid gap-4">
					<div>
						<dt className="mb-1 text-xs font-medium text-muted">apiUrl</dt>
						<dd className={row}>
							<span className="truncate">{cred.apiUrl}</span>
							<CopyButton value={cred.apiUrl} />
						</dd>
					</div>
					<div>
						<dt className="mb-1 text-xs font-medium text-muted">idInstance</dt>
						<dd className={row}>
							<span className="truncate">{cred.idInstance}</span>
							<CopyButton value={String(cred.idInstance)} />
						</dd>
					</div>
					<div>
						<dt className="mb-1 text-xs font-medium text-muted">apiTokenInstance</dt>
						<dd className={row}>
							<span className="truncate">{reveal ? cred.apiTokenInstance : masked}</span>
							<span className="flex">
								<button type="button" aria-label={reveal ? "Hide" : "Show"} onClick={() => setReveal(!reveal)} className="cursor-pointer grid size-8 place-items-center rounded-lg text-muted hover:bg-panel hover:text-fg">
									{reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
								</button>
								<CopyButton value={cred.apiTokenInstance} />
							</span>
						</dd>
					</div>
				</dl>
				<div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
					<p className="text-xs text-muted">Rotating the token immediately breaks scripts that use the old one.</p>
					<Button variant="secondary" onClick={() => setConfirmRotate(true)} className="shrink-0 text-danger">
						<RefreshCw className="size-4" /> Rotate token
					</Button>
				</div>
			</Panel>

			<Panel title="Quick start" description="Send a message with curl." action={<CopyButton value={example} label="Copy example" />}>
				<pre className="overflow-x-auto rounded-lg bg-(--code-bg) p-4 text-xs leading-relaxed text-(--code-fg)">{example}</pre>
				<p className="mt-3 text-xs text-muted">{reveal ? "The example contains your real token." : "Reveal the token to fill it into the example."}</p>
			</Panel>

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
								void mutateCred({ ...cred, apiTokenInstance }, { revalidate: false });
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
		</div>
	);
}

// ---- settings ----------------------------------------------------------------

type Settings = Record<string, string | number>;

const NOTIFICATIONS: [string, string][] = [
	["incomingWebhook", "Incoming messages"],
	["outgoingMessageWebhook", "Messages sent from phone"],
	["outgoingAPIMessageWebhook", "Messages sent via API"],
	["outgoingWebhook", "Delivery & read statuses"],
	["stateWebhook", "Instance state changes"],
	["incomingCallWebhook", "Incoming calls"],
	["editedMessageWebhook", "Edited messages"],
	["deletedMessageWebhook", "Deleted messages"],
];

const BEHAVIOR: [string, string][] = [
	["markIncomingMessagesReaded", "Auto-mark incoming as read"],
	["keepOnlineStatus", "Appear online"],
];

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-sm">
			<span>{label}</span>
			<Switch checked={checked} onChange={onChange} label={label} />
		</div>
	);
}

function SettingsCard({ instanceId }: { instanceId: string }) {
	const { data: saved, mutate: mutateSaved } = useMethod<Settings>(instanceId, "getSettings");
	// Unsaved edits live locally on top of the fetched settings.
	const [draft, setDraft] = useState<Settings | null>(null);
	const [saving, setSaving] = useState(false);
	const settings = draft ?? saved;

	if (!settings)
		return (
			<Panel title="Webhooks & settings">
				<p className="text-sm text-muted">Loading…</p>
			</Panel>
		);

	const set = (key: string, value: string | number) => setDraft({ ...settings, [key]: value });
	const toggle = ([key, label]: [string, string]) => <ToggleRow key={key} label={label} checked={settings[key] === "yes"} onChange={(v) => set(key, v ? "yes" : "no")} />;

	return (
		<form
			className="grid gap-6"
			onSubmit={async (e) => {
				e.preventDefault();
				setSaving(true);
				try {
					const { wid: _wid, ...patch } = settings;
					void _wid;
					await callMethod(instanceId, "setSettings", { body: { ...patch, delaySendMessagesMilliseconds: Number(settings.delaySendMessagesMilliseconds) || 0 } });
					toast.success("Settings saved");
					await mutateSaved();
					setDraft(null);
				} catch (err) {
					toast.error((err as Error).message);
				} finally {
					setSaving(false);
				}
			}}
		>
			<div className="grid items-start gap-6 lg:grid-cols-2">
				<Panel title="Webhook endpoint" description="Where incoming events are delivered.">
					<div className="grid gap-4">
						<Field label="Webhook URL" hint="Leave empty to read notifications with receiveNotification instead.">
							<Input value={String(settings.webhookUrl ?? "")} onChange={(e) => set("webhookUrl", e.target.value)} placeholder="https://example.com/hook" />
						</Field>
						<Field label="Webhook token" hint="Sent as Authorization: Bearer <token>.">
							<Input value={String(settings.webhookUrlToken ?? "")} onChange={(e) => set("webhookUrlToken", e.target.value)} />
						</Field>
					</div>
				</Panel>

				<Panel title="Sending & presence" description="How this instance behaves on WhatsApp.">
					<div className="grid gap-4">
						<Field label="Delay between API sends (ms)" hint="Spacing out messages lowers the risk of a ban.">
							<Input type="number" min={0} value={settings.delaySendMessagesMilliseconds} onChange={(e) => set("delaySendMessagesMilliseconds", e.target.value)} />
						</Field>
						<div className="grid gap-2">{BEHAVIOR.map(toggle)}</div>
					</div>
				</Panel>
			</div>

			<Panel title="Notifications" description="Choose which events are sent to your webhook or queued for receiveNotification.">
				<div className="grid gap-2 md:grid-cols-2">{NOTIFICATIONS.map(toggle)}</div>
			</Panel>

			<div className="flex justify-end">
				<Button type="submit" disabled={saving}>
					{saving ? "Saving…" : "Save settings"}
				</Button>
			</div>
		</form>
	);
}

// ---- danger zone -------------------------------------------------------------

function DangerZone({ instance }: { instance: InstanceSummary }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");
	return (
		<Panel title="Delete instance" description="Unlinks the phone and permanently deletes the session, message history and media stored for this instance." danger>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<p className="text-sm text-muted">This cannot be undone. API credentials for this instance stop working.</p>
				<Button variant="danger" onClick={() => setOpen(true)}>
					<Trash2 className="size-4" /> Delete instance
				</Button>
			</div>
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
		</Panel>
	);
}
