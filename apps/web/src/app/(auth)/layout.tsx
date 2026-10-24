import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 py-12">
			<div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-96" />
			<ThemeToggle className="absolute right-4 top-4" />
			<Logo className="relative mb-8" />
			<div className="relative w-full max-w-sm rounded-2xl border border-line bg-panel p-7 shadow-sm">{children}</div>
		</main>
	);
}
