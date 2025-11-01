import { useState } from "react";

export default function LoginButton() {
  const [user, setUser] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      // Try to log in (you can later replace this with real OAuth)
      const res = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      setUser(data.username || "User");
    } catch (err) {
      console.error("Login error:", err);
      alert("You must be logged in to perform this action.");
    }
  };

  const handleLogout = async () => {
    await fetch("http://localhost:3001/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <div>
      {user ? (
        <button onClick={handleLogout} className="home-button">
          Logout ({user})
        </button>
      ) : (
        <button onClick={handleLogin} className="home-button">
          Login
        </button>
      )}
    </div>
  );
}