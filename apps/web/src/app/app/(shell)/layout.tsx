import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
	const { user } = await requireSession();
	return (
		<AppShell name={user.name} email={user.email}>
			{children}
		</AppShell>
	);
}
