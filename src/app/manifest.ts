import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LIFEQUEST",
    short_name: "LIFEQUEST",
    description: "Your life, forged into an epic quest.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0618",
    theme_color: "#0c0618",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      // TODO(design phase): add 192x192 and 512x512 PNG + maskable icons and apple-touch-icon.
    ],
  };
}
