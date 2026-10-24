import { requireSession } from "@/lib/auth";
import { SWRProvider } from "@/lib/swr";

// Everything under /app requires a verified session (proxy.ts only checks the cookie).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
	await requireSession();
	return <SWRProvider>{children}</SWRProvider>;
}
