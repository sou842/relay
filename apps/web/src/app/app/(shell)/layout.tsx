import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { requireSession } from "@/lib/auth";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
	const { user } = await requireSession();
	return (
		<div className="flex min-h-screen flex-col bg-bg">
			<header className="border-b border-line bg-panel">
				<div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
					<Logo href="/app" />
					<AppNav />
					<div className="flex justify-end">
						<UserMenu name={user.name} email={user.email} />
					</div>
				</div>
			</header>
			<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
		</div>
	);
}
