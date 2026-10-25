import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, mongoClient } from "./db";

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is not set");

// On Vercel, fall back to the deployment's own URLs so sign-in also works on preview deployments.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map((host) => `https://${host}`);
// Extra public URLs (team aliases, custom domains), comma-separated.
const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
const baseURL = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

export const auth = betterAuth({
	baseURL,
	trustedOrigins: [...new Set([...(baseURL ? [baseURL] : []), ...vercelOrigins, "https://web-sou842s-projects.vercel.app", ...extraOrigins])],
	// Serverless instances don't share memory, so rate-limit counters live in the database.
	rateLimit: { enabled: true, storage: "database" },
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
