/**
 * Canonical public URLs. `stoa-agents.vercel.app` is the stable Vercel
 * production alias — it always tracks the latest master deploy — so the
 * on-page code snippets a visitor copies point at a real, live endpoint.
 * Override with NEXT_PUBLIC_SITE_URL if a custom domain is added later.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stoa-agents.vercel.app"
export const FEED_URL = `${SITE_URL}/api/v1/feeds/macro-alpha`
export const GITHUB_URL = "https://github.com/Manuel-dev01/Stoa"
