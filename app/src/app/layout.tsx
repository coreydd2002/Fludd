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
  // The app is a private tool and the report pages are unguessable-token URLs.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b6bcb",
  width: "device-width",
  initialScale: 1,
  // Lets a tech zoom into a photo or a reading; never trap accessibility zoom.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
