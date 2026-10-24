import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
	if (await getSession()) redirect("/app");
	const { next } = await searchParams;
	return (
		<>
			<h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
			<p className="mb-8 text-muted">Sign in to manage your instances and chats.</p>
			<AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />
		</>
	);
}
