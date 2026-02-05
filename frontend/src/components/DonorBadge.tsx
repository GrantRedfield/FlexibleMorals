interface DonorBadgeProps {
  tier: "supporter" | "patron" | "benefactor" | null | undefined;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

const BADGE_CONFIG = {
  supporter: {
    icon: "⭐",
    color: "#cd7f32",
    label: "Supporter",
    glow: "rgba(205, 127, 50, 0.6)",
  },
  patron: {
    icon: "✦",
    color: "#c0c0c0",
    label: "Patron",
    glow: "rgba(192, 192, 192, 0.6)",
  },
  benefactor: {
    icon: "👑",
    color: "#d4af37",
    label: "Benefactor",
    glow: "rgba(212, 175, 55, 0.8)",
  },
};

const SIZE_CONFIG = {
  small: { fontSize: "0.9rem", padding: "0 2px" },
  medium: { fontSize: "1.2rem", padding: "0 4px" },
  large: { fontSize: "1.6rem", padding: "0 6px" },
};

export default function DonorBadge({ tier, size = "small", showLabel = false }: DonorBadgeProps) {
  if (!tier || !BADGE_CONFIG[tier]) return null;

  const badge = BADGE_CONFIG[tier];
  const sizeStyle = SIZE_CONFIG[size];

  return (
    <span
      className={`donor-badge donor-badge-${size} donor-tier-${tier}`}
      title={badge.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "4px",
        fontWeight: "bold",
        color: badge.color,
        textShadow: `0 0 6px ${badge.glow}`,
        fontSize: sizeStyle.fontSize,
        padding: sizeStyle.padding,
        animation: "badgeGlow 2s ease-in-out infinite",
      }}
    >
      {badge.icon}
      {showLabel && (
        <span
          style={{
            marginLeft: "4px",
            fontSize: "0.75em",
            fontWeight: 600,
          }}
        >
          {badge.label}
        </span>
      )}
    </span>
  );
}

// Export badge config for use elsewhere
export { BADGE_CONFIG };
