import { useState } from "react";

interface DonationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const ETH_ADDRESS = "0x3c0BC1BF347b63d893900F60e30df3fd5cB446Dc";
const PAYPAL_URL = "https://www.paypal.com/donate/?business=E9ZG5U75GEYBQ&no_recurring=0&item_name=Thank+you+for+keeping+the+vision+alive%21&currency_code=USD";

export default function DonationPopup({ isOpen, onClose }: DonationPopupProps) {
  const [showCrypto, setShowCrypto] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(ETH_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handlePayPal = () => {
    window.open(PAYPAL_URL, "_blank", "noopener,noreferrer");
  };

  const handleBack = () => {
    setShowCrypto(false);
  };

  const handleClose = () => {
    setShowCrypto(false);
    setCopied(false);
    onClose();
  };

  return (
    <div className="popup-overlay" onClick={handleClose}>
      <div
        className="popup-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "520px",
          padding: "2rem",
          backgroundColor: "#1a1a1a",
          border: "2px solid #d4af37",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {!showCrypto ? (
          <>
            <h2 style={{ color: "#d4af37", marginBottom: "0.5rem", fontSize: "1.8rem", fontFamily: "'Cinzel', serif" }}>
              Make an Offering
            </h2>

            <div style={{
              backgroundColor: "rgba(212, 175, 55, 0.06)",
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "1rem",
            }}>
              <p style={{ color: "#ccc", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 8px 0" }}>
                Flexible Morals is built and maintained by a <span style={{ color: "#d4af37", fontWeight: 600 }}>single developer</span> with
                a dream of building the world's first crowd-sourced religion. Your offering helps keep the servers running and
                funds new features for our growing congregation.
              </p>
              <p style={{ color: "#999", fontSize: "0.8rem", margin: 0, fontStyle: "italic" }}>
                Every dollar makes a difference. Thank you for believing.
              </p>
            </div>

            {/* Donor Tier Flair Preview */}
            <div style={{
              marginBottom: "1.2rem",
              padding: "12px 16px",
              backgroundColor: "rgba(0,0,0,0.3)",
              borderRadius: "10px",
              border: "1px solid #333",
            }}>
              <p style={{ color: "#aaa", fontSize: "0.8rem", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                Donor Flair Tiers
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem", textShadow: "0 0 6px rgba(205, 127, 50, 0.6)" }}>⭐</span>
                  <span style={{ color: "#cd7f32", fontWeight: 600, fontSize: "0.95rem" }}>Supporter</span>
                  <span style={{ color: "#777", fontSize: "0.8rem", marginLeft: "auto" }}>$1+</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem", textShadow: "0 0 6px rgba(192, 192, 192, 0.6)" }}>🙏</span>
                  <span style={{ color: "#c0c0c0", fontWeight: 600, fontSize: "0.95rem" }}>Patron</span>
                  <span style={{ color: "#777", fontSize: "0.8rem", marginLeft: "auto" }}>$25+</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem", textShadow: "0 0 6px rgba(212, 175, 55, 0.8)" }}>👑</span>
                  <span style={{ color: "#d4af37", fontWeight: 600, fontSize: "0.95rem" }}>Benefactor</span>
                  <span style={{ color: "#777", fontSize: "0.8rem", marginLeft: "auto" }}>$100+</span>
                </div>
              </div>
              <p style={{ color: "#666", fontSize: "0.75rem", margin: "10px 0 0 0", fontStyle: "italic" }}>
                Your flair appears next to your name across the site
              </p>
            </div>

            <p style={{ color: "#aaa", marginBottom: "0.75rem", fontSize: "0.95rem" }}>
              Choose your preferred method
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Credit Card - Coming Soon */}
              <button
                disabled
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  padding: "16px 24px",
                  borderRadius: "10px",
                  border: "2px solid #555",
                  backgroundColor: "#2a2a2a",
                  color: "#666",
                  fontSize: "1.2rem",
                  cursor: "not-allowed",
                  position: "relative",
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>💳</span>
                <span>Credit Card</span>
                <span
                  style={{
                    position: "absolute",
                    right: "12px",
                    backgroundColor: "#444",
                    color: "#888",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Coming Soon
                </span>
              </button>

              {/* Crypto */}
              <button
                onClick={() => setShowCrypto(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  padding: "16px 24px",
                  borderRadius: "10px",
                  border: "2px solid #d4af37",
                  backgroundColor: "rgba(212, 175, 55, 0.1)",
                  color: "#d4af37",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.2)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.1)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>🪙</span>
                <span>Crypto (ETH)</span>
              </button>

              {/* PayPal */}
              <button
                onClick={handlePayPal}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  padding: "16px 24px",
                  borderRadius: "10px",
                  border: "2px solid #0070ba",
                  backgroundColor: "rgba(0, 112, 186, 0.1)",
                  color: "#0070ba",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(0, 112, 186, 0.2)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(0, 112, 186, 0.1)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>🅿️</span>
                <span>PayPal</span>
              </button>
            </div>

            <button
              onClick={handleClose}
              className="popup-close"
              style={{ marginTop: "1.5rem" }}
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 style={{ color: "#d4af37", marginBottom: "0.5rem", fontSize: "1.8rem" }}>
              🪙 Crypto Donation
            </h2>
            <p style={{ color: "#aaa", marginBottom: "1rem", fontSize: "1rem" }}>
              Send ETH to the address below
            </p>

            {/* Ethereum Address */}
            <div
              style={{
                backgroundColor: "#2a2a2a",
                border: "2px solid #627eea",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>⟠</span>
                <span style={{ color: "#627eea", fontWeight: 600 }}>Ethereum (ETH)</span>
              </div>
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: "6px",
                  padding: "12px",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  color: "#fdf8e6",
                  wordBreak: "break-all",
                  marginBottom: "10px",
                }}
              >
                {ETH_ADDRESS}
              </div>
              <button
                onClick={handleCopyAddress}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: copied ? "#4caf50" : "#627eea",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                {copied ? "✓ Copied!" : "Copy Address"}
              </button>
            </div>

            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1rem" }}>
              After donating, visit your Donor Profile to link your wallet and receive your flair!
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleBack}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "2px solid #555",
                  backgroundColor: "transparent",
                  color: "#aaa",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleClose}
                className="popup-close"
                style={{ flex: 1 }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
