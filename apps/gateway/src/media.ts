import crypto from "node:crypto";
import path from "node:path";
import type { Readable } from "node:stream";
import { mediaBucket } from "./db.ts";

const byExtension: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	mp4: "video/mp4",
	"3gp": "video/3gpp",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	ogg: "audio/ogg",
	oga: "audio/ogg",
	opus: "audio/ogg; codecs=opus",
	m4a: "audio/mp4",
	aac: "audio/aac",
	wav: "audio/wav",
	pdf: "application/pdf",
	txt: "text/plain",
	csv: "text/csv",
	zip: "application/zip",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function mimeFromFileName(fileName: string): string {
	const ext = path.extname(fileName).slice(1).toLowerCase();
	return byExtension[ext] ?? "application/octet-stream";
}

export function extensionFromMime(mime: string): string {
	const base = mime.split(";")[0].trim();
	const hit = Object.entries(byExtension).find(([, m]) => m.split(";")[0] === base);
	return hit ? hit[0] : "bin";
}

/** True for types a browser may render inline; everything else is served as a download. */
export function isInlineMime(mime: string): boolean {
	return /^(image\/(jpeg|png|gif|webp)|video\/|audio\/)/.test(mime);
}

function gridName(instanceId: number, fileName: string): string {
	return `${instanceId}/${fileName}`;
}

/** Media file names are server-generated (message id + extension); reject anything else. */
export function isMediaFileName(fileName: string): boolean {
	return /^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(fileName);
}

/** Stores a file in GridFS under the instance; replaces an older copy with the same name. */
export async function saveMediaFile(instanceId: number, fileName: string, buffer: Buffer): Promise<void> {
	const filename = gridName(instanceId, fileName);
	const old = await mediaBucket.find({ filename }, { projection: { _id: 1 } }).toArray();
	await new Promise<void>((resolve, reject) => {
		const upload = mediaBucket.openUploadStream(filename, { metadata: { instanceId, contentType: mimeFromFileName(fileName) } });
		upload.once("finish", () => resolve());
		upload.once("error", reject);
		upload.end(buffer);
	});
	for (const f of old) await mediaBucket.delete(f._id).catch(() => undefined);
}

/** Opens a stored media file, or null when it doesn't exist. */
export async function openMediaFile(instanceId: number, fileName: string): Promise<{ stream: Readable; length: number } | null> {
	if (!isMediaFileName(fileName)) return null;
	const file = await mediaBucket.find({ filename: gridName(instanceId, fileName) }).sort({ uploadDate: -1 }).limit(1).next();
	if (!file) return null;
	return { stream: mediaBucket.openDownloadStream(file._id), length: file.length };
}

export function mediaUrl(baseUrl: string, instanceId: number, fileName: string): string {
	return `${baseUrl}/media/${instanceId}/${fileName}`;
}

/** Stores an upload under a random name and returns its public URL. */
export async function storeUpload(
	instanceId: number,
	baseUrl: string,
	file: { buffer: Buffer; mimetype: string },
	fileName: string,
): Promise<{ urlFile: string; mimetype: string }> {
	const mimetype = file.mimetype && file.mimetype !== "application/octet-stream" ? file.mimetype : mimeFromFileName(fileName);
	// Only known extensions are kept, so nothing is ever stored as .html, .svg, .js, ...
	const given = path.extname(fileName).slice(1).toLowerCase();
	const ext = given in byExtension ? given : extensionFromMime(mimetype);
	const stored = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
	await saveMediaFile(instanceId, stored, file.buffer);
	return { urlFile: mediaUrl(baseUrl, instanceId, stored), mimetype };
}
