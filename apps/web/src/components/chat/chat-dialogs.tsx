"use client";

import { Check, Crosshair, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/dialog";
import { Button, Field, Input } from "@/components/ui";
import { callMethod } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { chatTitle } from "./format";
import type { Chat } from "./types";

export function NewChatDialog({ instanceId, open, onClose, onOpenChat }: { instanceId: string; open: boolean; onClose: () => void; onOpenChat: (chatId: string) => void }) {
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	return (
		<Dialog open={open} onClose={onClose} title="New chat">
			<form
				className="grid gap-4"
				onSubmit={async (e) => {
					e.preventDefault();
					const digits = String(new FormData(e.currentTarget).get("phone") ?? "").replace(/\D/g, "");
					if (digits.length < 8) return setError("Enter the full number including the country code.");
					setPending(true);
					setError(null);
					try {
						const { existsWhatsapp } = await callMethod<{ existsWhatsapp: boolean }>(instanceId, "checkWhatsapp", { body: { phoneNumber: Number(digits) } });
						if (!existsWhatsapp) return setError("This number isn't on WhatsApp. Check the country code.");
						onOpenChat(`${digits}@c.us`);
						onClose();
					} catch (err) {
						setError((err as Error).message);
					} finally {
						setPending(false);
					}
				}}
			>
				<Field label="Phone number" hint="Country code + number, e.g. 91 98765 43210 for India.">
					<Input name="phone" inputMode="tel" placeholder="+91 98765 43210" autoFocus required />
				</Field>
				{error && <p className="text-sm text-danger">{error}</p>}
				<div className="flex justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" disabled={pending}>
						{pending ? "Checking…" : "Start chat"}
					</Button>
				</div>
			</form>
		</Dialog>
	);
}

export function ForwardDialog({
	instanceId,
	selfId,
	chats,
	open,
	onClose,
	onForward,
}: {
	instanceId: string;
	selfId: string;
	chats: Chat[];
	open: boolean;
	onClose: () => void;
	onForward: (chatIds: string[]) => Promise<void>;
}) {
	const [query, setQuery] = useState("");
	const [picked, setPicked] = useState<string[]>([]);
	const visible = useMemo(() => chats.filter((c) => chatTitle(c, selfId).toLowerCase().includes(query.toLowerCase())), [chats, query, selfId]);

	return (
		<Dialog open={open} onClose={onClose} title="Forward message to">
			<div className="flex h-9 items-center gap-2 rounded-lg bg-panel-2 px-3">
				<Search className="size-4 text-muted" />
				<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="flex-1 bg-transparent text-sm outline-none" autoFocus />
			</div>
			<ul className="wa-scroll -mx-2 mt-3 max-h-80 overflow-y-auto">
				{visible.map((c) => {
					const on = picked.includes(c.id);
					return (
						<li key={c.id}>
							<button
								type="button"
								onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id].slice(-5))}
								className="cursor-pointer flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel-2"
							>
								<span className={cn("grid size-5 place-items-center rounded border-2", on ? "border-accent bg-accent text-white" : "border-muted")}>{on && <Check className="size-3.5" />}</span>
								<Avatar instanceId={instanceId} chatId={c.id} size={36} />
								<span className="truncate text-sm">{chatTitle(c, selfId)}</span>
							</button>
						</li>
					);
				})}
			</ul>
			<div className="mt-4 flex items-center justify-between gap-2">
				<span className="text-xs text-muted">{picked.length ? `${picked.length} selected (max 5)` : "Pick up to 5 chats"}</span>
				<Button
					disabled={!picked.length}
					onClick={async () => {
						try {
							await onForward(picked);
							setPicked([]);
							onClose();
						} catch (err) {
							toast.error((err as Error).message);
						}
					}}
				>
					Forward
				</Button>
			</div>
		</Dialog>
	);
}

