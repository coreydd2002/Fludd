import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font at build time, so the CSP needs no font-src exception
// (unlike the landing page, which pulls this face from fonts.googleapis.com).
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Fludd",
    template: "%s · Fludd",
  },
  description:
    "Run your pool route and send every customer a real service report.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  // iOS ignores the manifest's display mode and reads these instead; without
  // them "Add to Home Screen" produces a Safari bookmark rather than an app.
  appleWebApp: {
    capable: true,
    title: "Fludd",
    statusBarStyle: "default",
  },
  // The app is a private tool and the report pages are unguessable-token URLs.
  robots: { index: false, follow: false },
  other: {
    // Next emits the standardized `mobile-web-app-capable`; iOS versions before
    // 16.4 only honour this older spelling, and a working tech's phone is not
    // necessarily new. Harmless to send both.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b6bcb",
  width: "device-width",
  initialScale: 1,
  // Lets a tech zoom into a photo or a reading; never trap accessibility zoom.
  maximumScale: 5,
  // Draws under the notch and home indicator once installed. The app chrome
  // uses the pad-safe utilities to stay clear of both.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
