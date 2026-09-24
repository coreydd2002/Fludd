import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest. This is what makes the app installable to a
 * phone home screen, which is the whole delivery model — a tech uses this at
 * the side of a house, not at a desk, and there is no app store in the loop.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fludd — pool service",
    short_name: "Fludd",
    description:
      "Run your pool route and send every customer a real service report.",
    // Opens on Today's route; the proxy sends you to /login if signed out.
    start_url: "/",
    // No browser chrome once installed, so it reads as an app rather than a
    // bookmark. Address bar space matters on a checklist screen.
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6fbfe",
    theme_color: "#0b6bcb",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        // Android crops to a circle or squircle and guarantees only the middle
        // 80%; this one keeps the duck inside that safe zone.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
