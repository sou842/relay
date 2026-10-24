"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { Button, Field, Input } from "./ui";

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const isSignUp = mode === "sign-up";
	// Only allow same-site relative redirects.
	const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const email = String(form.get("email") ?? "").trim();
		const password = String(form.get("password") ?? "");
		setPending(true);
		setError(null);
		const { error } = isSignUp
			? await signUp.email({ name: String(form.get("name") ?? "").trim() || email.split("@")[0], email, password })
			: await signIn.email({ email, password });
		setPending(false);
		if (error) {
			setError(error.message ?? "Something went wrong");
			return;
		}
		router.push(target);
		router.refresh();
	}

	return (
		<form onSubmit={onSubmit} className="grid gap-4">
			{isSignUp && (
				<Field label="Name">
					<Input name="name" autoComplete="name" placeholder="Your name" />
				</Field>
			)}
			<Field label="Email">
				<Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
			</Field>
			<Field label="Password" hint={isSignUp ? "At least 8 characters" : undefined}>
				<Input name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={8} />
			</Field>
			{error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
			<Button type="submit" disabled={pending} className="mt-1">
				{pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
			</Button>
			<p className="text-center text-sm text-muted">
				{isSignUp ? "Already have an account? " : "New here? "}
				<Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-medium text-accent-strong hover:underline">
					{isSignUp ? "Sign in" : "Create an account"}
				</Link>
			</p>
		</form>
	);
}
