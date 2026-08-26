"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AuthUser } from "./api";
import * as api from "./api";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "sadeed_auth";
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setUser(p.user ?? null);
        setToken(p.token ?? null);
      }
    } catch {
      /* تجاهل تخزيناً تالفاً */
    }
    setReady(true);
  }, []);

  const persist = useCallback((t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await api.login(username, password);
      persist(r.token, r.user);
    },
    [persist],
  );

  const signup = useCallback(
    async (username: string, name: string, password: string) => {
      const r = await api.signup(username, name, password);
      persist(r.token, r.user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    if (token) api.logout(token);
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  return (
    <Ctx.Provider value={{ user, token, ready, login, signup, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth خارج AuthProvider");
  return c;
}
