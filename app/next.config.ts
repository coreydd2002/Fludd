import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Supabase is contacted directly from the browser (auth, queries, photo
 * uploads) and serves the signed photo URLs the report page renders, so its
 * origin has to be allowed in both connect-src and img-src.
 */
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

const connectSrc = ["'self'", supabaseOrigin, supabaseOrigin?.replace(/^https/, "wss")]
  .filter(Boolean)
  .join(" ");

const imgSrc = ["'self'", "blob:", "data:", supabaseOrigin].filter(Boolean).join(" ");

/**
 * This is deliberately NOT the landing page's CSP (see ../vercel.json).
 * That one is `script-src 'self'`, which a Next.js app cannot satisfy: the
 * framework inlines its bootstrap and flight payload into the document.
 *
 * 'unsafe-inline' is the tradeoff taken here so pages can stay statically
 * rendered. The stricter option is per-request nonces from src/proxy.ts, which
 * forces every page to render dynamically — worth revisiting if the app ever
 * handles more than pool service records.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // next/font self-hosts Plus Jakarta Sans at build time, so unlike the landing
  // page there is no fonts.gstatic.com exception to make here.
  "font-src 'self'",
  `img-src ${imgSrc}`,
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            // camera=(self) because the visit screen lets a tech shoot photos
            // at the pool. Geolocation stays off: directions are plain map
            // links, so the app never needs the device's position.
            value: "geolocation=(), microphone=(), camera=(self)",
          },
        ],
      },
      {
        // A report link in an email is a bearer token in a URL. Keep it out of
        // the Referer header sent to anything the page links onward to.
        source: "/r/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
