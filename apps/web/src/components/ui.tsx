import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Small set of shared primitives for the product UI (dashboard, auth, docs).

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
	primary: "bg-accent text-accent-fg hover:brightness-110",
	secondary: "border border-line bg-panel hover:bg-panel-2",
	ghost: "hover:bg-panel-2",
	danger: "bg-danger text-white hover:opacity-90",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
	return cn(
		"inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none",
		buttonStyles[variant],
		className,
	);
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(
	function Button({ variant = "primary", className, ...props }, ref) {
		return <button ref={ref} className={buttonClass(variant, className)} {...props} />;
	},
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
	return (
		<input
			ref={ref}
			className={cn(
				"h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25",
				className,
			)}
			{...props}
		/>
	);
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
	return (
		<label className="grid gap-1.5 text-sm">
			<span className="font-medium">{label}</span>
			{children}
			{hint && <span className="text-xs text-muted">{hint}</span>}
		</label>
	);
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
	return <div className={cn("rounded-2xl border border-line bg-panel p-6 shadow-sm", className)}>{children}</div>;
}

const stateStyles: Record<string, string> = {
	authorized: "bg-accent/15 text-accent-strong",
	notAuthorized: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
	starting: "bg-panel-2 text-muted",
	blocked: "bg-danger/15 text-danger",
	yellowCard: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
	offline: "bg-danger/15 text-danger",
};

const stateLabels: Record<string, string> = {
	authorized: "Connected",
	notAuthorized: "Not linked",
	starting: "Starting",
	blocked: "Blocked",
	yellowCard: "Restricted",
	offline: "Gateway offline",
};

export function StatePill({ state }: { state: string }) {
	return (
		<span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", stateStyles[state] ?? stateStyles.starting)}>
			<span className="size-1.5 rounded-full bg-current" />
			{stateLabels[state] ?? state}
		</span>
	);
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-line")}
		>
			<span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
		</button>
	);
}
