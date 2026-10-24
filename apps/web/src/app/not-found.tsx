import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
	return (
		<main className="grid min-h-screen place-items-center bg-bg px-4">
			<div className="max-w-md text-center">
				<LogoMark className="mx-auto size-12" />
				<p className="mt-6 font-mono text-sm text-muted">404</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
				<p className="mt-2 text-muted">The page you are looking for does not exist or you do not have access to it.</p>
				<div className="mt-6 flex justify-center gap-3">
					<Link href="/app" className={buttonClass("primary")}>
						Open dashboard
					</Link>
					<Link href="/" className={buttonClass("secondary")}>
						Go home
					</Link>
				</div>
			</div>
		</main>
	);
}
