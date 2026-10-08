import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { get, post, refreshAccessToken, setAccessToken, setAuthLostHandler } from "../lib/api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // On first load, try to resume the session from the refresh cookie.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await refreshAccessToken();
        if (token) {
          const data = await get("/auth/me");
          if (alive) setUser(data.user);
        }
      } catch { /* not signed in */ }
      if (alive) setBooting(false);
    })();
    setAuthLostHandler(() => { setAccessToken(null); setUser(null); });
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await post("/auth/login", { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await post("/auth/logout"); } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, booting, login, logout }), [user, booting, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
