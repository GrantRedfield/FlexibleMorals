import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { signUp, confirmSignUp, resendCode } from "../utils/auth";
import "./LoginModal.css";

type View = "login" | "signup" | "confirm";

interface LoginModalProps {
  onClose: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const { login, quickLogin } = useAuth();
  const [view, setView] = useState<View>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) return setError("Username required");
    setError("");
    setLoading(true);

    try {
      if (password) {
        // Cognito login with password
        await login(username.trim(), password);
      } else {
        // Legacy quick login
        quickLogin(username.trim());
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Login failed";
      // If user isn't confirmed, redirect to confirm view
      if (err?.response?.data?.code === "UserNotConfirmedException") {
        setView("confirm");
        setError("");
        setMessage("Account not confirmed. Enter the code from your email.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!username.trim() || !password || !email.trim()) {
      return setError("All fields are required");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters");
    }
    setError("");
    setLoading(true);

    try {
      const result = await signUp(username.trim(), password, email.trim());
      setMessage(result.message);
      if (!result.confirmed) {
        setView("confirm");
      } else {
        setView("login");
        setMessage("Account created! You can now log in.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code.trim()) return setError("Confirmation code required");
    setError("");
    setLoading(true);

    try {
      await confirmSignUp(username.trim(), code.trim());
      setMessage("Confirmed! Logging you in...");
      // Auto-login after confirmation
      if (password) {
        await login(username.trim(), password);
        onClose();
      } else {
        setView("login");
        setMessage("Account confirmed! Enter your password to log in.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await resendCode(username.trim());
      setMessage(result.message);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>
          &times;
        </button>

        {view === "login" && (
          <>
            <h2 className="login-modal-title">Enter the Temple</h2>
            <p className="login-modal-subtitle">Sign in to decree your morals</p>

            <input
              type="text"
              placeholder="Username"
              className="login-modal-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            <input
              type="password"
              placeholder="Password (optional for quick login)"
              className="login-modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />

            {error && <p className="login-modal-error">{error}</p>}
            {message && <p className="login-modal-message">{message}</p>}

            <button
              className="login-modal-btn primary"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "..." : password ? "Sign In" : "Quick Login"}
            </button>

            <p className="login-modal-switch">
              New disciple?{" "}
              <span onClick={() => { setView("signup"); setError(""); setMessage(""); }}>
                Create Account
              </span>
            </p>
          </>
        )}

        {view === "signup" && (
          <>
            <h2 className="login-modal-title">Join the Order</h2>
            <p className="login-modal-subtitle">Create your sacred account</p>

            <input
              type="text"
              placeholder="Username"
              className="login-modal-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <input
              type="email"
              placeholder="Email"
              className="login-modal-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              className="login-modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
            />

            {error && <p className="login-modal-error">{error}</p>}
            {message && <p className="login-modal-message">{message}</p>}

            <button
              className="login-modal-btn primary"
              onClick={handleSignUp}
              disabled={loading}
            >
              {loading ? "..." : "Create Account"}
            </button>

            <p className="login-modal-switch">
              Already a disciple?{" "}
              <span onClick={() => { setView("login"); setError(""); setMessage(""); }}>
                Sign In
              </span>
            </p>
          </>
        )}

        {view === "confirm" && (
          <>
            <h2 className="login-modal-title">Verify Thy Identity</h2>
            <p className="login-modal-subtitle">
              Enter the sacred code sent to your email
            </p>

            <input
              type="text"
              placeholder="Confirmation Code"
              className="login-modal-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              autoFocus
            />

            {error && <p className="login-modal-error">{error}</p>}
            {message && <p className="login-modal-message">{message}</p>}

            <button
              className="login-modal-btn primary"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "..." : "Confirm"}
            </button>

            <p className="login-modal-switch">
              <span onClick={handleResend}>Resend Code</span>
              {" | "}
              <span onClick={() => { setView("login"); setError(""); setMessage(""); }}>
                Back to Login
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
