"use client";

import { X } from "lucide-react";
import { useMethod } from "@/lib/swr";
import { chatPhone, formatPhone } from "@/lib/utils";
import { Avatar } from "./avatar";
import { isGroup } from "./format";

interface ContactInfo {
	name: string;
	about: string;
}
interface GroupData {
	subject: string;
	description: string;
	size: number;
	participants: { id: string; isAdmin: boolean; isSuperAdmin: boolean }[];
}

export function ContactInfoPanel({
	instanceId,
	chatId,
	title,
	selfId,
	nameFor,
	onClose,
	onOpenChat,
}: {
	instanceId: string;
	chatId: string;
	title: string;
	selfId: string;
	nameFor: (id: string) => string;
	onClose: () => void;
	onOpenChat: (chatId: string) => void;
}) {
	const group = isGroup(chatId);
	const groupQuery = useMethod<GroupData>(group ? instanceId : null, "getGroupData", { groupId: chatId });
	const contactQuery = useMethod<ContactInfo>(group ? null : instanceId, "getContactInfo", { chatId });
	const groupData = groupQuery.data ?? null;
	const contact = contactQuery.data ?? null;
	const error = ((group ? groupQuery.error : contactQuery.error) as Error | undefined)?.message ?? null;

	return (
		<aside data-private className="flex h-full min-h-0 flex-col border-l border-wa-line bg-wa-list">
			<header className="flex h-[59px] shrink-0 items-center gap-6 bg-wa-panel px-5 text-wa-text">
				<button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-wa-icon">
					<X className="size-5" />
				</button>
				<span className="text-[16px]">{group ? "Group info" : "Contact info"}</span>
			</header>
			<div className="wa-scroll min-h-0 flex-1 overflow-y-auto bg-wa-panel">
				<section className="flex flex-col items-center bg-wa-list px-6 pb-6 pt-7 text-center">
					<Avatar instanceId={instanceId} chatId={chatId} size={200} />
					<h2 className="mt-4 text-2xl text-wa-text">{group ? groupData?.subject || title : contact?.name || title}</h2>
					<p className="mt-1 text-[15px] text-wa-muted">{group ? (groupData ? `Group · ${groupData.size} members` : "") : formatPhone(chatPhone(chatId))}</p>
				</section>
				{error && <p className="mt-2 bg-wa-list px-7 py-4 text-sm text-danger">{error}</p>}
				{!group && (
					<section className="mt-2 bg-wa-list px-7 py-4">
						<div className="text-sm text-wa-muted">About</div>
						<div className="mt-1 text-[15px] text-wa-text">{contact ? contact.about || "—" : "…"}</div>
					</section>
				)}
				{group && groupData && (
					<>
						{groupData.description && (
							<section className="mt-2 bg-wa-list px-7 py-4">
								<div className="text-sm text-wa-muted">Description</div>
								<div className="mt-1 whitespace-pre-wrap text-[15px] text-wa-text">{groupData.description}</div>
							</section>
						)}
						<section className="mt-2 bg-wa-list py-3">
							<div className="px-7 pb-2 text-sm text-wa-muted">{groupData.size} members</div>
							<ul>
								{groupData.participants.map((p) => (
									<li key={p.id}>
										<button
											type="button"
											disabled={p.id === selfId}
											onClick={() => onOpenChat(p.id)}
											className="flex w-full items-center gap-3 px-7 py-2.5 text-left hover:bg-wa-hover disabled:cursor-default disabled:hover:bg-transparent"
										>
											<Avatar instanceId={instanceId} chatId={p.id} size={40} />
											<span className="min-w-0 flex-1 truncate text-[15px] text-wa-text">{p.id === selfId ? "You" : nameFor(p.id)}</span>
											{p.isAdmin && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent-strong">Group admin</span>}
										</button>
									</li>
								))}
							</ul>
						</section>
					</>
				)}
			</div>
		</aside>
	);
}
