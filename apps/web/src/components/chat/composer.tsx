"use client";

import { BarChart3, Check, FileText, ImageIcon, MapPin, Mic, Paperclip, Pencil, Send, Smile, Trash2, UserRound, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getBoolPref } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { messagePreview } from "./format";
import type { Message } from "./types";

const drafts = new Map<string, string>();

type AttachKind = "doc" | "media" | "contact" | "poll" | "location";
const ATTACH_ITEMS: { kind: AttachKind; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }[] = [
	{ kind: "doc", icon: FileText, color: "#7f66ff", label: "Document" },
	{ kind: "media", icon: ImageIcon, color: "#007bfc", label: "Photos & videos" },
	{ kind: "contact", icon: UserRound, color: "#009de2", label: "Contact" },
	{ kind: "poll", icon: BarChart3, color: "#ffbc38", label: "Poll" },
	{ kind: "location", icon: MapPin, color: "#02a698", label: "Location" },
];

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false, loading: () => <div className="h-[350px]" /> });

export interface ComposerActions {
	sendText: (text: string, quoted?: Message) => Promise<void>;
	sendFile: (file: File, caption: string, opts?: { voiceNote?: boolean; quoted?: Message }) => Promise<void>;
	editText: (m: Message, text: string) => Promise<void>;
	openPoll: () => void;
	openLocation: () => void;
	openContact: () => void;
	typing: (kind: "composing" | "recording") => void;
}

