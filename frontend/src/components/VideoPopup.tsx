import { useMediaQuery } from "../hooks/useMediaQuery";

interface VideoPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const VIDEOS: { file: string; title: string }[] = [
  { file: "Microwave_Fish_In_Office.mp4", title: "Fish For Lunch" },
  { file: "plane_clapping.mp4", title: "Landing Etiquette" },
  { file: "door_holding.mp4", title: "Door Holding" },
  { file: "Ticket_Agent.mp4", title: "Ticket Agent" },
  { file: "phone_conversation.mp4", title: "Phone Conversation" },
];

export default function VideoPopup({ isOpen, onClose }: VideoPopupProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "640px",
          width: "92%",
          padding: isMobile ? "1rem" : "2rem",
          backgroundColor: "#1a1a1a",
          border: "2px solid #d4af37",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "sticky",
            top: 0,
            float: "right",
            background: "none",
            border: "none",
            color: "#d4af37",
            fontSize: "1.5rem",
            cursor: "pointer",
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            lineHeight: 1,
            padding: "4px 8px",
            zIndex: 10,
          }}
          aria-label="Close"
        >
          ✕
        </button>
        <h2
          style={{
            color: "#d4af37",
            marginBottom: isMobile ? "0.5rem" : "1rem",
            fontSize: isMobile ? "1.2rem" : "1.5rem",
            fontFamily: "'Cinzel', serif",
            textAlign: "center",
          }}
        >
          Videos
        </h2>

        {VIDEOS.map(({ file, title }) => (
          <div key={file} style={{ marginBottom: isMobile ? "1rem" : "1.5rem" }}>
            <h3
              style={{
                color: "#c8b070",
                fontSize: isMobile ? "0.9rem" : "1rem",
                fontFamily: "'Cinzel', serif",
                marginBottom: "0.4rem",
              }}
            >
              {title}
            </h3>
            <video
              controls
              playsInline
              preload="metadata"
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid rgba(212, 175, 55, 0.3)",
              }}
            >
              <source src={`/videos/${file}#t=0.001`} type="video/mp4" />
            </video>
          </div>
        ))}

        <button
          onClick={onClose}
          className="popup-close"
          style={{ marginTop: isMobile ? "0.5rem" : "1rem", display: "block", margin: "0 auto" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
