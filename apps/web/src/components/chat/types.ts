// Shapes returned by the gateway journal (getChats / getChatHistory / live events).

export interface Chat {
	id: string;
	name: string;
	unreadCount: number;
	lastMessageTime?: number;
	lastMessageType?: string;
	lastMessageDirection?: "incoming" | "outgoing";
	lastMessageStatus?: string;
	lastMessageDeleted?: boolean;
	lastMessageText?: string;
}

export interface QuotedMessage {
	stanzaId: string;
	participant?: string;
	typeMessage?: string;
	textMessage?: string;
	textMessageData?: { textMessage?: string };
	extendedTextMessageData?: { text?: string };
	fileMessageData?: { caption?: string };
	caption?: string;
}

export interface Message {
	type: "incoming" | "outgoing";
	idMessage: string;
	timestamp: number;
	chatId: string;
	senderId?: string;
	senderName?: string;
	statusMessage?: string;
	typeMessage: string;
	textMessage?: string;
	caption?: string;
	downloadUrl?: string;
	fileName?: string;
	mimeType?: string;
	jpegThumbnail?: string;
	isForwarded?: boolean;
	deleted?: boolean;
	edited?: boolean;
	quotedMessage?: QuotedMessage;
	reactions?: { senderId: string; reaction: string }[];
	locationMessageData?: { latitude: number; longitude: number; nameLocation?: string; address?: string };
	contactMessageData?: { displayName: string; vcard: string };
	messageData?: { contacts?: { displayName: string; vcard: string }[] };
	pollMessageData?: { name: string; options: { optionName: string }[]; multipleAnswers?: boolean };
	/** Client-only: optimistic copy waiting for the journal entry. */
	local?: boolean;
}

export interface Presence {
	presence: string;
	participant: string;
	lastSeen?: number;
	at: number;
}
