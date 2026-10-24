import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstanceDetail } from "@/components/dashboard/instance-detail";
import { requireSession } from "@/lib/auth";
import { getOwnedInstance, toSummary } from "@/lib/instances";

export const metadata: Metadata = { title: "Instance" };

export default async function InstancePage({ params }: PageProps<"/app/i/[id]">) {
	const { user } = await requireSession();
	const doc = await getOwnedInstance(user.id, (await params).id);
	if (!doc) notFound();
	return <InstanceDetail instance={toSummary(doc)} />;
}
