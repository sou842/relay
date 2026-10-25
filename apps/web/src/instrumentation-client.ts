import ErrorTracker from "@sourav732/error-tracker-js";

// Browser error and performance tracking. Next.js runs this file before React
// starts, so errors during hydration are caught too. It does nothing unless
// NEXT_PUBLIC_ERROR_TRACKER_KEY is set (leave it out of .env.local to keep
// development noise out of the dashboard).
//
// This app shows private chats, so the SDK is configured to send as little page
// content as possible: no screenshots, no text of clicked elements inside chat
// panes (data-private), query strings stripped by the SDK, no form values.

const apiKey = process.env.NEXT_PUBLIC_ERROR_TRACKER_KEY;

if (apiKey) {
	ErrorTracker.init({
		apiKey,
		endpoint: process.env.NEXT_PUBLIC_ERROR_TRACKER_ENDPOINT ?? "https://monitoringsystem-backend.vercel.app/api/v1/events",
		environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
		captureScreenshots: false,
		maskSelectors: ["[data-private]"],
		// The app's own 400/404 answers ("limit reached", "no such instance") are normal; only server failures are bugs.
		httpErrorStatuses: [[500, 599]],
	});
}
