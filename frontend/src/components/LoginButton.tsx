import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import DonorBadge from "./DonorBadge";
import LoginModal from "./LoginModal";

export default function LoginButton() {
  const { user, logout } = useAuth();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const [showModal, setShowModal] = useState(false);

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
        <button onClick={() => setShowModal(true)} className="login-btn">
          Login
        </button>
      )}
      {showModal && <LoginModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
