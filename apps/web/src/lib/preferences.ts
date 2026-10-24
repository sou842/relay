"use client";

import { useSyncExternalStore } from "react";

// Per-browser preferences kept in localStorage and shared across components
// through a tiny external store, so a change in Settings applies everywhere at once.

export type ThemePref = "light" | "dark" | "system";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
	listeners.add(cb);
	window.addEventListener("storage", cb);
	return () => {
		listeners.delete(cb);
		window.removeEventListener("storage", cb);
	};
}

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string | null) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Private mode: the choice just won't persist.
	}
	notify();
}

// ---- theme ----

export function getThemePref(): ThemePref {
	const t = read("theme");
	return t === "light" || t === "dark" ? t : "system";
}

export function setThemePref(pref: ThemePref) {
	const resolved = pref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
	document.documentElement.dataset.theme = resolved;
	write("theme", pref === "system" ? null : pref);
}

export function useThemePref(): ThemePref {
	return useSyncExternalStore(subscribe, getThemePref, () => "system");
}

// ---- boolean switches ----

export const prefDefaults = { enterToSend: true } as const;
export type BoolPref = keyof typeof prefDefaults;

export function getBoolPref(name: BoolPref): boolean {
	const v = read(`pref:${name}`);
	return v === null ? prefDefaults[name] : v === "1";
}

export function setBoolPref(name: BoolPref, value: boolean) {
	write(`pref:${name}`, value ? "1" : "0");
}

export function useBoolPref(name: BoolPref): boolean {
	return useSyncExternalStore(subscribe, () => getBoolPref(name), () => prefDefaults[name]);
}
