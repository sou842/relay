"use client";

import { CircleCheck, Layers, MessageCircle, Plus, QrCode, Search, Send, Settings, Smartphone, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Dialog } from "@/components/dialog";
import { LogoMark } from "@/components/logo";
import { Button, Field, Input, StatePill } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { InstanceSummary } from "@/lib/instances";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { cn, formatPhone } from "@/lib/utils";

interface LiveInfo {
	stateInstance: string;
	phone: string;
	avatar: string;
}

const providerIcon: Record<ProviderId, React.ComponentType<{ className?: string }>> = {
	whatsapp: MessageCircle,
	telegram: Send,
};

const OFFLINE: LiveInfo = { stateInstance: "offline", phone: "", avatar: "" };

/** Polls every instance's live state every 10 seconds; an unreachable instance counts as offline. */
function useLiveStates(instances: InstanceSummary[]) {
	const ids = instances.map((i) => i.id);
	const { data } = useSWR(ids.length ? ["live-states", ...ids] : null, async ([, ...list]: string[]) => {
		const entries = await Promise.all(list.map(async (id) => [id, await api<LiveInfo>(`/api/instances/${id}`).catch(() => OFFLINE)] as const));
		return Object.fromEntries(entries) as Record<string, LiveInfo>;
	}, { refreshInterval: 10000 });
	return data ?? {};
}

function Stat({ label, value, hint, icon: Icon, tone }: { label: string; value: number | string; hint: string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
	return (
		<div className="rounded-xl border border-line bg-panel p-5">
			<div className="flex items-center justify-between">
				<span className="text-sm text-muted">{label}</span>
				<span className={cn("grid size-9 place-items-center rounded-lg", tone)}>
					<Icon className="size-[18px]" />
				</span>
			</div>
			<div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
			<div className="mt-1 text-xs text-muted">{hint}</div>
		</div>
	);
}

export function InstanceList({ initial, userName }: { initial: InstanceSummary[]; userName: string }) {
	const [creating, setCreating] = useState(false);
	const [query, setQuery] = useState("");
	const live = useLiveStates(initial);
	const connected = initial.filter((i) => live[i.id]?.stateInstance === "authorized").length;
	const needLinking = initial.filter((i) => live[i.id]?.stateInstance === "notAuthorized").length;
	const offline = initial.length - connected - needLinking;
	const first = userName.trim().split(/\s+/)[0];
	const q = query.trim().toLowerCase();
	const shown = q ? initial.filter((i) => i.name.toLowerCase().includes(q) || String(i.gatewayId).includes(q) || (live[i.id]?.phone ?? "").includes(q)) : initial;

	return (
		<>
			<div className="mb-8 flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Instances</h1>
					<p className="mt-1 text-sm text-muted">{first ? `Welcome back, ${first}. ` : ""}Manage your linked messenger accounts.</p>
				</div>
				<Button onClick={() => setCreating(true)}>
					<Plus className="size-4" />
					New instance
				</Button>
			</div>

			{initial.length === 0 ? (
				<EmptyState onCreate={() => setCreating(true)} />
			) : (
				<>
					<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<Stat label="Total instances" value={initial.length} hint="Linked messenger accounts" icon={Layers} tone="bg-accent/10 text-accent-strong" />
						<Stat label="Connected" value={connected} hint="Ready to send and receive" icon={CircleCheck} tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
						<Stat label="Need linking" value={needLinking} hint={needLinking ? "Scan the QR code to finish" : "Nothing to do"} icon={QrCode} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
						<Stat label="Offline / other" value={offline} hint="Starting, sleeping or unreachable" icon={WifiOff} tone="bg-panel-2 text-muted" />
					</div>

					<section className="overflow-hidden rounded-xl border border-line bg-panel">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
							<div>
								<h2 className="font-medium">All instances</h2>
								<p className="text-xs text-muted">{shown.length} of {initial.length} shown</p>
							</div>
							<div className="relative w-full sm:w-64">
								<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
								<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or ID" className="pl-9" aria-label="Search instances" />
							</div>
						</div>

						<div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto] gap-4 border-b border-line bg-panel-2/60 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted md:grid">
							<span>Instance</span>
							<span>Status</span>
							<span>Phone</span>
							<span className="w-24 text-right">Actions</span>
						</div>
						{shown.length === 0 ? (
							<div className="px-5 py-12 text-center text-sm text-muted">No instances match “{query}”.</div>
						) : (
							<ul className="divide-y divide-line">
								{shown.map((instance) => (
									<InstanceRow key={instance.id} instance={instance} live={live[instance.id] ?? null} />
								))}
							</ul>
						)}
					</section>
				</>
			)}
			<CreateInstanceDialog open={creating} onClose={() => setCreating(false)} />
		</>
	);
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="lp-hatch overflow-hidden rounded-3xl border border-line">
			<div className="mx-auto max-w-lg px-6 py-16 text-center">
				<LogoMark className="mx-auto size-12" />
				<h2 className="mt-6 font-display text-4xl leading-tight">Link your first number</h2>
				<p className="mt-3 text-muted">Create an instance, scan the QR code from WhatsApp, and your inbox and API are ready.</p>
				<ol className="mx-auto mt-8 grid max-w-sm gap-3 text-left text-sm">
					{["Create an instance", "Open WhatsApp → Linked devices → Link a device", "Scan the QR code shown here"].map((t, i) => (
						<li key={t} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
							<span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-medium text-accent-strong">{i + 1}</span>
							{t}
						</li>
					))}
				</ol>
				<div className="mt-8 flex flex-wrap justify-center gap-3">
					<Button onClick={onCreate} className="h-11 rounded-full px-6">
						<Plus className="size-4" />
						New instance
					</Button>
					<Link href="/docs/getting-started" className="inline-flex h-11 items-center rounded-full border border-line bg-panel px-6 text-sm font-medium transition hover:bg-panel-2">
						Read the guide
					</Link>
				</div>
			</div>
		</div>
	);
}

