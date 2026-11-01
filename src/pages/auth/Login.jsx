import { isPreview, previewCredentials } from "../../preview/config";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
export default function Login() {
  const { login } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [message, setMessage] = useState("");
  const forgot = location.pathname === "/forgot-password",
    reset = location.pathname === "/reset-password";
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (forgot) {
        const r = await api("/auth/forgot-password", {
          method: "POST",
          body: { email: fields.email },
        });
        setMessage(r.message);
      } else if (reset) {
        const r = await api("/auth/reset-password", {
          method: "POST",
          body: {
            ...fields,
            token: new URLSearchParams(location.search).get("token"),
          },
        });
        setMessage(r.message);
      } else {
        await login({ ...fields, rememberMe: fields.rememberMe === "on" });
        navigate("/projects");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <div className="wordmark">
          MT<span>NEXUS</span>
          <small>G L O B A L</small>
        </div>
        <p>
          One workspace.
          <br />
          <strong>Endless possibilities.</strong>
        </p>
        <span>PEOPLE · PROJECTS · PROGRESS</span>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <ShieldCheck size={30} className="cyan" />
        <p className="eyebrow">MT NEXUS GLOBAL</p>
        <h1>
          {forgot
            ? "Forgot password?"
            : reset
              ? "Set a new password"
              : "Welcome back"}
        </h1>
        <p className="muted">
          {forgot
            ? "Contact your administrator if you need help accessing your account."
            : reset
              ? "Choose a strong password for your account."
              : "Sign in to your company workspace."}
        </p>
        {isPreview && !forgot && !reset && (
          <div className="preview-login">
            <strong>UI Preview · Sample data only</strong>
            <p>
              Email: <code>{previewCredentials.email}</code>
            </p>
            <p>
              Password: <code>{previewCredentials.password}</code>
            </p>
            <small>No database required. Changes stay in this browser.</small>
          </div>
        )}
        {!reset && (
          <label>
            Company email
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              defaultValue={isPreview ? previewCredentials.email : undefined}
              required
            />
          </label>
        )}
        {!forgot && (
          <>
            <label>
              Password
              <div className="password">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={reset ? "new-password" : "current-password"}
                  defaultValue={
                    isPreview && !reset
                      ? previewCredentials.password
                      : undefined
                  }
                  minLength={reset ? 12 : 1}
                  required
                />
                <button
                  type="button"
                  className="icon"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {reset && (
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
            )}
          </>
        )}
        {!forgot && !reset && (
          <div className="form-row">
            <label className="check">
              <input type="checkbox" name="rememberMe" /> Remember me
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : forgot
              ? "Request reset"
              : reset
                ? "Update password"
                : "Sign in"}
          <ArrowRight size={17} />
        </button>
        {(forgot || reset) && <Link to="/login">Back to sign in</Link>}
        <footer>
          {isPreview
            ? "Design review · Public test login · Not real authentication"
            : "Secure access · Authorized team members only"}
        </footer>
      </form>
    </div>
  );
}
