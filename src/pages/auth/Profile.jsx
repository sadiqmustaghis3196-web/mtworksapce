import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { PageHeader } from "../../components/common/UI";
export default function Profile() {
  const { user, refresh } = useAuth(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const result = await api("/auth/password", { method: "PATCH", body });
      setMessage(result.message);
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader eyebrow="ACCOUNT SETTINGS" title="My profile" />
      <div className="panel" style={{ maxWidth: 650 }}>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <p className="muted">
          {user.primaryRole || user.role} · {user.department}
        </p>
        <hr />
        <h3>Change password</h3>
        <p className="muted">Changing your password signs out all sessions.</p>
        <form onSubmit={save}>
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <p className="muted">
            Use 12+ characters with uppercase, lowercase and a number.
          </p>
          {message && <p role="status">{message}</p>}
          <button className="primary" disabled={busy}>
            Change password
          </button>
        </form>
      </div>
    </>
  );
}
