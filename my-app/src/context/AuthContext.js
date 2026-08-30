// Website account session state, same shape as LanguageContext/LocationContext:
// a single source of truth backed by the httpOnly session cookie (see
// web/auth.py) rather than localStorage — the server is authoritative here.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe, logoutAccount } from "../lib/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.ok ? data.user : null);
      setNotifications(data.ok ? data.notifications : null);
    } catch {
      setUser(null);
      setNotifications(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    try { await logoutAccount(); } catch { /* cookie may already be gone */ }
    setUser(null);
    setNotifications(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, notifications, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext) || { user: null, notifications: null, loading: true, refresh: () => {}, logout: () => {} };
}
