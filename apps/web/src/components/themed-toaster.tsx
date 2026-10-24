"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

function subscribe(onChange: () => void) {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
	return () => observer.disconnect();
}

const read = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Sonner follows the in-app theme toggle, not just the OS preference. */
export function ThemedToaster() {
	const theme = useSyncExternalStore(subscribe, read, () => "light" as const);
	return <Toaster theme={theme} position="bottom-center" richColors closeButton />;
}
