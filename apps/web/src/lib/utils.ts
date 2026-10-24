import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** "919903149299" -> "+91 99031 49299" (best effort; falls back to "+digits"). */
export function formatPhone(digits: string): string {
	if (!/^\d+$/.test(digits)) return digits;
	if (digits.startsWith("91") && digits.length === 12) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
	if (digits.startsWith("1") && digits.length === 11) return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
	if (digits.startsWith("44") && digits.length === 12) return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
	return `+${digits}`;
}

export function chatPhone(chatId: string): string {
	return chatId.split("@")[0];
}
