// Messenger catalog shared by server and client code. The gateway decides
// what actually works; this only drives labels and which UI bits to show.

export type ProviderId = "whatsapp" | "telegram";

export interface ProviderInfo {
	id: ProviderId;
	label: string;
	/** Path prefix used by the gateway API, e.g. waInstance1101000001. */
	urlPrefix: string;
	available: boolean;
	linkMethods: ("qr" | "phoneCode")[];
	features: {
		polls: boolean;
		reactions: boolean;
		voiceNotes: boolean;
		edit: boolean;
		deleteForEveryone: boolean;
		presence: boolean;
	};
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
	whatsapp: {
		id: "whatsapp",
		label: "WhatsApp",
		urlPrefix: "waInstance",
		available: true,
		linkMethods: ["qr", "phoneCode"],
		features: { polls: true, reactions: true, voiceNotes: true, edit: true, deleteForEveryone: true, presence: true },
	},
	telegram: {
		id: "telegram",
		label: "Telegram",
		urlPrefix: "tgInstance",
		available: false,
		linkMethods: ["qr", "phoneCode"],
		features: { polls: true, reactions: true, voiceNotes: true, edit: true, deleteForEveryone: true, presence: true },
	},
};

export function providerInfo(id: string): ProviderInfo {
	return PROVIDERS[id as ProviderId] ?? PROVIDERS.whatsapp;
}
