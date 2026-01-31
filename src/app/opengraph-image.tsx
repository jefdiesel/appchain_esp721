import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Chainhost - Host Sites on Ethereum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#000",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Chain pattern background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            opacity: 0.06,
            fontSize: 80,
            lineHeight: 1,
            gap: 20,
          }}
        >
          {Array.from({ length: 48 }).map((_, i) => (
            <span key={i}>⛓</span>
          ))}
        </div>

        {/* Accent line top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#C3FF00",
          }}
        />

        {/* Main chain icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            fontSize: 96,
          }}
        >
          <span>⛓</span>
        </div>

        {/* Logo text */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 0,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-2px",
            }}
          >
            Chain
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#C3FF00",
              letterSpacing: "-2px",
            }}
          >
            Host
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#9ca3af",
            marginTop: 16,
          }}
        >
          Host websites on Ethereum. Forever.
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 20,
            color: "#C3FF00",
            opacity: 0.7,
          }}
        >
          chainhost.online
        </div>

        {/* Accent line bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#C3FF00",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
