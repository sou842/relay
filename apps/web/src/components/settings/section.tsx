export function SettingsSection({ id, title, text, children }: { id: string; title: string; text: string; children: React.ReactNode }) {
	return (
		<section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-panel">
			<div className="border-b border-line px-6 py-5">
				<h2 className="text-base font-semibold tracking-tight">{title}</h2>
				<p className="mt-0.5 text-sm text-muted">{text}</p>
			</div>
			<div className="px-6 py-5">{children}</div>
		</section>
	);
}
