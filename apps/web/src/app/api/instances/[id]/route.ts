import { z } from "zod";
import { handle, HttpError, requireOwnedInstance } from "@/lib/api";
import { callInstance } from "@/lib/gateway";
import { credentials, deleteInstance, renameInstance, toSummary } from "@/lib/instances";

type Ctx = { params: Promise<{ id: string }> };

/** Summary plus live account info from the gateway. */
export const GET = handle(async (request: Request, { params }: Ctx) => {
	const { instance } = await requireOwnedInstance(request, (await params).id);
	const cred = credentials(instance);
	const account = await callInstance<{ avatar: string; phone: string; stateInstance: string }>(cred, "getWaSettings").catch(() => ({
		avatar: "",
		phone: "",
		stateInstance: "offline",
	}));
	return Response.json({ ...toSummary(instance), ...account });
});

const patchSchema = z.object({ name: z.string().trim().min(1).max(60) });

export const PATCH = handle(async (request: Request, { params }: Ctx) => {
	const { instance } = await requireOwnedInstance(request, (await params).id);
	const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) throw new HttpError(400, "Name must be 1-60 characters");
	await renameInstance(instance, parsed.data.name);
	return Response.json({ ...toSummary(instance), name: parsed.data.name });
});

export const DELETE = handle(async (request: Request, { params }: Ctx) => {
	const { instance } = await requireOwnedInstance(request, (await params).id);
	await deleteInstance(instance);
	return Response.json({ deleted: true });
});
