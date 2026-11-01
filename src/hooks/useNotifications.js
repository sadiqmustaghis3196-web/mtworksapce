import { useEffect, useState } from "react";
import { api } from "../services/api";
import { isPreview } from "../preview/config";
import { notificationOptions } from "../modules/notifications";
export default function useNotifications() {
  const [feed, setFeed] = useState({ items: [], unread: 0 }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isPreview) {
      setLoading(false);
      return;
    }
    let active = true,
      running = false,
      again = false;
    async function load() {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const query = new URLSearchParams(notificationOptions());
        const { data } = await api(`/notifications/feed?${query}`);
        if (active) {
          setFeed(data);
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        running = false;
        if (active) {
          setLoading(false);
          if (again) {
            again = false;
            queueMicrotask(load);
          }
        }
      }
    }
    const storage = (e) => {
      if (!e.key || e.key === "mt-nexus-ui-preview-v1") load();
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("mt-workspace-change", load);
    window.addEventListener("mt-notification-view-change", load);
    window.addEventListener("mt-refresh-notifications", load);
    window.addEventListener("focus", load);
    window.addEventListener("storage", storage);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("mt-workspace-change", load);
      window.removeEventListener("mt-notification-view-change", load);
      window.removeEventListener("mt-refresh-notifications", load);
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return {
    feed,
    error,
    loading,
    refresh: () => window.dispatchEvent(new Event("mt-refresh-notifications")),
  };
}
