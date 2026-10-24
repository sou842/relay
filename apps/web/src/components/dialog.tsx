"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Native <dialog> wrapper: focus trapping, Esc and backdrop close come for free. */
export function Dialog({
	open,
	onClose,
	title,
	children,
	className,
}: {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
}) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (open && !el.open) el.showModal();
		if (!open && el.open) el.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			onClose={onClose}
			onClick={(e) => {
				if (e.target === ref.current) onClose();
			}}
			className={cn(
				"m-auto w-[min(440px,calc(100%-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/50",
				className,
			)}
		>
			{open && (
				<div className="p-6">
					{title && (
						<div className="mb-4 flex items-center justify-between gap-4">
							<h2 className="text-lg font-semibold">{title}</h2>
							<button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-muted hover:bg-panel-2">
								<X className="size-4" />
							</button>
						</div>
					)}
					{children}
				</div>
			)}
		</dialog>
	);
}
