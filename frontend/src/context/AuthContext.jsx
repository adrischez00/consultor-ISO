import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchMe, loginRequest, registerRequest } from "../api/authApi";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "../api/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadAuthSession);
  const [bootstrapping, setBootstrapping] = useState(true);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  const persistSession = useCallback((nextSession, options = {}) => {
    saveAuthSession(nextSession, options);
    setSession(nextSession);
  }, []);

  const login = useCallback(
    async (payload, options = {}) => {
      const result = await loginRequest(payload);
      persistSession(result, options);
      return result;
    },
    [persistSession]
  );

  const register = useCallback(
    async (payload) => {
      const result = await registerRequest(payload);
      persistSession(result);
      return result;
    },
    [persistSession]
  );

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const { session: storedSession, persistent } = loadAuthSession({ withMeta: true });
      if (!storedSession) {
        if (active) {
          setSession(null);
          setBootstrapping(false);
        }
        return;
      }

      try {
        const me = await fetchMe();
        if (!active) return;

        const mergedSession = {
          ...storedSession,
          user: me.user,
          consultancy: me.consultancy,
        };
        persistSession(mergedSession, { persistent });
      } catch {
        if (!active) return;
        logout();
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    bootstrapSession();
    return () => {
      active = false;
    };
  }, [logout, persistSession]);

  const value = useMemo(
    () => ({
      accessToken: session?.access_token ?? null,
      user: session?.user ?? null,
      consultancy: session?.consultancy ?? null,
      isAuthenticated: Boolean(session?.access_token),
      loading: bootstrapping,
      login,
      register,
      logout,
    }),
    [session, bootstrapping, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
