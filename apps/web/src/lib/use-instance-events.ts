"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors the gateway's LiveEvent union (apps/gateway/src/events.ts).
export type LiveEvent =
	| { type: "state"; stateInstance: string }
	| { type: "message"; message: Record<string, unknown> }
	| { type: "message.status"; chatId: string; idMessage: string; status: string }
	| { type: "message.update"; chatId: string; idMessage: string; patch: Record<string, unknown> }
	| { type: "reaction"; chatId: string; idMessage: string; senderId: string; reaction: string }
	| { type: "presence"; chatId: string; participant: string; presence: string; lastSeen?: number }
	| { type: "chat.read"; chatId: string };

/**
 * Subscribes to the instance's live feed. EventSource reconnects on its own;
 * `connected` lets the UI show when the feed is down.
 */
export function useInstanceEvents(instanceId: string, onEvent: (event: LiveEvent) => void) {
	const handler = useRef(onEvent);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		handler.current = onEvent;
	});

	useEffect(() => {
		const source = new EventSource(`/api/instances/${instanceId}/events`);
		source.onopen = () => setConnected(true);
		source.onerror = () => setConnected(false);
		source.onmessage = (e) => {
			try {
				handler.current(JSON.parse(e.data));
			} catch {
				// Ignore malformed frames.
			}
		};
		return () => source.close();
	}, [instanceId]);

	return connected;
}
