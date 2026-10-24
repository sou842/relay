import Fastify from "fastify";
import { registerRoutes } from "./api/router.ts";
import { config } from "./config.ts";
import { InstanceManager } from "./manager.ts";
import { purgeExpiredNotifications } from "./store/notifications.ts";

const app = Fastify({ logger: { level: config.logLevel } });
const manager = new InstanceManager(app.log);

await registerRoutes(app, manager);

const purgeTimer = setInterval(purgeExpiredNotifications, 10 * 60 * 1000);

async function shutdown() {
	clearInterval(purgeTimer);
	await manager.stopAll();
	await app.close();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.host, port: config.port });
purgeExpiredNotifications();
await manager.startAll();
