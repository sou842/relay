"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<main className="grid min-h-screen place-items-center bg-bg px-4">
			<div className="max-w-md text-center">
				<LogoMark className="mx-auto size-12" />
				<h1 className="mt-6 text-2xl font-semibold tracking-tight">Something went wrong</h1>
				<p className="mt-2 text-muted">An unexpected error occurred. Try again, and if it keeps happening check that the gateway and database are reachable.</p>
				{error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
				<div className="mt-6 flex justify-center gap-3">
					<button type="button" onClick={reset} className={buttonClass("primary")}>
						<RotateCw className="size-4" /> Try again
					</button>
					<Link href="/" className={buttonClass("secondary")}>
						Go home
					</Link>
				</div>
			</div>
		</main>
	);
}
