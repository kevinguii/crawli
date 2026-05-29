import { ImageResponse } from "next/og";

// Node runtime (default) — the app is self-hosted on Node (Hetzner), not edge.
export const alt =
  "Crawli — compare resale prices across 8 marketplaces in one search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand gradient mirrors the Hero/Wordmark gradient.
const GRADIENT =
  "linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#111110",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "9999px",
              background: GRADIENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "36px",
              fontWeight: 700,
            }}
          >
            Cr
          </div>
          <div style={{ color: "#ffffff", fontSize: "40px", fontWeight: 700 }}>
            Crawli
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: "68px",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
            maxWidth: "1000px",
          }}
        >
          Compare resale prices across 8 marketplaces in one search.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "36px",
            color: "#b8b6b0",
            fontSize: "30px",
          }}
        >
          Grailed · Depop · Poshmark · StockX · Mercari · Vinted · eBay ·
          Vestiaire
        </div>
      </div>
    ),
    { ...size },
  );
}
