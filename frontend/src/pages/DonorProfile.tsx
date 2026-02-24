import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { linkPayPalEmail, getDonorTiers } from "../utils/api";
import DonorBadge from "../components/DonorBadge";
import "../App.css";

interface TierInfo {
  name: string;
  threshold: number;
  badge: string;
  icon: string;
  color: string;
  label: string;
}

export default function DonorProfile() {
  const navigate = useNavigate();
  const { user, openLoginModal } = useAuth();
  const { myDonorStatus, loadMyDonorStatus } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [paypalEmail, setPaypalEmail] = useState("");
  const [linkStatus, setLinkStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tiers, setTiers] = useState<TierInfo[]>([]);

  // Load tiers info
  useEffect(() => {
    getDonorTiers().then((data) => setTiers(data.tiers || []));
  }, []);

  // Load user's donor status
  useEffect(() => {
    if (user) {
      loadMyDonorStatus(user);
    }
  }, [user, loadMyDonorStatus]);

  // Require login
  const requireLogin = (): boolean => {
    if (user) return true;
    openLoginModal();
    return false;
  };

  // Handle email link submission
  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin()) return;
    if (!paypalEmail.trim()) return;

    setLoading(true);
    setLinkStatus(null);

    try {
      const result = await linkPayPalEmail(paypalEmail.trim(), user!);
      setLinkStatus({ success: true, message: result.message });
      setPaypalEmail("");
      // Reload donor status
      loadMyDonorStatus(user!);
    } catch (err: any) {
      setLinkStatus({
        success: false,
        message: err.response?.data?.error || "Failed to link email",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundImage: "url('/Voting_Background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "2rem",
        paddingBottom: "2rem",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(26, 26, 26, 0.95)",
          borderRadius: "12px",
          padding: isMobile ? "1rem" : "2rem",
          maxWidth: "600px",
          width: isMobile ? "95%" : "90%",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          border: "2px solid #d4af37",
          color: "#fdf8e6",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ color: "#d4af37", margin: 0, fontSize: isMobile ? "1.4rem" : "1.8rem" }}>
            Donor Profile
          </h1>
          <button onClick={() => navigate("/")} className="home-button">
            🏠 Home
          </button>
        </div>

        {!user ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <p style={{ color: "#aaa", marginBottom: "1rem" }}>
              Please log in to view your donor profile.
            </p>
            <button
              onClick={requireLogin}
              style={{
                backgroundColor: "#b79b3d",
                color: "#fdf8e6",
                padding: "10px 24px",
                borderRadius: "6px",
                border: "none",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Log In
            </button>
          </div>
        ) : (
          <>
            {/* Current Status */}
            <div
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.1)",
                border: "1px solid #d4af37",
                borderRadius: "10px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
                textAlign: "center",
              }}
            >
              <p style={{ color: "#aaa", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                Logged in as
              </p>
              <h2 style={{ color: "#d4af37", margin: "0 0 1rem 0", fontSize: "1.5rem" }}>
                {user}
                {myDonorStatus?.tier && (
                  <DonorBadge tier={myDonorStatus.tier as any} size="large" />
                )}
              </h2>

              {myDonorStatus?.isDonor ? (
                <div>
                  <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>
                    ${((myDonorStatus.totalDonated || 0) / 100).toFixed(2)}
                  </p>
                  <p style={{ color: "#aaa", fontSize: "0.9rem" }}>
                    Total donated • {myDonorStatus.tier?.toUpperCase()} tier
                  </p>
                  {myDonorStatus.nextTier && myDonorStatus.amountToNextTier > 0 && (
                    <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                      ${(myDonorStatus.amountToNextTier / 100).toFixed(2)} more to reach {myDonorStatus.nextTier}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ color: "#888" }}>
                  You haven't donated yet. Link your donation email below to get started!
                </p>
              )}
            </div>

            {/* Link Email Form */}
            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                borderRadius: "10px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <h3 style={{ color: "#d4af37", marginTop: 0, marginBottom: "0.5rem" }}>
                Link Your Donation Email
              </h3>
              <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "1rem" }}>
                Enter the email you use for PayPal or credit card donations to receive your donor flair.
                Any past donations from this email will be credited to your account.
              </p>

              <form onSubmit={handleLinkEmail}>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #555",
                    backgroundColor: "#2a2a2a",
                    color: "#fdf8e6",
                    fontSize: "1rem",
                    marginBottom: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !paypalEmail.trim()}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: loading ? "#555" : "#b79b3d",
                    color: "#fdf8e6",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Linking..." : "Link Email"}
                </button>
              </form>

              {linkStatus && (
                <p
                  style={{
                    marginTop: "1rem",
                    padding: "10px",
                    borderRadius: "6px",
                    backgroundColor: linkStatus.success
                      ? "rgba(76, 175, 80, 0.2)"
                      : "rgba(244, 67, 54, 0.2)",
                    color: linkStatus.success ? "#4caf50" : "#f44336",
                    fontSize: "0.9rem",
                  }}
                >
                  {linkStatus.message}
                </p>
              )}

              {myDonorStatus?.linkedEmail && (
                <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "1rem" }}>
                  Currently linked: {myDonorStatus.linkedEmail}
                </p>
              )}
            </div>

            {/* Tier Info */}
            <div>
              <h3 style={{ color: "#d4af37", marginBottom: "1rem" }}>Donor Tiers</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tiers.map((tier) => (
                  <div
                    key={tier.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor:
                        myDonorStatus?.tier === tier.name
                          ? "rgba(212, 175, 55, 0.2)"
                          : "rgba(0, 0, 0, 0.2)",
                      border:
                        myDonorStatus?.tier === tier.name
                          ? "1px solid #d4af37"
                          : "1px solid #333",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{tier.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: tier.color }}>
                        {tier.label}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#888" }}>
                        ${(tier.threshold / 100).toFixed(0)}+ donated
                      </p>
                    </div>
                    {myDonorStatus?.tier === tier.name && (
                      <span style={{ color: "#4caf50", fontSize: "0.9rem" }}>✓ Current</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
