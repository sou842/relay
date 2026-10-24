import { cn } from "@/lib/utils";

export function Badge({ icon: Icon, children, className }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
	return (
		<span className={cn("lp-pill-shadow inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-xs font-medium text-fg", className)}>
			{Icon && <Icon className="size-3.5 text-muted" />}
			{children}
		</span>
	);
}

export function SectionHeading({ eyebrow, icon, title, text, className }: { eyebrow: string; icon?: React.ComponentType<{ className?: string }>; title: React.ReactNode; text?: string; className?: string }) {
	return (
		<div className={cn("mx-auto flex max-w-2xl flex-col items-center px-4 text-center", className)}>
			<Badge icon={icon}>{eyebrow}</Badge>
			<h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{title}</h2>
			{text && <p className="mt-5 max-w-xl text-balance leading-relaxed text-muted sm:text-lg">{text}</p>}
		</div>
	);
}

/** Hairline-ruled band with hatched gutters on both sides (md and up). */
export function Rails({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-[48px_minmax(0,1fr)_48px]">
			<div aria-hidden className="lp-hatch hidden border-r border-line md:block" />
			<div className={cn("min-w-0", className)}>{children}</div>
			<div aria-hidden className="lp-hatch hidden border-l border-line md:block" />
		</div>
	);
}

export function Pre({ children, className }: { children: string; className?: string }) {
	return (
		<pre className={cn("overflow-x-auto rounded-xl bg-[var(--code-bg)] p-4 font-mono text-xs leading-relaxed text-[var(--code-fg)]", className)}>
			<code>{children}</code>
		</pre>
	);
}
