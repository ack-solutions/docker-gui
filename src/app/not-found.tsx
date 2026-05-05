import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        color: "#475569"
      }}
    >
      <h1 style={{ fontSize: 48, margin: 0, color: "#0f172a" }}>404</h1>
      <p style={{ marginTop: 8, fontSize: 16 }}>This page does not exist.</p>
      <Link
        href="/"
        style={{
          marginTop: 16,
          color: "#0ea5e9",
          textDecoration: "none",
          fontWeight: 500
        }}
      >
        Go home →
      </Link>
    </div>
  );
}
