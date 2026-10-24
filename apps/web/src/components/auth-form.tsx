"use client";

import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { Button, Field, Input } from "./ui";

function IconInput({ icon: Icon, end, ...props }: React.ComponentProps<typeof Input> & { icon: typeof Mail; end?: React.ReactNode }) {
	return (
		<div className="relative">
			<Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
			<Input {...props} className={end ? "h-11 pl-9 pr-11" : "h-11 pl-9"} />
			{end && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{end}</div>}
		</div>
	);
}

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [show, setShow] = useState(false);
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
		<form onSubmit={onSubmit} className="grid gap-5">
			{isSignUp && (
				<Field label="Name">
					<IconInput icon={User} name="name" autoComplete="name" placeholder="Your name" />
				</Field>
			)}
			<Field label="Email">
				<IconInput icon={Mail} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
			</Field>
			<Field label="Password" hint={isSignUp ? "At least 8 characters" : undefined}>
				<IconInput
					icon={Lock}
					name="password"
					type={show ? "text" : "password"}
					autoComplete={isSignUp ? "new-password" : "current-password"}
					required
					minLength={8}
					placeholder="••••••••"
					end={
						<button
							type="button"
							onClick={() => setShow((s) => !s)}
							aria-label={show ? "Hide password" : "Show password"}
							className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg"
						>
							{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
						</button>
					}
				/>
			</Field>
			{error && (
				<p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm text-danger">
					<AlertCircle className="mt-0.5 size-4 shrink-0" />
					{error}
				</p>
			)}
			<Button type="submit" disabled={pending} className="h-11 w-full">
				{pending && <Loader2 className="size-4 animate-spin" />}
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
