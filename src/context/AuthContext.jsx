import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    try {
      setUser((await api("/auth/me")).user);
      setError("");
    } catch (e) {
      setUser(null);
      if (e.status !== 401) setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    window.addEventListener("mt-access-change", refresh);
    return () => window.removeEventListener("mt-access-change", refresh);
  }, []);
  async function login(body) {
    const data = await api("/auth/login", { method: "POST", body });
    setUser(data.user);
  }
  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} });
    setUser(null);
  }
  return (
    <Context.Provider value={{ user, loading, error, login, logout, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
