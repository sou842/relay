import { z } from "zod";
import { handle, HttpError, requireApiSession } from "@/lib/api";
import { importInstance, toSummary } from "@/lib/instances";

const schema = z.object({
	idInstance: z.coerce.number().int().positive(),
	apiTokenInstance: z.string().trim().min(10),
	name: z.string().trim().max(60).default(""),
});

export const POST = handle(async (request: Request) => {
	const session = await requireApiSession(request);
	const parsed = schema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) throw new HttpError(400, "Enter the idInstance and apiTokenInstance");
	const { idInstance, apiTokenInstance, name } = parsed.data;
	const doc = await importInstance(session.user.id, idInstance, apiTokenInstance, name);
	return Response.json(toSummary(doc), { status: 201 });
});
