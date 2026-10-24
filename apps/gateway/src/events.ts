import { EventEmitter } from "node:events";

// Live feed for UIs (served as SSE). Unlike the notification queue, nothing is
// stored or acknowledged: listeners that are not connected simply miss events
// and catch up through the journal methods.

export type LiveEvent =
	| { type: "state"; stateInstance: string }
	| { type: "message"; message: Record<string, unknown> }
	| { type: "message.status"; chatId: string; idMessage: string; status: string }
	| { type: "message.update"; chatId: string; idMessage: string; patch: Record<string, unknown> }
	| { type: "reaction"; chatId: string; idMessage: string; senderId: string; reaction: string }
	| { type: "presence"; chatId: string; participant: string; presence: string; lastSeen?: number }
	| { type: "chat.read"; chatId: string };

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(instanceId: number, event: LiveEvent): void {
	bus.emit(String(instanceId), event);
}

export function subscribe(instanceId: number, listener: (event: LiveEvent) => void): () => void {
	bus.on(String(instanceId), listener);
	return () => bus.off(String(instanceId), listener);
}
