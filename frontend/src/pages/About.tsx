import { useMediaQuery } from "../hooks/useMediaQuery";

export default function About() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <div
      style={{
        backgroundColor: "black",
        color: "white",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "1.5rem 1rem" : "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: isMobile ? "1.5rem" : "2rem", marginBottom: "1rem", color: "#d4af37", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}>
        OUR CHARTER
      </h1>
      <p style={{ maxWidth: "700px", lineHeight: "1.6" }}>
        I'd like to think of this as the first "democratic religion", where its only bounded
        by users imagination, on what morals to follow. The "Morals" will reset every month.
        <strong>Flexible Morals</strong> is a social experiment in crowd-sourced ethics.
        Users write and vote on commandments — some serious, some absurd —
        creating a living reflection of our collective values, humor, and contradictions.
      </p>
      <p style={{ marginTop: "1rem", opacity: 0.8 }}>
        Whether divine wisdom or chaos, every vote shapes the moral mosaic.
      </p>

      <button
        onClick={() => window.history.back()}
        style={{
          marginTop: "2rem",
          backgroundColor: "#d4af37",
          border: "none",
          borderRadius: "8px",
          padding: isMobile ? "12px 20px" : "10px 18px",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          minHeight: "44px",
        }}
      >
        Back to Home
      </button>
    </div>
  );
}
