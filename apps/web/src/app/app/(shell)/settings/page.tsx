import type { Metadata } from "next";
import { Appearance } from "@/components/settings/appearance";
import { ChatPrefs } from "@/components/settings/chat-prefs";
import { ProfileForm } from "@/components/settings/profile";
import { SecurityForm } from "@/components/settings/security";
import { SettingsSection } from "@/components/settings/section";
import { StatePill } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { gatewayPublicUrl, gatewayStatus } from "@/lib/gateway";
import { listInstances } from "@/lib/instances";
import { PROVIDERS } from "@/lib/providers";

export const metadata: Metadata = { title: "Settings" };

const nav = [
	{ id: "appearance", label: "Appearance" },
	{ id: "profile", label: "Profile" },
	{ id: "security", label: "Security" },
	{ id: "chat", label: "Chat" },
	{ id: "system", label: "System" },
];

const gatewayState = { online: "authorized", offline: "offline", "bad-key": "blocked" } as const;

export default async function SettingsPage() {
	const { user } = await requireSession();
	const [status, instances] = await Promise.all([gatewayStatus(), listInstances(user.id)]);

	return (
		<>
			<div className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<p className="mt-1 text-sm text-muted">Appearance, your account and how the app behaves in this browser.</p>
			</div>

			<div className="grid grid-cols-1 gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
				<nav aria-label="Settings sections" className="hidden md:block">
					<ul className="sticky top-6 grid gap-0.5 text-sm">
						{nav.map((n) => (
							<li key={n.id}>
								<a href={`#${n.id}`} className="block rounded-lg px-3 py-2 text-muted transition hover:bg-panel-2 hover:text-fg">
									{n.label}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="grid min-w-0 gap-6">
					<SettingsSection id="appearance" title="Appearance" text="Choose how Relay looks. Saved on this device.">
						<Appearance />
					</SettingsSection>

					<SettingsSection id="profile" title="Profile" text="How you appear in the app.">
						<ProfileForm name={user.name} email={user.email} />
					</SettingsSection>

					<SettingsSection id="security" title="Security" text="Password and signed-in devices.">
						<SecurityForm />
					</SettingsSection>

					<SettingsSection id="chat" title="Chat" text="Preferences for the inbox. Saved on this device.">
						<ChatPrefs />
					</SettingsSection>

					<SettingsSection id="system" title="System" text="What this app is connected to.">
						<dl className="grid gap-5 text-sm sm:grid-cols-2">
							<div>
								<dt className="text-muted">Gateway</dt>
								<dd className="mt-1.5">
									<StatePill state={gatewayState[status]} />
								</dd>
								{status === "offline" && <p className="mt-1.5 text-xs text-muted">Start it with npm run gateway.</p>}
								{status === "bad-key" && <p className="mt-1.5 text-xs text-muted">The admin key in .env.local doesn&apos;t match the gateway.</p>}
							</div>
							<div>
								<dt className="text-muted">Gateway address</dt>
								<dd className="mt-1.5 font-mono text-[13px]">{gatewayPublicUrl}</dd>
							</div>
							<div>
								<dt className="text-muted">Your instances</dt>
								<dd className="mt-1.5">{instances.length}</dd>
							</div>
							<div>
								<dt className="text-muted">Messengers</dt>
								<dd className="mt-1.5">{Object.values(PROVIDERS).map((p) => `${p.label}${p.available ? "" : " (soon)"}`).join(", ")}</dd>
							</div>
						</dl>
					</SettingsSection>
				</div>
			</div>
		</>
	);
}
