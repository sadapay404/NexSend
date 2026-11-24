"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>NexSend hit an error</p>
          <p style={{ fontSize: 12, opacity: 0.5, wordBreak: "break-word" }}>
            {error.message}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              background: "#00A651",
              color: "#000",
              border: 0,
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
