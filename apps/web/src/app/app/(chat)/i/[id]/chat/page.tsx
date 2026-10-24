import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatApp } from "@/components/chat/chat-app";
import { requireSession } from "@/lib/auth";
import { getOwnedInstance, toSummary } from "@/lib/instances";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatPage({ params }: PageProps<"/app/i/[id]/chat">) {
	const { user } = await requireSession();
	const doc = await getOwnedInstance(user.id, (await params).id);
	if (!doc) notFound();
	return <ChatApp instance={toSummary(doc)} />;
}
