export default function About() {
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
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "#d4af37" }}>
        What in the world is this?!
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
          padding: "10px 18px",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Back to Home
      </button>
    </div>
  );
}