export function Composer({
	chatKey,
	replyTo,
	editing,
	replyLabel,
	onCancelReply,
	onCancelEdit,
	actions,
	droppedFile,
	onDroppedFileHandled,
}: {
	chatKey: string;
	replyTo: Message | null;
	editing: Message | null;
	replyLabel: string;
	onCancelReply: () => void;
	onCancelEdit: () => void;
	actions: ComposerActions;
	droppedFile: File | null;
	onDroppedFileHandled: () => void;
}) {
	// The parent remounts the composer per chat (key={chatId}); drafts survive in a module-level map.
	const [text, setTextState] = useState(() => drafts.get(chatKey) ?? "");
	const [emojiOpen, setEmojiOpen] = useState(false);
	const [attachOpen, setAttachOpen] = useState(false);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [prevEditing, setPrevEditing] = useState<Message | null>(null);
	const [prevDropped, setPrevDropped] = useState<File | null>(null);
	const textRef = useRef<HTMLTextAreaElement>(null);
	const docInput = useRef<HTMLInputElement>(null);
	const mediaInput = useRef<HTMLInputElement>(null);
	const lastTyping = useRef(0);

	const setText = (value: string) => {
		setTextState(value);
		if (value) drafts.set(chatKey, value);
		else drafts.delete(chatKey);
	};

	// Adjust state while rendering when props change (React's recommended alternative to effects).
	if (editing !== prevEditing) {
		setPrevEditing(editing);
		if (editing) setText(editing.textMessage ?? "");
	}
	if (droppedFile && droppedFile !== prevDropped) {
		setPrevDropped(droppedFile);
		setPendingFile(droppedFile);
	}

	useEffect(() => {
		if (droppedFile) onDroppedFileHandled();
	}, [droppedFile, onDroppedFileHandled]);

	useEffect(() => {
		textRef.current?.focus();
	}, [replyTo, editing]);

	useEffect(() => {
		const el = textRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	}, [text]);

	async function submit() {
		const value = text.trim();
		if (!value) return;
		try {
			if (editing) {
				await actions.editText(editing, value);
				onCancelEdit();
			} else {
				await actions.sendText(value, replyTo ?? undefined);
				onCancelReply();
			}
			setText("");
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	function onType(value: string) {
		setText(value);
		const now = Date.now();
		if (value && now - lastTyping.current > 4000) {
			lastTyping.current = now;
			actions.typing("composing");
		}
	}

	function onAttach(kind: AttachKind) {
		setAttachOpen(false);
		if (kind === "doc") docInput.current?.click();
		else if (kind === "media") mediaInput.current?.click();
		else if (kind === "contact") actions.openContact();
		else if (kind === "poll") actions.openPoll();
		else actions.openLocation();
	}

	return (
		<div className="relative shrink-0 bg-wa-panel">
			{pendingFile && (
				<FilePreview
					file={pendingFile}
					onCancel={() => setPendingFile(null)}
					onSend={async (caption) => {
						const file = pendingFile;
						setPendingFile(null);
						try {
							await actions.sendFile(file, caption, { quoted: replyTo ?? undefined });
							onCancelReply();
						} catch (err) {
							toast.error((err as Error).message);
						}
					}}
				/>
			)}

			{(replyTo || editing) && (
				<div className="flex items-center gap-3 px-4 pt-2">
					<div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border-l-4 border-accent bg-wa-quote px-3 py-2">
						<div className="min-w-0">
							<div className="flex items-center gap-1.5 text-[13px] font-medium text-accent-strong">
								{editing ? (
									<>
										<Pencil className="size-3.5" /> Edit message
									</>
								) : (
									replyLabel
								)}
							</div>
							<div className="truncate text-[13px] text-wa-muted">{messagePreview((editing ?? replyTo)!)}</div>
						</div>
					</div>
					<button type="button" aria-label="Cancel" onClick={editing ? onCancelEdit : onCancelReply} className="cursor-pointer text-wa-icon">
						<X className="size-5" />
					</button>
				</div>
			)}

			{emojiOpen && (
				<div className="border-b border-wa-line">
					<EmojiPicker
						width="100%"
						height={350}
						lazyLoadEmojis
						previewConfig={{ showPreview: false }}
						onEmojiClick={(e) => {
							const el = textRef.current;
							const start = el?.selectionStart ?? text.length;
							const end = el?.selectionEnd ?? text.length;
							const next = text.slice(0, start) + e.emoji + text.slice(end);
							setText(next);
							requestAnimationFrame(() => {
								el?.focus();
								el?.setSelectionRange(start + e.emoji.length, start + e.emoji.length);
							});
						}}
					/>
				</div>
			)}

			<VoiceOrText
				hasText={Boolean(text.trim())}
				editing={Boolean(editing)}
				onSendText={submit}
				onRecorded={async (file) => {
					try {
						await actions.sendFile(file, "", { voiceNote: true, quoted: replyTo ?? undefined });
						onCancelReply();
					} catch (err) {
						toast.error((err as Error).message);
					}
				}}
				onRecordingTick={() => actions.typing("recording")}
			>
				<button
					type="button"
					aria-label="Emoji"
					onClick={() => {
						setEmojiOpen(!emojiOpen);
						setAttachOpen(false);
					}}
					className={cn("cursor-pointer grid size-10 shrink-0 place-items-center rounded-full text-wa-icon hover:bg-black/5 dark:hover:bg-white/10", emojiOpen && "text-accent-strong")}
				>
					{emojiOpen ? <X className="size-6" /> : <Smile className="size-6" />}
				</button>
				{!editing && (
					<div className="relative">
						<button
							type="button"
							aria-label="Attach"
							onClick={() => {
								setAttachOpen(!attachOpen);
								setEmojiOpen(false);
							}}
							className={cn("cursor-pointer grid size-10 shrink-0 place-items-center rounded-full text-wa-icon hover:bg-black/5 dark:hover:bg-white/10", attachOpen && "bg-black/10 dark:bg-white/10")}
						>
							<Paperclip className="size-[22px] -rotate-45" />
						</button>
						{attachOpen && (
							<>
								<button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setAttachOpen(false)} />
								<div className="absolute bottom-12 left-0 z-40 w-52 rounded-2xl bg-wa-list py-2 text-[14.5px] text-wa-text shadow-xl ring-1 ring-black/5">
									{ATTACH_ITEMS.map(({ kind, icon: Icon, color, label }) => (
										<button key={kind} type="button" onClick={() => onAttach(kind)} className="cursor-pointer flex w-full items-center gap-3 px-4 py-2.5 hover:bg-wa-hover">
											<Icon className="size-5" style={{ color }} />
											{label}
										</button>
									))}
								</div>
							</>
						)}
					</div>
				)}
				<div className="flex min-h-[42px] min-w-0 flex-1 items-center rounded-lg bg-wa-input px-3">
					<textarea
						ref={textRef}
						rows={1}
						value={text}
						onChange={(e) => onType(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && (getBoolPref("enterToSend") ? !e.shiftKey : e.ctrlKey || e.metaKey)) {
								e.preventDefault();
								void submit();
							}
							if (e.key === "Escape") {
								if (editing) onCancelEdit();
								else if (replyTo) onCancelReply();
							}
						}}
						onPaste={(e) => {
							const file = [...e.clipboardData.files][0];
							if (file) {
								e.preventDefault();
								setPendingFile(file);
							}
						}}
						placeholder="Type a message"
						className="wa-scroll max-h-[140px] w-full resize-none bg-transparent py-2.5 text-[15px] leading-5 text-wa-text outline-none placeholder:text-wa-muted"
					/>
				</div>
			</VoiceOrText>

			<input ref={docInput} type="file" hidden onChange={(e) => (e.target.files?.[0] && setPendingFile(e.target.files[0]), (e.target.value = ""))} />
			<input ref={mediaInput} type="file" hidden accept="image/*,video/*" onChange={(e) => (e.target.files?.[0] && setPendingFile(e.target.files[0]), (e.target.value = ""))} />
		</div>
	);
}

