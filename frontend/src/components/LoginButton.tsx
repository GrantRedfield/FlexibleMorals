import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import DonorBadge from "./DonorBadge";

export default function LoginButton() {
  const { user, logout, openLoginModal } = useAuth();
  const { getDonorStatus, loadDonorStatuses } = useDonor();

  useEffect(() => {
    if (user) loadDonorStatuses([user]);
  }, [user, loadDonorStatuses]);

  const donorStatus = user ? getDonorStatus(user) : null;

  return (
    <div className={`login-button-container${user ? " logged-in" : ""}`}>
      {user ? (
        <>
          <span className="login-welcome">
            Welcome disciple{" "}
            <span className="login-username">{user}</span>
            {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
          </span>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </>
      ) : (
        <button onClick={openLoginModal} className="login-btn">
          Login
        </button>
      )}
    </div>
  );
}
