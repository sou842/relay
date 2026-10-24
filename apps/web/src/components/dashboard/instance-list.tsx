"use client";

import { ArrowRight, MessageCircle, Plus, QrCode, Send, Settings, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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

/** Polls every instance's live state; one request per instance every 10 seconds. */
function useLiveStates(instances: InstanceSummary[]) {
	const [live, setLive] = useState<Record<string, LiveInfo>>({});
	const key = instances.map((i) => i.id).join(",");

	useEffect(() => {
		let cancelled = false;
		const ids = key ? key.split(",") : [];
		const load = () =>
			ids.forEach((id) =>
				api<LiveInfo>(`/api/instances/${id}`)
					.then((info) => !cancelled && setLive((m) => ({ ...m, [id]: info })))
					.catch(() => !cancelled && setLive((m) => ({ ...m, [id]: { stateInstance: "offline", phone: "", avatar: "" } }))),
			);
		load();
		const timer = setInterval(load, 10000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [key]);

	return live;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint: string }) {
	return (
		<div className="bg-panel px-6 py-5">
			<div className="text-sm text-muted">{label}</div>
			<div className="mt-1 font-display text-4xl leading-none">{value}</div>
			<div className="mt-2 text-xs text-muted">{hint}</div>
		</div>
	);
}

export function InstanceList({ initial, userName }: { initial: InstanceSummary[]; userName: string }) {
	const [creating, setCreating] = useState(false);
	const live = useLiveStates(initial);
	const connected = initial.filter((i) => live[i.id]?.stateInstance === "authorized").length;
	const needLinking = initial.filter((i) => live[i.id]?.stateInstance === "notAuthorized").length;
	const first = userName.trim().split(/\s+/)[0];

	return (
		<>
			<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="text-sm text-muted">{first ? `Welcome back, ${first}` : "Welcome back"}</p>
					<h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Your instances</h1>
				</div>
				<Button onClick={() => setCreating(true)} className="h-11 rounded-full px-5">
					<Plus className="size-4" />
					New instance
				</Button>
			</div>

			{initial.length === 0 ? (
				<EmptyState onCreate={() => setCreating(true)} />
			) : (
				<>
					<div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
						<Stat label="Instances" value={initial.length} hint="Linked messenger accounts" />
						<Stat label="Connected" value={connected} hint="Ready to send and receive" />
						<Stat label="Need linking" value={needLinking} hint={needLinking ? "Scan the QR code to finish" : "Nothing to do"} />
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{initial.map((instance) => (
							<InstanceCard key={instance.id} instance={instance} live={live[instance.id] ?? null} />
						))}
						<button
							type="button"
							onClick={() => setCreating(true)}
							className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line text-muted transition hover:border-accent hover:bg-panel hover:text-accent-strong"
						>
							<span className="grid size-11 place-items-center rounded-full border border-line bg-panel">
								<Plus className="size-5" />
							</span>
							<span className="text-sm font-medium">New instance</span>
						</button>
					</div>
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

function InstanceCard({ instance, live }: { instance: InstanceSummary; live: LiveInfo | null }) {
	const Icon = providerIcon[instance.provider];
	const opensChat = live?.stateInstance !== "notAuthorized";
	const needsLink = live?.stateInstance === "notAuthorized";

	return (
		<div className="group relative flex min-h-52 flex-col rounded-2xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-black/5">
			<div className="flex items-start justify-between gap-3">
				{live?.avatar ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={live.avatar} alt="" className="size-12 rounded-2xl object-cover" />
				) : (
					<div className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent-strong">
						<Icon className="size-5" />
					</div>
				)}
				<StatePill state={live?.stateInstance ?? "starting"} />
			</div>

			<div className="mt-4 min-w-0">
				<div className="truncate text-lg font-medium tracking-tight">
					{/* stretched link: the whole card opens the chat (or the QR page until the instance is linked) */}
					<Link href={opensChat ? `/app/i/${instance.id}/chat` : `/app/i/${instance.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
						{instance.name}
					</Link>
				</div>
				<div className="mt-0.5 text-xs text-muted">
					{PROVIDERS[instance.provider].label} · #{instance.gatewayId}
				</div>
			</div>

			<div className="mt-auto flex items-center gap-2 border-t border-line pt-4 text-sm">
				{needsLink ? (
					<span className="flex items-center gap-2 font-medium text-accent-strong">
						<QrCode className="size-4" /> Scan to link
						<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
					</span>
				) : (
					<span className="flex items-center gap-2 text-muted">
						<Smartphone className="size-4" />
						{live?.phone ? formatPhone(live.phone) : "—"}
					</span>
				)}
				<Link
					href={`/app/i/${instance.id}`}
					title="Manage instance"
					aria-label={`Manage ${instance.name}`}
					className="relative z-10 ml-auto grid size-8 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-fg"
				>
					<Settings className="size-4" />
				</Link>
			</div>
		</div>
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
					<button type="button" onClick={onImport} className="text-sm font-medium text-accent-strong hover:underline">
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
