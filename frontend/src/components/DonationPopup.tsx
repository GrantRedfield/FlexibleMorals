import { useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { createStripeCheckout } from "../utils/api";

interface DonationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const ETH_ADDRESS = "0x3c0BC1BF347b63d893900F60e30df5cB446Dc";
const PAYPAL_URL = "https://www.paypal.com/donate/?business=E9ZG5U75GEYBQ&no_recurring=0&item_name=Thank+you+for+keeping+the+vision+alive%21&currency_code=USD";

const QUICK_AMOUNTS = [
  { label: "$3", cents: 300 },
  { label: "$5", cents: 500 },
  { label: "$25", cents: 2500 },
  { label: "$100", cents: 10000 },
];

export default function DonationPopup({ isOpen, onClose }: DonationPopupProps) {
  const [showCrypto, setShowCrypto] = useState(false);
  const [showStripeAmount, setShowStripeAmount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stripeAmount, setStripeAmount] = useState<number | null>(null);
  const [customDollars, setCustomDollars] = useState("");
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const isMobile = useMediaQuery("(max-width: 768px)");

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
    setShowStripeAmount(false);
    setStripeAmount(null);
    setCustomDollars("");
    setStripeError("");
  };

  const handleClose = () => {
    setShowCrypto(false);
    setShowStripeAmount(false);
    setCopied(false);
    setStripeAmount(null);
    setCustomDollars("");
    setStripeError("");
    setStripeLoading(false);
    onClose();
  };

  const handleQuickPick = (cents: number) => {
    setStripeAmount(cents);
    setCustomDollars("");
    setStripeError("");
  };

  const handleCustomDollarsChange = (value: string) => {
    // Allow only digits and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    // Prevent multiple decimal points
    const parts = cleaned.split(".");
    const formatted = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
    setCustomDollars(formatted);
    setStripeAmount(null);
    setStripeError("");
  };

  const getEffectiveAmountCents = (): number => {
    if (stripeAmount) return stripeAmount;
    if (customDollars) {
      const dollars = parseFloat(customDollars);
      if (!isNaN(dollars) && dollars >= 1) return Math.round(dollars * 100);
    }
    return 0;
  };

  const handleStripeCheckout = async () => {
    const amountCents = getEffectiveAmountCents();
    if (amountCents < 100) {
      setStripeError("Minimum donation is $1.00");
      return;
    }

    setStripeLoading(true);
    setStripeError("");

    try {
      const { url } = await createStripeCheckout(amountCents);
      if (url) {
        window.location.href = url;
      } else {
        setStripeError("Failed to create checkout session");
        setStripeLoading(false);
      }
    } catch (err: any) {
      setStripeError(err.response?.data?.error || "Something went wrong");
      setStripeLoading(false);
    }
  };

  // Shared button row for Back + Close
  const backCloseButtons = (
    <div style={{ display: "flex", gap: "10px" }}>
      <button
        onClick={handleBack}
        style={{
          flex: 1,
          padding: isMobile ? "10px 14px" : "10px 16px",
          borderRadius: "6px",
          border: "2px solid #555",
          backgroundColor: "transparent",
          color: "#aaa",
          fontSize: isMobile ? "0.9rem" : "1rem",
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
  );

  // Determine which view to show
  const renderContent = () => {
    // --- Stripe Amount Selection View ---
    if (showStripeAmount) {
      const effectiveCents = getEffectiveAmountCents();
      return (
        <>
          <h2 style={{ color: "#635bff", marginBottom: isMobile ? "0.4rem" : "0.5rem", fontSize: isMobile ? "1.3rem" : "1.8rem", fontFamily: "'Cinzel', serif" }}>
            Credit Card Donation
          </h2>
          <p style={{ color: "#ccc", marginBottom: isMobile ? "0.6rem" : "1rem", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
            Choose an amount
          </p>

          {/* Quick-pick buttons */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: isMobile ? "8px" : "10px",
            marginBottom: isMobile ? "0.6rem" : "1rem",
          }}>
            {QUICK_AMOUNTS.map(({ label, cents }) => (
              <button
                key={cents}
                onClick={() => handleQuickPick(cents)}
                style={{
                  padding: isMobile ? "12px" : "16px",
                  borderRadius: isMobile ? "6px" : "8px",
                  border: stripeAmount === cents ? "2px solid #635bff" : "2px solid #444",
                  backgroundColor: stripeAmount === cents ? "rgba(99, 91, 255, 0.15)" : "#2a2a2a",
                  color: stripeAmount === cents ? "#635bff" : "#ccc",
                  fontSize: isMobile ? "1.1rem" : "1.3rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom amount input */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: isMobile ? "0.6rem" : "1rem",
          }}>
            <span style={{ color: "#ccc", fontSize: isMobile ? "1.1rem" : "1.3rem", fontWeight: 700 }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Custom amount"
              value={customDollars}
              onChange={(e) => handleCustomDollarsChange(e.target.value)}
              style={{
                flex: 1,
                padding: isMobile ? "10px 12px" : "12px 14px",
                borderRadius: "6px",
                border: customDollars ? "2px solid #635bff" : "2px solid #444",
                backgroundColor: "#2a2a2a",
                color: "#fdf8e6",
                fontSize: isMobile ? "1rem" : "1.1rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {stripeError && (
            <p style={{ color: "#f44336", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              {stripeError}
            </p>
          )}

          {/* Proceed button */}
          <button
            onClick={handleStripeCheckout}
            disabled={effectiveCents < 100 || stripeLoading}
            style={{
              width: "100%",
              padding: isMobile ? "12px" : "16px",
              borderRadius: isMobile ? "6px" : "8px",
              border: "none",
              backgroundColor: effectiveCents >= 100 && !stripeLoading ? "#635bff" : "#444",
              color: effectiveCents >= 100 && !stripeLoading ? "#fff" : "#888",
              fontSize: isMobile ? "1rem" : "1.15rem",
              fontWeight: 700,
              cursor: effectiveCents >= 100 && !stripeLoading ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
              marginBottom: isMobile ? "0.6rem" : "1rem",
            }}
          >
            {stripeLoading
              ? "Redirecting..."
              : effectiveCents >= 100
                ? `Proceed to Checkout — $${(effectiveCents / 100).toFixed(2)}`
                : "Select an amount"}
          </button>

          <p style={{ color: "#999", fontSize: isMobile ? "0.7rem" : "0.78rem", marginBottom: isMobile ? "0.6rem" : "1rem", textAlign: "center" }}>
            You'll be securely redirected to Stripe to complete your payment
          </p>

          {backCloseButtons}
        </>
      );
    }

    // --- Crypto View ---
    if (showCrypto) {
      return (
        <>
          <h2 style={{ color: "#d4af37", marginBottom: isMobile ? "0.4rem" : "0.5rem", fontSize: isMobile ? "1.4rem" : "1.8rem" }}>
            Crypto Donation
          </h2>
          <p style={{ color: "#aaa", marginBottom: isMobile ? "0.6rem" : "1rem", fontSize: isMobile ? "0.9rem" : "1rem" }}>
            Send ETH to the address below
          </p>

          {/* Ethereum Address */}
          <div
            style={{
              backgroundColor: "#2a2a2a",
              border: "2px solid #627eea",
              borderRadius: isMobile ? "8px" : "10px",
              padding: isMobile ? "12px" : "16px",
              marginBottom: isMobile ? "0.6rem" : "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: isMobile ? "8px" : "8px" }}>
              <span style={{ fontSize: isMobile ? "1.1rem" : "1.2rem" }}>⟠</span>
              <span style={{ color: "#627eea", fontWeight: 600, fontSize: isMobile ? "0.9rem" : undefined }}>Ethereum (ETH)</span>
            </div>
            <div
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: "6px",
                padding: isMobile ? "10px" : "12px",
                fontFamily: "monospace",
                fontSize: isMobile ? "0.75rem" : "0.85rem",
                color: "#fdf8e6",
                wordBreak: "break-all",
                marginBottom: isMobile ? "10px" : "10px",
              }}
            >
              {ETH_ADDRESS}
            </div>
            <button
              onClick={handleCopyAddress}
              style={{
                width: "100%",
                padding: isMobile ? "10px" : "10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: copied ? "#4caf50" : "#627eea",
                color: "white",
                fontSize: isMobile ? "0.9rem" : "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
              }}
            >
              {copied ? "✓ Copied!" : "Copy Address"}
            </button>
          </div>

          <p style={{ color: "#888", fontSize: isMobile ? "0.8rem" : "0.85rem", marginBottom: isMobile ? "0.6rem" : "1rem" }}>
            After donating, visit your Donor Profile to link your wallet and receive your flair!
          </p>

          {backCloseButtons}
        </>
      );
    }

    // --- Main Method Selection View ---
    return (
      <>
        <h2 style={{ color: "#d4af37", marginBottom: isMobile ? "0.3rem" : "0.5rem", fontSize: isMobile ? "1.3rem" : "1.8rem", fontFamily: "'Cinzel', serif" }}>
          Make an Offering
        </h2>

        <div style={{
          backgroundColor: "rgba(212, 175, 55, 0.06)",
          border: "1px solid rgba(212, 175, 55, 0.2)",
          borderRadius: isMobile ? "6px" : "10px",
          padding: isMobile ? "6px 10px" : "14px 16px",
          marginBottom: isMobile ? "0.4rem" : "1rem",
        }}>
          <p style={{ color: "#e0d8c8", fontSize: isMobile ? "0.78rem" : "0.9rem", lineHeight: isMobile ? 1.4 : 1.6, margin: isMobile ? "0 0 3px 0" : "0 0 8px 0" }}>
            Flexible Morals is built and maintained by a <span style={{ color: "#d4af37", fontWeight: 600 }}>single developer</span> with
            a dream of building the world's first crowd-sourced religion. Your offering helps keep the servers running and
            funds new features for our growing congregation.
          </p>
          <p style={{ color: "#c0b89a", fontSize: isMobile ? "0.72rem" : "0.8rem", margin: 0, fontStyle: "italic" }}>
            Every dollar makes a difference. Thank you for believing.
          </p>
        </div>

        {/* Donor Tier Flair Preview */}
        <div style={{
          marginBottom: isMobile ? "0.4rem" : "1.2rem",
          padding: isMobile ? "5px 10px" : "12px 16px",
          backgroundColor: "rgba(0,0,0,0.3)",
          borderRadius: isMobile ? "6px" : "10px",
          border: "1px solid #333",
        }}>
          <p style={{ color: "#ccc", fontSize: isMobile ? "0.68rem" : "0.8rem", marginBottom: isMobile ? "4px" : "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Donor Flair Tiers
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "2px" : "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
              <span style={{ fontSize: isMobile ? "0.95rem" : "1.3rem", textShadow: "0 0 6px rgba(205, 127, 50, 0.6)" }}>⭐</span>
              <span style={{ color: "#cd7f32", fontWeight: 600, fontSize: isMobile ? "0.8rem" : "0.95rem" }}>Supporter</span>
              <span style={{ color: "#b0a880", fontSize: isMobile ? "0.7rem" : "0.8rem", marginLeft: "auto" }}>$1+</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
              <span style={{ fontSize: isMobile ? "0.95rem" : "1.3rem", textShadow: "0 0 6px rgba(192, 192, 192, 0.6)" }}>🙏</span>
              <span style={{ color: "#c0c0c0", fontWeight: 600, fontSize: isMobile ? "0.8rem" : "0.95rem" }}>Patron</span>
              <span style={{ color: "#b0a880", fontSize: isMobile ? "0.7rem" : "0.8rem", marginLeft: "auto" }}>$25+</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
              <span style={{ fontSize: isMobile ? "0.95rem" : "1.3rem", textShadow: "0 0 6px rgba(212, 175, 55, 0.8)" }}>👑</span>
              <span style={{ color: "#d4af37", fontWeight: 600, fontSize: isMobile ? "0.8rem" : "0.95rem" }}>Benefactor</span>
              <span style={{ color: "#b0a880", fontSize: isMobile ? "0.7rem" : "0.8rem", marginLeft: "auto" }}>$100+</span>
            </div>
          </div>
          <p style={{ color: "#999", fontSize: isMobile ? "0.65rem" : "0.75rem", margin: isMobile ? "3px 0 0 0" : "10px 0 0 0", fontStyle: "italic" }}>
            Your flair appears next to your name across the site
          </p>
        </div>

        <p style={{ color: "#ccc", marginBottom: isMobile ? "0.3rem" : "0.75rem", fontSize: isMobile ? "0.82rem" : "0.95rem" }}>
          Choose your preferred method
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "7px" : "12px" }}>
          {/* Credit Card (Stripe) */}
          <button
            onClick={() => setShowStripeAmount(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? "8px" : "12px",
              padding: isMobile ? "10px 14px" : "16px 24px",
              borderRadius: isMobile ? "6px" : "10px",
              border: "2px solid #635bff",
              backgroundColor: "rgba(99, 91, 255, 0.1)",
              color: "#635bff",
              fontSize: isMobile ? "0.95rem" : "1.2rem",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(99, 91, 255, 0.2)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(99, 91, 255, 0.1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <span style={{ fontSize: isMobile ? "1.1rem" : "1.5rem" }}>💳</span>
            <span>Credit Card</span>
          </button>

          {/* Crypto */}
          <button
            onClick={() => setShowCrypto(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? "8px" : "12px",
              padding: isMobile ? "10px 14px" : "16px 24px",
              borderRadius: isMobile ? "6px" : "10px",
              border: "2px solid #d4af37",
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              color: "#d4af37",
              fontSize: isMobile ? "0.95rem" : "1.2rem",
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
            <span style={{ fontSize: isMobile ? "1.1rem" : "1.5rem" }}>🪙</span>
            <span>Crypto (ETH)</span>
          </button>

          {/* PayPal */}
          <button
            onClick={handlePayPal}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? "8px" : "12px",
              padding: isMobile ? "10px 14px" : "16px 24px",
              borderRadius: isMobile ? "6px" : "10px",
              border: "2px solid #0070ba",
              backgroundColor: "rgba(0, 112, 186, 0.1)",
              color: "#0070ba",
              fontSize: isMobile ? "0.95rem" : "1.2rem",
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
            <span style={{ fontSize: isMobile ? "1.1rem" : "1.5rem" }}>🅿️</span>
            <span>PayPal</span>
          </button>
        </div>

        <button
          onClick={handleClose}
          className="popup-close"
          style={{ marginTop: isMobile ? "0.6rem" : "1.5rem" }}
        >
          Close
        </button>
      </>
    );
  };

  return (
    <div className="popup-overlay" onClick={handleClose}>
      <div
        className="popup-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "520px",
          padding: isMobile ? "0.8rem 1rem 0.7rem" : "2rem",
          backgroundColor: "#1a1a1a",
          border: "2px solid #d4af37",
          maxHeight: isMobile ? "none" : "90vh",
          overflowY: isMobile ? "visible" : "auto",
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
}
