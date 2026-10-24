"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SecurityForm() {
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [others, setOthers] = useState(true);
	const [busy, setBusy] = useState(false);

	return (
		<div className="grid gap-8">
			<form
				className="grid max-w-md gap-4"
				onSubmit={async (e) => {
					e.preventDefault();
					setBusy(true);
					const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: others });
					setBusy(false);
					if (error) return toast.error(error.message ?? "Could not change the password");
					toast.success("Password changed");
					setCurrent("");
					setNext("");
				}}
			>
				<Field label="Current password">
					<Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
				</Field>
				<Field label="New password" hint="At least 8 characters.">
					<Input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
				</Field>
				<label className="flex items-center gap-2 text-sm">
					<input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} className="size-4 accent-[var(--accent)]" />
					Sign out of my other devices
				</label>
				<div>
					<Button type="submit" disabled={busy || !current || next.length < 8}>
						{busy ? "Updating…" : "Update password"}
					</Button>
				</div>
			</form>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
				<div>
					<div className="text-sm font-medium">Active sessions</div>
					<div className="text-sm text-muted">Sign out everywhere except this browser.</div>
				</div>
				<Button
					variant="secondary"
					onClick={async () => {
						const { error } = await authClient.revokeOtherSessions();
						if (error) toast.error(error.message ?? "Could not sign out other sessions");
						else toast.success("Other sessions signed out");
					}}
				>
					Sign out other devices
				</Button>
			</div>
		</div>
	);
}
