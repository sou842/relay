import { handle, requireOwnedInstance } from "@/lib/api";
import { callInstance, gatewayPublicUrl } from "@/lib/gateway";
import { credentials, updateToken } from "@/lib/instances";
import { providerInfo } from "@/lib/providers";

type Ctx = { params: Promise<{ id: string }> };

/** API credentials for the owner's own scripts (shown on the instance page). */
export const GET = handle(async (request: Request, { params }: Ctx) => {
	const { instance } = await requireOwnedInstance(request, (await params).id);
	return Response.json({
		apiUrl: gatewayPublicUrl,
		urlPrefix: providerInfo(instance.provider).urlPrefix,
		idInstance: instance.gatewayId,
		apiTokenInstance: instance.token,
	});
});

/** Rotates the token on the gateway and stores the new one. */
export const POST = handle(async (request: Request, { params }: Ctx) => {
	const { instance } = await requireOwnedInstance(request, (await params).id);
	const { apiTokenInstance } = await callInstance<{ apiTokenInstance: string }>(credentials(instance), "updateApiToken");
	await updateToken(instance, apiTokenInstance);
	return Response.json({ apiTokenInstance });
});