function InstanceRow({ instance, live }: { instance: InstanceSummary; live: LiveInfo | null }) {
	const Icon = providerIcon[instance.provider];
	const needsLink = live?.stateInstance === "notAuthorized";

	return (
		<li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-panel-2/50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto]">
			<div className="flex min-w-0 items-center gap-3">
				{live?.avatar ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={live.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
				) : (
					<div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-strong">
						<Icon className="size-[18px]" />
					</div>
				)}
				<div className="min-w-0">
					<Link href={`/app/i/${instance.id}`} className="block truncate font-medium hover:underline">
						{instance.name}
					</Link>
					<div className="truncate text-xs text-muted">
						{PROVIDERS[instance.provider].label} · #{instance.gatewayId}
					</div>
				</div>
			</div>

			<div className="order-3 md:order-none">
				<StatePill state={live?.stateInstance ?? "starting"} />
			</div>

			<div className="order-4 flex items-center gap-2 text-sm text-muted md:order-none">
				<Smartphone className="size-4 shrink-0" />
				<span className="truncate">{needsLink ? "Not linked yet" : live?.phone ? formatPhone(live.phone) : "—"}</span>
			</div>

			<div className="flex w-24 items-center justify-end gap-1 md:order-none">
				{needsLink ? (
					<Link href={`/app/i/${instance.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-accent-fg transition hover:opacity-90">
						<QrCode className="size-3.5" /> Link
					</Link>
				) : (
					<Link href={`/app/i/${instance.id}/chat`} title="Open chat" aria-label={`Open chat for ${instance.name}`} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg">
						<MessageCircle className="size-4" />
					</Link>
				)}
				<Link href={`/app/i/${instance.id}`} title="Manage instance" aria-label={`Manage ${instance.name}`} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg">
					<Settings className="size-4" />
				</Link>
			</div>
		</li>
	);
}

function CreateInstanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [importing, setImporting] = useState(false);
	return (
		<Dialog open={open} onClose={onClose} title={importing ? "Import existing instance" : "New instance"}>
			{importing ? <ImportForm onCancel={() => setImporting(false)} /> : <CreateForm onClose={onClose} onImport={() => setImporting(true)} />}
		</Dialog>
	);
}

function ImportForm({ onCancel }: { onCancel: () => void }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	return (
		<form
			className="grid gap-4"
			onSubmit={async (e) => {
				e.preventDefault();
				const f = new FormData(e.currentTarget);
				setPending(true);
				try {
					const created = await api<InstanceSummary>("/api/instances/import", {
						body: { idInstance: f.get("id"), apiTokenInstance: f.get("token"), name: f.get("name") },
					});
					toast.success("Instance imported");
					router.push(`/app/i/${created.id}`);
				} catch (err) {
					toast.error((err as Error).message);
					setPending(false);
				}
			}}
		>
			<p className="text-sm text-muted">Attach an instance that already runs on the gateway (for example one created with the gateway CLI). Its linked phone and history come with it.</p>
			<Field label="idInstance">
				<Input name="id" inputMode="numeric" required placeholder="1101000001" autoFocus />
			</Field>
			<Field label="apiTokenInstance">
				<Input name="token" required autoComplete="off" spellCheck={false} />
			</Field>
			<Field label="Name (optional)">
				<Input name="name" maxLength={60} />
			</Field>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="secondary" onClick={onCancel}>
					Back
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? "Importing…" : "Import"}
				</Button>
			</div>
		</form>
	);
}

function CreateForm({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
	const router = useRouter();
	const [provider, setProvider] = useState<ProviderId>("whatsapp");
	const [pending, setPending] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
		setPending(true);
		try {
			const created = await api<InstanceSummary>("/api/instances", { body: { provider, name } });
			toast.success("Instance created. Scan the QR code to link it.");
			router.push(`/app/i/${created.id}`);
		} catch (err) {
			toast.error((err as Error).message);
			setPending(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="grid gap-5">
				<div className="grid gap-2">
					<span className="text-sm font-medium">Messenger</span>
					<div className="grid grid-cols-2 gap-2">
						{Object.values(PROVIDERS).map((p) => {
							const Icon = providerIcon[p.id];
							return (
								<button
									key={p.id}
									type="button"
									disabled={!p.available}
									onClick={() => setProvider(p.id)}
									className={cn(
										"flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
										provider === p.id ? "border-accent bg-accent/10" : "border-line hover:bg-panel-2",
									)}
								>
									<Icon className="size-5 text-accent-strong" />
									<span>
										<span className="block font-medium">{p.label}</span>
										<span className="block text-xs text-muted">{p.available ? "Available" : "Coming soon"}</span>
									</span>
								</button>
							);
						})}
					</div>
				</div>
				<Field label="Name" hint="Only you see this, e.g. “Personal” or “Support line”.">
					<Input name="name" required maxLength={60} placeholder="My WhatsApp" autoFocus />
				</Field>
				<div className="flex items-center justify-between gap-2">
					<button type="button" onClick={onImport} className="cursor-pointer text-sm font-medium text-accent-strong hover:underline">
						Import existing
					</button>
					<div className="flex gap-2">
						<Button type="button" variant="secondary" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={pending}>
							{pending ? "Creating…" : "Create"}
						</Button>
					</div>
				</div>
			</form>
	);
}
