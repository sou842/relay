import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

export const config = {
	// Bind to localhost by default; expose deliberately (e.g. Cloudflare Tunnel) when needed.
	host: process.env.GATEWAY_HOST ?? "127.0.0.1",
	port: Number(process.env.GATEWAY_PORT ?? 7700),
	// MongoDB holds all gateway state. A database of its own keeps it apart from the web app's.
	mongoUri: process.env.GATEWAY_MONGODB_URI ?? process.env.MONGODB_URI ?? "",
	mongoDb: process.env.GATEWAY_MONGODB_DB ?? "relay_gateway",
	// Only read by the one-time SQLite import (npm run migrate:sqlite).
	dataDir: path.resolve(process.env.GATEWAY_DATA_DIR ?? path.join(root, "data")),
	logLevel: process.env.GATEWAY_LOG_LEVEL ?? "info",
	// Base URL put into notification downloadUrl fields; set it to the tunnel URL when exposed.
	publicUrl: (process.env.GATEWAY_PUBLIC_URL ?? "").replace(/\/$/, ""),
	// Bearer key for /admin/* (used by the web app). Admin API is disabled when unset.
	adminKey: process.env.GATEWAY_ADMIN_KEY ?? "",
	// GREEN-API keeps undelivered notifications for 24 hours.
	notificationTtlMs: 24 * 60 * 60 * 1000,
};
