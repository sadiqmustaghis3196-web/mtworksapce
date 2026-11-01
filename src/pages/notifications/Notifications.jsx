import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Bell, CheckCheck, RefreshCw, ArrowUpRight } from "lucide-react";
import useNotifications from "../../hooks/useNotifications";
import {
  notificationOptions,
  notificationTarget,
} from "../../modules/notifications";
import { api } from "../../services/api";
import { PageHeader, State } from "../../components/common/UI";
import "../../styles/notifications.css";
export default function Notifications({ compact = false, onClose }) {
  const { feed, error, loading, refresh } = useNotifications(),
    outlet = useOutletContext(),
    navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState("");
  const search = compact ? localSearch : outlet?.search || "";
  const [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const items = feed.items.filter(
    (n) =>
      (filter === "all" || n.status.toLowerCase() === filter) &&
      `${n.title} ${n.message}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function mark(n, action) {
    setBusy(true);
    setFailure("");
    try {
      await api(`/workspace/notifications/${n.id}/actions/${action}`, {
        method: "POST",
        body: {},
      });
      refresh();
      return true;
    } catch (e) {
      setFailure(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function open(n) {
    if (n.status !== "Unread" || (await mark(n, "read"))) {
      onClose?.();
      navigate(notificationTarget(n));
    }
  }
  async function all() {
    setBusy(true);
    setFailure("");
    try {
      await api("/notifications/read-all", {
        method: "POST",
        body: notificationOptions(),
      });
      refresh();
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notification-center">
      {compact ? (
        <header className="notification-popover-heading">
          <div>
            <h2 id="notification-popover-title">Notifications</h2>
            <span>{feed.unread} unread</span>
          </div>
          <button
            type="button"
            className="icon"
            aria-label="Close notifications"
            onClick={onClose}
          >
            ×
          </button>
        </header>
      ) : (
        <PageHeader eyebrow="WORKSPACE INBOX" title="Notifications">
          <div className="notification-center-actions">
            <button className="secondary" onClick={refresh}>
              <RefreshCw size={15} /> Refresh notifications
            </button>
            <button
              className="primary"
              disabled={busy || !feed.unread}
              onClick={all}
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          </div>
        </PageHeader>
      )}
      {compact && (
        <div className="notification-popover-tools">
          <input
            aria-label="Search notifications"
            placeholder="Search notifications…"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <button
            type="button"
            className="notification-mark-all"
            disabled={busy || !feed.unread}
            onClick={all}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
          <button
            type="button"
            className="icon"
            aria-label="Refresh notifications"
            onClick={refresh}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      )}
      {!compact && (
        <p className="notification-center-context">
          {feed.profile?.fullName || "Workspace"} · {feed.unread} unread ·
          In-app alerts update across the workspace while it is open.
        </p>
      )}
      <div className="notification-center-filters">
        {["all", "unread", "read"].map((value) => (
          <button
            key={value}
            aria-pressed={filter === value}
            className={filter === value ? "selected" : ""}
            onClick={() => setFilter(value)}
          >
            {value === "all"
              ? "All notifications"
              : value === "unread"
                ? "Unread"
                : "Read"}
          </button>
        ))}
      </div>
      {(error || failure) && <State error={failure || error} />}{" "}
      {loading ? (
        <State loading />
      ) : !items.length ? (
        <div className="notification-empty">
          <Bell size={28} />
          <h2>
            {filter === "unread"
              ? "You’re all caught up"
              : "No matching notifications"}
          </h2>
          <p>
            New assignments, workflow changes and deadline alerts appear here.
          </p>
        </div>
      ) : (
        <div className="notification-inbox">
          {items.map((n) => (
            <article
              key={n.id}
              className={`notification-row ${n.status === "Unread" ? "is-unread" : ""}`}
            >
              <span className="notification-indicator">
                <Bell size={18} />
              </span>
              <div>
                <h2>{n.title}</h2>
                <p>{n.message}</p>
                <small>
                  {new Date(n.createdAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Karachi",
                  })}{" "}
                  PKT · {n.status}
                </small>
                <div className="notification-row-actions">
                  <button disabled={busy} onClick={() => open(n)}>
                    Open related work <ArrowUpRight size={13} />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      mark(n, n.status === "Unread" ? "read" : "unread")
                    }
                  >
                    {n.status === "Unread" ? "Mark read" : "Mark unread"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!compact && (
        <p className="notification-center-context">
          Notification data is stored in this browser. Email and device push are
          not connected.
        </p>
      )}
    </div>
  );
}
