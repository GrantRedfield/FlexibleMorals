import React from "react";
import "./LoginPrompt.css";

interface LoginPromptProps {
  onClose: () => void;
}

export default function LoginPrompt({ onClose }: LoginPromptProps) {
  return (
    <div className="login-prompt-overlay">
      <div className="login-prompt">
        <h2>Login Required</h2>
        <p>You must be logged in to perform this action.</p>
        <button onClick={onClose} className="home-button">
          Close
        </button>
      </div>
    </div>
  );
}
