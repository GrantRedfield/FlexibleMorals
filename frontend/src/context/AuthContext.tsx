import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  login as authLogin,
  logout as authLogout,
  getStoredUsername,
  getAuthProvider,
} from "../utils/auth";
import LoginModal from "../components/LoginModal";

interface AuthContextType {
  user: string | null;
  authProvider: "cognito" | "legacy" | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Open the login modal from any component */
  showLoginModal: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => getStoredUsername());
  const [authProv, setAuthProv] = useState<"cognito" | "legacy" | null>(
    () => getAuthProvider()
  );
  const [showLoginModal, setShowLoginModal] = useState(false);

  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authLogin(username, password);
    setUser(result.username);
    setAuthProv(result.authProvider);
  }, []);

  const logout = useCallback(() => {
    // Clear username from localStorage immediately so React effects that fire
    // from setUser(null) don't read a stale fm_username (authLogout is async
    // and clears tokens only after the server call completes).
    localStorage.removeItem("fm_username");
    authLogout();
    setUser(null);
    setAuthProv(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authProvider: authProv, login, logout, showLoginModal, openLoginModal, closeLoginModal }}>
      {children}
      {showLoginModal && <LoginModal onClose={closeLoginModal} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
