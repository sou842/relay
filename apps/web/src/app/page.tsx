import { ApiSection } from "@/components/landing/api-section";
import { CtaBand, Footer } from "@/components/landing/cta-footer";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNav } from "@/components/landing/nav";
import { RunYourWay } from "@/components/landing/run-your-way";
import { getSession } from "@/lib/auth";

export default async function Home() {
	const signedIn = Boolean(await getSession());
	return (
		<div className="lp relative min-h-screen bg-bg text-fg">
			<div className="mx-auto max-w-[1200px] border-x border-line">
			<LandingNav signedIn={signedIn} />
			<main>
				<Hero signedIn={signedIn} />
				<Features />
				<HowItWorks />
				<ApiSection />
				<RunYourWay />
				<Faq />
				<CtaBand signedIn={signedIn} />
			</main>
			<Footer />
			</div>
		</div>
	);
}
