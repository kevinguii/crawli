import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crawli: Resale Price Search",
    short_name: "Crawli",
    description:
      "Compare resale prices across Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay & Vestiaire in one search.",
    start_url: "/",
    display: "standalone",
    background_color: "#111110",
    theme_color: "#111110",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.ico",
        sizes: "32x32",
        type: "image/x-icon",
      },
    ],
  };
}
