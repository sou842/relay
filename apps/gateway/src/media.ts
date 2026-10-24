import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";

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

export function mediaDir(instanceId: number): string {
	const dir = path.join(config.dataDir, "instances", String(instanceId), "media");
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/** Media file names are server-generated (message id + extension); reject anything else. */
export function resolveMediaFile(instanceId: number, fileName: string): string | null {
	if (!/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(fileName)) return null;
	const file = path.join(mediaDir(instanceId), fileName);
	return fs.existsSync(file) ? file : null;
}

export function mediaUrl(baseUrl: string, instanceId: number, fileName: string): string {
	return `${baseUrl}/media/${instanceId}/${fileName}`;
}

/** Writes an upload into the instance's media folder under a random name. */
export function storeUpload(
	instanceId: number,
	baseUrl: string,
	file: { buffer: Buffer; mimetype: string },
	fileName: string,
): { urlFile: string; path: string; mimetype: string } {
	const mimetype = file.mimetype && file.mimetype !== "application/octet-stream" ? file.mimetype : mimeFromFileName(fileName);
	const ext = path.extname(fileName).slice(1).toLowerCase() || extensionFromMime(mimetype);
	const stored = `${crypto.randomUUID().replace(/-/g, "")}.${ext.replace(/[^a-z0-9]/g, "") || "bin"}`;
	const target = path.join(mediaDir(instanceId), stored);
	fs.writeFileSync(target, file.buffer);
	return { urlFile: mediaUrl(baseUrl, instanceId, stored), path: target, mimetype };
}
