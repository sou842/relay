"use client";

import { Switch } from "@/components/ui";
import { setBoolPref, useBoolPref } from "@/lib/preferences";

export function ChatPrefs() {
	const enterToSend = useBoolPref("enterToSend");
	return (
		<div className="flex items-center justify-between gap-6">
			<div>
				<div className="text-sm font-medium">Press Enter to send</div>
				<div className="text-sm text-muted">{enterToSend ? "Enter sends; Shift+Enter adds a new line." : "Ctrl/Cmd+Enter sends; Enter adds a new line."}</div>
			</div>
			<Switch label="Press Enter to send" checked={enterToSend} onChange={(v) => setBoolPref("enterToSend", v)} />
		</div>
	);
}
