import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../hooks/useMediaQuery";
import DonorBadge, { BADGE_CONFIG } from "./DonorBadge";

interface UserProfilePopupProps {
  username: string;
  blessings: number;
  donorTier?: "supporter" | "patron" | "benefactor" | null;
  memberSince?: string | null;
  position: { x: number; y: number };
  onClose: () => void;
}

// Disciple jokes — pick one based on username hash for consistency
const DISCIPLE_LINES = [
  "A faithful disciple of the moral code.",
  "Sworn to uphold the flexible commandments.",
  "Wandering the path of righteous voting.",
  "Blessed by the algorithm of morality.",
  "A humble servant of the collective conscience.",
  "Destined to judge all commandments, great and small.",
  "Touched grass exactly once. It was enough.",
  "Their moral compass spins... flexibly.",
];

function getDiscipleLine(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  }
  return DISCIPLE_LINES[Math.abs(hash) % DISCIPLE_LINES.length];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function UserProfilePopup({
  username,
  blessings,
  donorTier,
  memberSince,
  position,
  onClose,
}: UserProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const badge = donorTier && BADGE_CONFIG[donorTier] ? BADGE_CONFIG[donorTier] : null;
  const discipleLine = getDiscipleLine(username);

  // Mobile: centered overlay; Desktop: positioned near click
  const style: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        backgroundColor: "rgba(15, 12, 5, 0.97)",
        border: "2px solid #d4af37",
        borderRadius: "14px",
        padding: "24px 20px",
        width: "calc(100vw - 48px)",
        maxWidth: "340px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 20px rgba(212, 175, 55, 0.25)",
        fontFamily: "'Cinzel', serif",
        color: "#fdf8e6",
      }
    : {
        position: "fixed",
        left: Math.min(position.x, window.innerWidth - 160),
        top: Math.min(position.y + 8, window.innerHeight - 200),
        zIndex: 9999,
        backgroundColor: "rgba(15, 12, 5, 0.97)",
        border: "2px solid #d4af37",
        borderRadius: "14px",
        padding: "20px 22px",
        minWidth: "240px",
        maxWidth: "320px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 20px rgba(212, 175, 55, 0.25)",
        fontFamily: "'Cinzel', serif",
        color: "#fdf8e6",
        transform: "translateX(-50%)",
      };

  // Backdrop overlay for mobile
  const overlay: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 9999,
      }
    : {};

  const content = (
    <>
      {isMobile && <div style={overlay} onClick={onClose} />}
      <div ref={popupRef} style={style}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "8px",
            right: "10px",
            background: "none",
            border: "none",
            color: "#d4af37",
            fontSize: "1.2rem",
            cursor: "pointer",
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            lineHeight: 1,
            padding: "2px 6px",
            opacity: 0.8,
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Username */}
        <div
          style={{
            fontSize: isMobile ? "1.3rem" : "1.1rem",
            fontWeight: 700,
            color: "#d4af37",
            marginBottom: "4px",
            textAlign: "center",
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          {username}
          {donorTier && <DonorBadge tier={donorTier} size="medium" />}
        </div>

        {/* Disciple joke */}
        <p
          style={{
            textAlign: "center",
            fontSize: isMobile ? "0.8rem" : "0.75rem",
            color: "#999",
            fontStyle: "italic",
            margin: "4px 0 14px 0",
            lineHeight: 1.4,
          }}
        >
          "{discipleLine}"
        </p>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(212, 175, 55, 0.3)", margin: "0 0 12px 0" }} />

        {/* Blessings */}
        <div
          style={{
            textAlign: "center",
            fontSize: isMobile ? "0.95rem" : "0.85rem",
            color: "#c8b070",
            marginBottom: "10px",
          }}
        >
          <span style={{ fontSize: isMobile ? "1.6rem" : "1.3rem", fontWeight: 700, color: "#d4af37" }}>
            {blessings}
          </span>{" "}
          blessing{blessings !== 1 ? "s" : ""} received
        </div>

        {/* Supporter status */}
        {badge ? (
          <div
            style={{
              textAlign: "center",
              fontSize: isMobile ? "1rem" : "0.85rem",
              color: badge.color,
              fontWeight: 700,
              textShadow: `0 0 10px ${badge.glow}`,
              marginBottom: "10px",
              padding: "6px 0",
              borderRadius: "6px",
              backgroundColor: "rgba(212, 175, 55, 0.08)",
            }}
          >
            {badge.icon} {badge.label} {badge.icon}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              fontSize: isMobile ? "0.8rem" : "0.75rem",
              color: "#666",
              marginBottom: "10px",
            }}
          >
            Not yet a supporter
          </div>
        )}

        {/* Member since */}
        {memberSince && (
          <>
            <div style={{ borderTop: "1px solid rgba(212, 175, 55, 0.2)", margin: "0 0 10px 0" }} />
            <div
              style={{
                textAlign: "center",
                fontSize: isMobile ? "0.8rem" : "0.75rem",
                color: "#888",
              }}
            >
              Disciple since {formatDate(memberSince)}
            </div>
          </>
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
