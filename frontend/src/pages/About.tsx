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
        Flexible Morals was founded by two individuals looking for a framework of morality that would proactively evolve with the times. Our goal is to create an ad-free, bot-free space to serve as a forum for what the internet believes to be the present day ten commandments for living a moral life. Will the internet reinforce human principles like not murdering others, or will it reward timely meme-like reactions to inform our moral code?
      </p>
      <p style={{ maxWidth: "700px", lineHeight: "1.6", marginTop: "1rem" }}>
        You, dear reader and future disciple, can voice your opinion in the <strong style={{ color: "#d4af37", backgroundColor: "rgba(0, 0, 0, 0.7)", padding: "2px 6px", borderRadius: "3px" }}>world's first democratic religion</strong>. Share the daily commandment guiding your life, and vote on the commandments of others. The collective will decide our top ten commandments, with voting resetting every month.
      </p>
      <p style={{ maxWidth: "700px", lineHeight: "1.6", marginTop: "1rem" }}>
        If you are compelled by the mission of navigating morality through the flexible nature of culture and time, please consider making an offering to support keeping this website alive, ad-free, and bot-free.
      </p>
      <p style={{ maxWidth: "700px", lineHeight: "1.6", marginTop: "1rem" }}>
        If you would like to spread the word, share the website with your friends or consider buying our merchandise to represent the good word.
      </p>
      <p style={{ maxWidth: "700px", lineHeight: "1.6", marginTop: "1rem" }}>
        Our objective is not to make a profit, but to facilitate a movement. One inflexible principle of our founding is that we will donate to Save the Children, in support of those providing hope and care for humanity's future.
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
