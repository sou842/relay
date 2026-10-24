"use client";

import { Moon, Sun } from "lucide-react";
import { setThemePref } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** Flips light/dark, remembers the choice, and updates every themed surface immediately. */
export function toggleTheme() {
	setThemePref(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

export function ThemeToggle({ className }: { className?: string }) {
	// Both icons are always rendered; CSS shows the right one, so there is no
	// hydration mismatch and no flicker when the stored theme differs from the default.
	return (
		<button
			type="button"
			onClick={toggleTheme}
			aria-label="Toggle light and dark theme"
			title="Toggle theme"
			className={cn("grid size-9 place-items-center rounded-full text-muted cursor-pointer transition hover:bg-panel-2 hover:text-fg", className)}
		>
			<Moon className="size-4.5 dark:hidden" />
			<Sun className="hidden size-4.5 dark:block" />
		</button>
	);
}
