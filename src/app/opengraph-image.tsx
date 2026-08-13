import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          padding: "80px 96px",
          background: "#0f1216",
          color: "#e8e9e7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#6f9bc7",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          INCIDENT RESPONSE
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, marginTop: 4, display: "flex" }}>
          Copilot
        </div>
        <div style={{ fontSize: 30, color: "#a2a9b3", marginTop: 28, display: "flex" }}>
          증권 IT 시스템을 위한 24/7 장애 대응 지원 Agent
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 56 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: "#e36a5f" }} />
          <div style={{ width: 22, height: 22, borderRadius: 11, background: "#de9a4a" }} />
          <div style={{ width: 22, height: 22, borderRadius: 11, background: "#6fa6cc" }} />
          <div style={{ width: 22, height: 22, borderRadius: 11, background: "#5fb98a" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