export function PollDialog({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (q: string, options: string[], multiple: boolean) => Promise<void> }) {
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState(["", ""]);
	const [multiple, setMultiple] = useState(false);
	const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

	return (
		<Dialog open={open} onClose={onClose} title="Create poll">
			<div className="grid gap-4">
				<Field label="Question">
					<Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask question" autoFocus maxLength={255} />
				</Field>
				<div className="grid gap-2">
					<span className="text-sm font-medium">Options</span>
					{options.map((o, i) => (
						<div key={i} className="flex items-center gap-2">
							<Input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} maxLength={100} />
							{options.length > 2 && (
								<button type="button" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="cursor-pointer text-muted">
									<X className="size-4" />
								</button>
							)}
						</div>
					))}
					{options.length < 12 && (
						<button type="button" onClick={() => setOptions([...options, ""])} className="cursor-pointer flex items-center gap-1.5 justify-self-start text-sm font-medium text-accent-strong">
							<Plus className="size-4" /> Add option
						</button>
					)}
				</div>
				<label className="flex cursor-pointer items-center justify-between text-sm">
					Allow multiple answers
					<input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="size-4 accent-[var(--accent)]" />
				</label>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={async () => {
							try {
								await onSend(question.trim(), options.map((o) => o.trim()).filter(Boolean), multiple);
								setQuestion("");
								setOptions(["", ""]);
								onClose();
							} catch (err) {
								toast.error((err as Error).message);
							}
						}}
					>
						Send
					</Button>
				</div>
			</div>
		</Dialog>
	);
}

export function LocationDialog({
	open,
	onClose,
	onSend,
}: {
	open: boolean;
	onClose: () => void;
	onSend: (loc: { latitude: number; longitude: number; nameLocation?: string; address?: string }) => Promise<void>;
}) {
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [name, setName] = useState("");
	const [address, setAddress] = useState("");
	const [locating, setLocating] = useState(false);
	const valid = Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng));

	return (
		<Dialog open={open} onClose={onClose} title="Send location">
			<div className="grid gap-4">
				<Button
					variant="secondary"
					disabled={locating}
					onClick={() => {
						if (!navigator.geolocation) return toast.error("Location is not available in this browser");
						setLocating(true);
						navigator.geolocation.getCurrentPosition(
							(p) => {
								setLat(p.coords.latitude.toFixed(6));
								setLng(p.coords.longitude.toFixed(6));
								setLocating(false);
							},
							() => {
								toast.error("Couldn't get your location");
								setLocating(false);
							},
							{ enableHighAccuracy: true, timeout: 10000 },
						);
					}}
				>
					<Crosshair className="size-4" /> {locating ? "Locating…" : "Use my current location"}
				</Button>
				<div className="grid grid-cols-2 gap-3">
					<Field label="Latitude">
						<Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="22.5726" inputMode="decimal" />
					</Field>
					<Field label="Longitude">
						<Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="88.3639" inputMode="decimal" />
					</Field>
				</div>
				<Field label="Name (optional)">
					<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office" />
				</Field>
				<Field label="Address (optional)">
					<Input value={address} onChange={(e) => setAddress(e.target.value)} />
				</Field>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={async () => {
							try {
								await onSend({ latitude: parseFloat(lat), longitude: parseFloat(lng), nameLocation: name || undefined, address: address || undefined });
								onClose();
							} catch (err) {
								toast.error((err as Error).message);
							}
						}}
					>
						Send
					</Button>
				</div>
			</div>
		</Dialog>
	);
}

export function ContactDialog({
	open,
	onClose,
	onSend,
}: {
	open: boolean;
	onClose: () => void;
	onSend: (c: { phoneContact: number; firstName?: string; lastName?: string }) => Promise<void>;
}) {
	return (
		<Dialog open={open} onClose={onClose} title="Send contact">
			<form
				className="grid gap-4"
				onSubmit={async (e) => {
					e.preventDefault();
					const f = new FormData(e.currentTarget);
					const digits = String(f.get("phone") ?? "").replace(/\D/g, "");
					if (digits.length < 8) return toast.error("Enter the full number with country code");
					try {
						await onSend({ phoneContact: Number(digits), firstName: String(f.get("first") || "") || undefined, lastName: String(f.get("last") || "") || undefined });
						onClose();
					} catch (err) {
						toast.error((err as Error).message);
					}
				}}
			>
				<Field label="Phone number">
					<Input name="phone" inputMode="tel" placeholder="+91 98765 43210" required autoFocus />
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field label="First name">
						<Input name="first" />
					</Field>
					<Field label="Last name">
						<Input name="last" />
					</Field>
				</div>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit">Send</Button>
				</div>
			</form>
		</Dialog>
	);
}
