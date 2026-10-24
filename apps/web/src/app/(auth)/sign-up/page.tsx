import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
	if (await getSession()) redirect("/app");
	return (
		<>
			<h1 className="mb-1 text-xl font-semibold">Create your account</h1>
			<p className="mb-6 text-sm text-muted">Then link a number and start chatting from the browser.</p>
			<AuthForm mode="sign-up" />
		</>
	);
}
