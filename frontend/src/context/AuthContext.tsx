import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  login as authLogin,
  logout as authLogout,
  getStoredUsername,
  getAuthProvider,
} from "../utils/auth";

interface AuthContextType {
  user: string | null;
  authProvider: "cognito" | "legacy" | null;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => void;
  /** Legacy quick-login (username only, no password) */
  quickLogin: (username: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => getStoredUsername());
  const [authProv, setAuthProv] = useState<"cognito" | "legacy" | null>(
    () => getAuthProvider()
  );

  const login = useCallback(async (username: string, password?: string) => {
    const result = await authLogin(username, password);
    setUser(result.username);
    setAuthProv(result.authProvider);
  }, []);

  const quickLogin = useCallback((username: string) => {
    // Legacy path — just set username in localStorage (no server call)
    setUser(username);
    localStorage.setItem("fm_username", username);
    localStorage.setItem("fm_authProvider", "legacy");
    setAuthProv("legacy");
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    setAuthProv(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authProvider: authProv, login, logout, quickLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
