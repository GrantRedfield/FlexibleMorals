import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import DonorBadge from "./DonorBadge";
import "./HamburgerMenu.css";

interface HamburgerMenuProps {
  onOfferingClick: () => void;
  onMerchClick: () => void;
  onCharterClick: () => void;
  onVideosClick: () => void;
}

export default function HamburgerMenu({ onOfferingClick, onMerchClick, onCharterClick, onVideosClick }: HamburgerMenuProps) {
  const { user, logout, openLoginModal } = useAuth();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadDonorStatuses([user]);
  }, [user, loadDonorStatuses]);

  const donorStatus = user ? getDonorStatus(user) : null;

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleNav = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <>
      {/* Hamburger icon */}
      <button
        className="hamburger-icon"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      {/* Backdrop */}
      {isOpen && <div className="hamburger-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Slide-out panel */}
      <div ref={panelRef} className={`hamburger-panel${isOpen ? " open" : ""}`}>
        <button className="hamburger-close" onClick={() => setIsOpen(false)} aria-label="Close menu">
          ✕
        </button>

        {/* Auth section */}
        <div className="hamburger-auth">
          {user ? (
            <>
              <span className="hamburger-welcome">
                Welcome disciple
              </span>
              <span className="hamburger-username">
                {user}
                {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
              </span>
              <button onClick={() => handleNav(logout)} className="hamburger-logout-btn">
                Logout
              </button>
            </>
          ) : (
            <button onClick={() => handleNav(openLoginModal)} className="hamburger-login-btn">
              Login
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="hamburger-divider" />

        {/* Navigation links */}
        <nav className="hamburger-nav">
          <button onClick={() => handleNav(onOfferingClick)} className="hamburger-nav-btn">
            Offering
          </button>
          <button onClick={() => handleNav(onMerchClick)} className="hamburger-nav-btn">
            Merch
          </button>
          <button onClick={() => handleNav(onCharterClick)} className={`hamburger-nav-btn${!user ? " hamburger-nav-glow" : ""}`}>
            Our Charter
          </button>
          <button onClick={() => handleNav(onVideosClick)} className="hamburger-nav-btn">
            Promotional Content
          </button>
        </nav>
      </div>
    </>
  );
}
