import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Briefly",
    short_name: "Briefly",
    description: "Zero-waste intelligence briefings for Markets, Sports and Geopolitics.",
    start_url: "/briefing/markets",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
