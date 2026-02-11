import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const { login, quickLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim()) return setError("Username required");
    setError("");

    try {
      if (password) {
        await login(username.trim(), password);
      } else {
        quickLogin(username.trim());
      }
      onLogin();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Invalid username or password");
    }
  };

  return (
    <div className="flex flex-col items-center p-6">
      <h2 className="text-xl font-semibold mb-4">Login</h2>
      <input
        type="text"
        placeholder="Username"
        className="border p-2 mb-2 rounded"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password (optional)"
        className="border p-2 mb-2 rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
      />
      <button
        onClick={handleLogin}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {password ? "Sign In" : "Quick Login"}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
