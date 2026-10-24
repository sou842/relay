import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, mongoClient } from "./db";

export const auth = betterAuth({
	database: mongodbAdapter(db, { client: mongoClient }),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		cookieCache: { enabled: true, maxAge: 5 * 60 },
	},
	// Must stay last: lets server actions set auth cookies.
	plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

export async function getSession(): Promise<Session | null> {
	return auth.api.getSession({ headers: await headers() });
}

/** For pages under /app: returns the session or redirects to sign-in. */
export async function requireSession(): Promise<Session> {
	const session = await getSession();
	if (!session) redirect("/sign-in");
	return session;
}