/** Right-hand button: send when there is text, otherwise a press-to-record mic. */
function VoiceOrText({
	hasText,
	editing,
	onSendText,
	onRecorded,
	onRecordingTick,
	children,
}: {
	hasText: boolean;
	editing: boolean;
	onSendText: () => void;
	onRecorded: (file: File) => void;
	onRecordingTick: () => void;
	children: React.ReactNode;
}) {
	const [recording, setRecording] = useState<{ started: number } | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const recorder = useRef<MediaRecorder | null>(null);
	const chunks = useRef<Blob[]>([]);
	const discard = useRef(false);

	useEffect(() => {
		if (!recording) return;
		const timer = setInterval(() => {
			setElapsed(Math.floor((Date.now() - recording.started) / 1000));
			onRecordingTick();
		}, 1000);
		return () => clearInterval(timer);
	}, [recording, onRecordingTick]);

	async function start() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			// WhatsApp voice notes are Ogg/Opus. Firefox records that natively; other
			// browsers fall back to WebM, which is sent as a regular audio file.
			const type = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
			const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
			chunks.current = [];
			discard.current = false;
			rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
			rec.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				if (discard.current || !chunks.current.length) return;
				const mime = rec.mimeType || "audio/webm";
				const ext = mime.includes("ogg") ? "ogg" : "webm";
				onRecorded(new File(chunks.current, `voice-${Date.now()}.${ext}`, { type: mime.split(";")[0] }));
			};
			rec.start();
			recorder.current = rec;
			setElapsed(0);
			setRecording({ started: Date.now() });
		} catch {
			toast.error("Microphone access was blocked");
		}
	}

	function stop(send: boolean) {
		discard.current = !send;
		recorder.current?.stop();
		recorder.current = null;
		setRecording(null);
	}

	if (recording) {
		const mm = String(Math.floor(elapsed / 60));
		const ss = String(elapsed % 60).padStart(2, "0");
		return (
			<div className="flex items-center justify-end gap-4 px-4 py-[9px]">
				<button type="button" aria-label="Discard recording" onClick={() => stop(false)} className="cursor-pointer text-wa-icon hover:text-danger">
					<Trash2 className="size-5" />
				</button>
				<span className="flex items-center gap-2 text-[15px] text-wa-text">
					<span className="size-2.5 animate-pulse rounded-full bg-red-500" />
					{mm}:{ss}
				</span>
				<button type="button" aria-label="Send voice message" onClick={() => stop(true)} className="cursor-pointer grid size-11 place-items-center rounded-full bg-accent text-white">
					<Send className="size-5" />
				</button>
			</div>
		);
	}

	return (
		<div className="flex items-end gap-1 px-3 py-[9px]">
			{children}
			{hasText || editing ? (
				<button type="button" aria-label={editing ? "Save" : "Send"} onClick={onSendText} className="cursor-pointer grid size-10 shrink-0 place-items-center rounded-full text-wa-icon hover:bg-black/5 dark:hover:bg-white/10">
					{editing ? <Check className="size-6 text-accent-strong" /> : <Send className="size-6" />}
				</button>
			) : (
				<button type="button" aria-label="Record voice message" onClick={start} className="cursor-pointer grid size-10 shrink-0 place-items-center rounded-full text-wa-icon hover:bg-black/5 dark:hover:bg-white/10">
					<Mic className="size-6" />
				</button>
			)}
		</div>
	);
}

function FilePreview({ file, onCancel, onSend }: { file: File; onCancel: () => void; onSend: (caption: string) => void }) {
	const [caption, setCaption] = useState("");
	const isImage = file.type.startsWith("image/");
	const isVideo = file.type.startsWith("video/");
	const url = useMemo(() => (isImage || isVideo ? URL.createObjectURL(file) : null), [file, isImage, isVideo]);

	useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

	return (
		<div className="absolute inset-x-0 bottom-0 z-20 flex h-[min(560px,80vh)] flex-col bg-wa-panel shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
			<div className="flex h-14 items-center gap-4 px-4">
				<button type="button" aria-label="Cancel" onClick={onCancel} className="cursor-pointer text-wa-icon">
					<X className="size-6" />
				</button>
				<span className="truncate text-sm text-wa-text">{file.name}</span>
			</div>
			<div className="grid min-h-0 flex-1 place-items-center p-6">
				{isImage && url ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
				) : isVideo && url ? (
					<video src={url} controls className="max-h-full max-w-full rounded-lg" />
				) : (
					<div className="flex flex-col items-center gap-3 text-wa-muted">
						<FileText className="size-20" strokeWidth={1} />
						<span className="text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "file"}</span>
					</div>
				)}
			</div>
			<div className="flex items-center gap-3 px-6 pb-6">
				<input
					autoFocus
					value={caption}
					onChange={(e) => setCaption(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && onSend(caption)}
					placeholder="Add a caption"
					className="h-11 flex-1 rounded-lg bg-wa-input px-4 text-[15px] text-wa-text outline-none placeholder:text-wa-muted"
				/>
				<button type="button" aria-label="Send" onClick={() => onSend(caption)} className="cursor-pointer grid size-12 place-items-center rounded-full bg-accent text-white shadow-lg">
					<Send className="size-5" />
				</button>
			</div>
		</div>
	);
}
