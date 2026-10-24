import { cn } from "@/lib/utils";

// Delivery ticks and small glyphs drawn for this UI.

export function Ticks({ status, className }: { status?: string; className?: string }) {
	if (status === "pending") {
		return (
			<svg viewBox="0 0 16 15" className={cn("h-[15px] w-4", className)} aria-label="Pending">
				<circle cx="8" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
				<path d="M8 4.5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			</svg>
		);
	}
	if (status === "failed") {
		return (
			<svg viewBox="0 0 16 15" className={cn("h-[15px] w-4 text-red-500", className)} aria-label="Failed">
				<circle cx="8" cy="7.5" r="6" fill="currentColor" />
				<path d="M8 4v4.2M8 10.3v.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
			</svg>
		);
	}
	const double = status === "delivered" || status === "read";
	return (
		<svg
			viewBox="0 0 18 13"
			className={cn("h-[13px] w-[18px]", status === "read" ? "text-wa-tick-read" : "text-wa-muted", className)}
			aria-label={status ?? "sent"}
		>
			<path d="M1.5 7.2l3.3 3.3L11.5 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
			{double && <path d="M7.4 10.2l.3.3L14.4 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
		</svg>
	);
}

export function EmptyChatsArt({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 200 140" className={className} aria-hidden>
			<rect x="30" y="20" width="110" height="70" rx="14" fill="var(--accent)" opacity="0.18" />
			<rect x="70" y="50" width="100" height="62" rx="14" fill="var(--accent)" opacity="0.35" />
			<circle cx="98" cy="81" r="5" fill="var(--accent)" />
			<circle cx="120" cy="81" r="5" fill="var(--accent)" />
			<circle cx="142" cy="81" r="5" fill="var(--accent)" />
		</svg>
	);
}
