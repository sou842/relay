import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
			<rect width="32" height="32" rx="9" fill="var(--accent)" />
			<g transform="translate(5 5) scale(0.9167)" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
				<path d="M15 10v1" />
				<path d="M7.528 20.472a1.6 1.6 0 012.277 0l1.057 1.056a1.6 1.6 0 002.276 0l1.057-1.056a1.6 1.6 0 012.277 0l1.114 1.114a1.4 1.4 0 002.414-1V10a8 8 0 00-16 0v10.586a1.4 1.4 0 002.414 1z" />
				<path d="M9 10v1" />
			</g>
		</svg>
	);
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
	return (
		<Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
			<LogoMark />
			<span className="text-lg">Relay</span>
		</Link>
	);
}
