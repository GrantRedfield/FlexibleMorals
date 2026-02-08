import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../hooks/useMediaQuery";
import DonorBadge, { BADGE_CONFIG } from "./DonorBadge";

interface UserProfilePopupProps {
  username: string;
  blessings: number;
  donorTier?: "supporter" | "patron" | "benefactor" | null;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function UserProfilePopup({
  username,
  blessings,
  donorTier,
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
    // Delay adding listener so the opening click doesn't immediately close it
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

  // Keep popup within viewport
  const style: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: "50%",
        bottom: "16px",
        top: "auto",
        transform: "translateX(-50%)",
        zIndex: 10000,
        backgroundColor: "rgba(15, 12, 5, 0.95)",
        border: "2px solid #d4af37",
        borderRadius: "10px",
        padding: "14px 18px",
        width: "calc(100vw - 32px)",
        maxWidth: "320px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(212, 175, 55, 0.2)",
        fontFamily: "'Cinzel', serif",
        color: "#fdf8e6",
      }
    : {
        position: "fixed",
        left: Math.min(position.x, window.innerWidth - 160),
        top: Math.min(position.y + 8, window.innerHeight - 150),
        zIndex: 9999,
        backgroundColor: "rgba(15, 12, 5, 0.95)",
        border: "2px solid #d4af37",
        borderRadius: "10px",
        padding: "14px 18px",
        minWidth: "200px",
        maxWidth: "280px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(212, 175, 55, 0.2)",
        fontFamily: "'Cinzel', serif",
        color: "#fdf8e6",
        transform: "translateX(-50%)",
      };

  const badge = donorTier && BADGE_CONFIG[donorTier] ? BADGE_CONFIG[donorTier] : null;

  return createPortal(
    <div ref={popupRef} style={style}>
      {/* Username */}
      <div
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "#d4af37",
          marginBottom: "8px",
          textAlign: "center",
          letterSpacing: "0.05em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        {username}
        {donorTier && <DonorBadge tier={donorTier} size="medium" />}
      </div>

      {/* Blessings */}
      <div
        style={{
          textAlign: "center",
          fontSize: "0.85rem",
          color: "#c8b070",
          marginBottom: donorTier ? "8px" : 0,
        }}
      >
        <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{blessings}</span>{" "}
        total blessing{blessings !== 1 ? "s" : ""} received
      </div>

      {/* Donor tier label */}
      {badge && (
        <div
          style={{
            textAlign: "center",
            fontSize: "0.8rem",
            color: badge.color,
            fontWeight: 600,
            textShadow: `0 0 8px ${badge.glow}`,
          }}
        >
          {badge.icon} {badge.label}
        </div>
      )}
    </div>,
    document.body
  );
}
