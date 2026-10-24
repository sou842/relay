import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no cookie -> send to sign-in. Real verification
// happens in every page (requireSession) and route handler (requireApiSession).

export function proxy(request: NextRequest) {
	const hasSession = Boolean(getSessionCookie(request));
	const { pathname } = request.nextUrl;

	if (pathname.startsWith("/app") && !hasSession) {
		const url = new URL("/sign-in", request.url);
		url.searchParams.set("next", pathname);
		return NextResponse.redirect(url);
	}
	// Signed-in users visiting /sign-in are redirected by the page after a real
	// session check; doing it here on cookie presence alone could loop on a stale cookie.
	return NextResponse.next();
}

export const config = {
	matcher: ["/app/:path*"],
};
