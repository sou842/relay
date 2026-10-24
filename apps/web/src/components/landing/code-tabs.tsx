"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface CodeTab {
	id: string;
	label: string;
	code: string;
}

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
	const [active, setActive] = useState(tabs[0].id);
	const current = tabs.find((t) => t.id === active) ?? tabs[0];
	return (
		<div className="lp-frame-shadow overflow-hidden rounded-2xl bg-[var(--code-bg)]">
			<div role="tablist" className="flex gap-1 border-b border-white/10 px-3 pt-3">
				{tabs.map((t) => (
					<button
						key={t.id}
						role="tab"
						type="button"
						aria-selected={t.id === active}
						onClick={() => setActive(t.id)}
						className={cn("rounded-t-lg px-3.5 py-2 text-xs font-medium transition", t.id === active ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80")}
					>
						{t.label}
					</button>
				))}
			</div>
			<pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-[var(--code-fg)]">
				<code>{current.code}</code>
			</pre>
		</div>
	);
}
