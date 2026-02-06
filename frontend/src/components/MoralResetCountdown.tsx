import { useEffect, useState } from "react";

const MoralResetCountdown = () => {
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const diffTime = endOfMonth.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysLeft(diffDays);
  }, []);

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "2rem",
        padding: "1rem",
        border: "2px solid #ccc",
        borderRadius: "12px",
        maxWidth: "400px",
        marginLeft: "auto",
        marginRight: "auto",
        backgroundColor: "#f9f9f9",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Number Of Days Until Moral Reset
      </h2>
      <p style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#444" }}>
        {daysLeft}
      </p>
    </div>
  );
};

export default MoralResetCountdown;
