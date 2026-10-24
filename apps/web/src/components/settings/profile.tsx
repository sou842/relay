"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function ProfileForm({ name, email }: { name: string; email: string }) {
	const router = useRouter();
	const [value, setValue] = useState(name);
	const [busy, setBusy] = useState(false);
	const dirty = value.trim() !== name && value.trim().length > 0;

	return (
		<form
			className="grid max-w-md gap-4"
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				const { error } = await authClient.updateUser({ name: value.trim() });
				setBusy(false);
				if (error) return toast.error(error.message ?? "Could not update your name");
				toast.success("Profile updated");
				router.refresh();
			}}
		>
			<Field label="Name">
				<Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} required />
			</Field>
			<Field label="Email" hint="Your sign-in address. It can't be changed here.">
				<Input value={email} disabled readOnly />
			</Field>
			<div>
				<Button type="submit" disabled={!dirty || busy}>
					{busy ? "Saving…" : "Save changes"}
				</Button>
			</div>
		</form>
	);
}
