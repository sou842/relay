"use client";

import { Check } from "lucide-react";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/preferences";
import { cn } from "@/lib/utils";

// Fixed colours on purpose: each tile previews its own theme regardless of the current one.
const palettes = {
	light: { bg: "#f7f5f3", bar: "#ffffff", line: "#e3dfda", text: "#d5d0ca", accent: "#464eb8" },
	dark: { bg: "#121110", bar: "#1b1917", line: "#2e2a27", text: "#4a4540", accent: "#464eb8" },
};

function Preview({ theme }: { theme: "light" | "dark" }) {
	const p = palettes[theme];
	return (
		<div className="flex h-full overflow-hidden rounded-lg" style={{ background: p.bg, border: `1px solid ${p.line}` }}>
			<div className="w-1/3 space-y-1.5 p-2" style={{ background: p.bar, borderRight: `1px solid ${p.line}` }}>
				<div className="h-1.5 w-3/4 rounded-full" style={{ background: p.accent }} />
				<div className="h-1.5 w-full rounded-full" style={{ background: p.text }} />
				<div className="h-1.5 w-2/3 rounded-full" style={{ background: p.text }} />
			</div>
			<div className="flex flex-1 flex-col justify-end gap-1.5 p-2">
				<div className="h-3 w-2/3 rounded-md" style={{ background: p.bar, border: `1px solid ${p.line}` }} />
				<div className="ml-auto h-3 w-1/2 rounded-md" style={{ background: p.accent }} />
			</div>
		</div>
	);
}

const options: { id: ThemePref; label: string; hint: string }[] = [
	{ id: "light", label: "Light", hint: "Bright and clean" },
	{ id: "dark", label: "Dark", hint: "Easy on the eyes" },
	{ id: "system", label: "System", hint: "Match this device" },
];

export function Appearance() {
	const theme = useThemePref();
	return (
		<div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{options.map(({ id, label, hint }) => {
				const selected = theme === id;
				return (
					<button
						key={id}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => setThemePref(id)}
						className={cn("cursor-pointer rounded-xl border p-2.5 text-left transition", selected ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-muted/50")}
					>
						<div className="relative h-20">
							{id === "system" ? (
								<>
									<div className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">
										<Preview theme="light" />
									</div>
									<div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
										<Preview theme="dark" />
									</div>
								</>
							) : (
								<Preview theme={id} />
							)}
						</div>
						<div className="mt-2.5 flex items-center justify-between px-0.5">
							<div>
								<div className="text-sm font-medium">{label}</div>
								<div className="text-xs text-muted">{hint}</div>
							</div>
							{selected && (
								<span className="grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
									<Check className="size-3" />
								</span>
							)}
						</div>
					</button>
				);
			})}
		</div>
	);
}
