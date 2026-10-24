import { z } from "zod";
import { handle, HttpError, requireApiSession } from "@/lib/api";
import { createInstance, listInstances, toSummary } from "@/lib/instances";
import { PROVIDERS } from "@/lib/providers";

const MAX_INSTANCES_PER_USER = 5;

export const GET = handle(async (request: Request) => {
	const session = await requireApiSession(request);
	const docs = await listInstances(session.user.id);
	return Response.json(docs.map(toSummary));
});

const createSchema = z.object({
	provider: z.enum(["whatsapp", "telegram"]).default("whatsapp"),
	name: z.string().trim().min(1, "Give the instance a name").max(60),
});

export const POST = handle(async (request: Request) => {
	const session = await requireApiSession(request);
	const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
	const { provider, name } = parsed.data;
	if (!PROVIDERS[provider].available) throw new HttpError(400, `${PROVIDERS[provider].label} is not available yet`);
	const existing = await listInstances(session.user.id);
	if (existing.length >= MAX_INSTANCES_PER_USER) throw new HttpError(400, `Limit is ${MAX_INSTANCES_PER_USER} instances per account`);
	const doc = await createInstance(session.user.id, provider, name);
	return Response.json(toSummary(doc), { status: 201 });
});
