import type { Metadata } from "next";
import { InstanceList } from "@/components/dashboard/instance-list";
import { requireSession } from "@/lib/auth";
import { listInstances, toSummary } from "@/lib/instances";

export const metadata: Metadata = { title: "Instances" };

export default async function InstancesPage() {
	const { user } = await requireSession();
	const instances = (await listInstances(user.id)).map(toSummary);
	return <InstanceList initial={instances} userName={user.name} />;
}
