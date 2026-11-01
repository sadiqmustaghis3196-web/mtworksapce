import Notifications from "../pages/notifications/Notifications";
import useNotifications from "../hooks/useNotifications";
import { isPreview } from "../preview/config";
import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { Modal } from "../components/common/UI";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PanelsTopLeft,
  Users,
  CalendarClock,
  GraduationCap,
  Wallet,
  Palette,
  Handshake,
  Headphones,
  Building2,
  Shield,
  Search,
  Menu,
  X,
  Moon,
  Sun,
  Bell,
  ChevronDown,
  LogOut,
  BriefcaseBusiness,
  Check,
  Clock3,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
const navigation = [
  ["Dashboard", "/dashboard", LayoutDashboard, "dash"],
  ["Project Boards", "/projects", PanelsTopLeft, "boards"],
  ["Client Operations", "/clients", BriefcaseBusiness, "clientops"],
  ["Hiring & ATS", "/hiring", Users, "hiring"],
  ["Employees", "/employees", Users, "people"],
  ["Attendance", "/attendance", CalendarClock, "attendance"],
  ["Internship Program", "/internships", GraduationCap, "interns"],
  ["Finance & Payroll", "/finance", Wallet, "finance"],
  ["Creative Studio", "/creative", Palette, "creative"],
  ["Sales & Clients", "/crm", Handshake, "sales"],
  ["Support Tickets", "/support", Headphones, "support"],
  ["Departments", "/departments", Building2, "depts"],
  ["Roles & Permissions", "/admin/users", Shield, "access"],
];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { feed: notificationFeed, loading: notificationLoading } =
    useNotifications();
  const [latestNotification, setLatestNotification] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bellRef = useRef(null),
    notificationPanelRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ top: 62, right: 12 });
  function closeNotifications() {
    setNotificationsOpen(false);
    bellRef.current?.focus();
  }
  useEffect(() => {
    const show = () => {
      setNotificationsOpen(true);
      setProfile(false);
      setLatestNotification(null);
    };
    window.addEventListener("mt-open-notifications", show);
    return () => window.removeEventListener("mt-open-notifications", show);
  }, []);
  useEffect(() => {
    if (!notificationsOpen) return;
    setLatestNotification(null);
    const position = () => {
      const r = bellRef.current?.getBoundingClientRect();
      if (r)
        setPanelPosition({
          top: Math.max(8, r.bottom + 12),
          right: Math.max(12, window.innerWidth - r.right),
        });
    };
    position();
    notificationPanelRef.current?.focus();
    const outside = (e) => {
      if (
        !notificationPanelRef.current?.contains(e.target) &&
        !bellRef.current?.contains(e.target)
      )
        setNotificationsOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeNotifications();
      }
    };
    const focus = (e) => {
      if (
        !notificationPanelRef.current?.contains(e.target) &&
        !bellRef.current?.contains(e.target)
      )
        setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
      window.removeEventListener("resize", position);
    };
  }, [notificationsOpen]);
  const seenNotifications = useRef(null);
  useEffect(() => {
    if (notificationLoading) return;
    const context = `${notificationFeed.role}:${notificationFeed.profile?.id}`;
    const ids = new Set(notificationFeed.items.map((n) => n.id));
    if (seenNotifications.current?.context === context) {
      const fresh = notificationFeed.items.find(
        (n) =>
          n.status === "Unread" && !seenNotifications.current.ids.has(n.id),
      );
      if (
        fresh &&
        !notificationsOpen &&
        !window.location.pathname.startsWith("/notifications")
      )
        setLatestNotification(fresh);
    } else setLatestNotification(null);
    seenNotifications.current = { context, ids };
  }, [notificationFeed, notificationLoading, notificationsOpen]);
  useEffect(() => {
    if (!latestNotification) return;
    const timer = setTimeout(() => setLatestNotification(null), 10000);
    return () => clearTimeout(timer);
  }, [latestNotification]);
  const [open, setOpen] = useState(false),
    [light, setLight] = useState(() => {
      try {
        return localStorage.getItem("mt-nexus-theme") === "light";
      } catch {
        return false;
      }
    }),
    [search, setSearch] = useState(""),
    [profile, setProfile] = useState(false);
  const searchRef = useRef(null),
    location = useLocation();
  useEffect(() => {
    setNotificationsOpen(false);
    if (location.pathname.startsWith("/notifications"))
      setLatestNotification(null);
  }, [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem("mt-nexus-theme", light ? "light" : "dark");
    } catch {}
  }, [light]);
  useEffect(() => {
    setSearch("");
    setProfile(false);
  }, [location.pathname.split("/")[1]]);
  useEffect(() => {
    const keydown = (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, []);
  const [workspace, setWorkspace] = useState({
      company: "MT Nexus Global",
      unread: 0,
      checkedIn: false,
    }),
    [resetConfirm, setResetConfirm] = useState(false);
  useEffect(() => {
    if (!isPreview) return;
    let active = true;
    async function refresh() {
      try {
        const { data } = await api("/workspace/data");
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Karachi",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        if (active)
          setWorkspace({
            company:
              data.records.settings.find((s) => s.name === "Company name")
                ?.value || "MT Nexus Global",
            unread: data.records.notifications.filter(
              (n) => n.status === "Unread",
            ).length,
            checkedIn: data.records.attendance.some(
              (a) =>
                a.employeeId === "preview-hamza" &&
                a.date === today &&
                !a.checkOut,
            ),
          });
      } catch {}
    }
    refresh();
    window.addEventListener("mt-workspace-change", refresh);
    return () => {
      active = false;
      window.removeEventListener("mt-workspace-change", refresh);
    };
  }, []);
  const modules = user.effectivePermissions?.allowedModules || [];
  return (
    <div className={`app ${light ? "light" : ""}`}>
      <button
        className={`sidebar-overlay ${open ? "visible" : ""}`}
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/dashboard" className="brand" onClick={() => setOpen(false)}>
          <div className="brand-monogram">MT</div>
          <strong>NEXUS</strong>
          <small>G L O B A L</small>
        </Link>
        <div className="persona">
          <span>
            ACTIVE PERSONA / ROLE <Shield size={12} />
          </span>
          <div>
            {user.primaryRole || user.role}
            <Shield size={14} />
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation
            .filter((n) => user.isSuperAdmin || modules.includes(n[3]))
            .map(([label, path, Icon]) => (
              <NavLink key={path} to={path} onClick={() => setOpen(false)}>
                <Icon size={18} />
                {label}
                {path === "/projects" && <ChevronDown size={14} />}
              </NavLink>
            ))}
        </nav>
        <Link
          to="/projects/manage"
          className="project-management-link"
          onClick={() => setOpen(false)}
        >
          Manage projects & teams →
        </Link>
        <div className="sidebar-footer">
          <strong>{isPreview ? workspace.company : "MT Nexus Global"}</strong>
          <p>Remote + On-site team ek jagah.</p>
          <small>Connected by Nexus.</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="search">
            <Search size={17} />
            <input
              ref={searchRef}
              aria-label="Search current view"
              aria-keyshortcuts="Control+K Meta+K"
              placeholder="Search this view…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                className="clear-view-search"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
              >
                <X size={13} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </div>
          <div className="top-actions">
            {isPreview ? (
              <Link
                to="/attendance"
                className={`attendance-pill ${workspace.checkedIn ? "checked-in" : ""}`}
              >
                <Clock3 size={13} />
                {workspace.checkedIn ? "Checked in" : "Check in"}
              </Link>
            ) : (
              <span className="workspace-label">TEAM WORKSPACE</span>
            )}
            <button
              className="icon"
              onClick={() => setLight(!light)}
              aria-label="Toggle color theme"
            >
              {light ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button
              ref={bellRef}
              type="button"
              className="icon notification"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              aria-controls="notification-popover"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setProfile(false);
                setLatestNotification(null);
              }}
            >
              <Bell size={19} />
              {isPreview && notificationFeed.unread > 0 && (
                <span className="notification-count">
                  {notificationFeed.unread > 99
                    ? "99+"
                    : notificationFeed.unread}
                </span>
              )}
            </button>
            <span className="premium">★ PREMIUM</span>
            <div className="profile-wrap">
              <button
                className="profile"
                onClick={() => setProfile(!profile)}
                aria-expanded={profile}
              >
                {user.name || user.email}
                <ChevronDown size={13} />
                <span className="avatar">
                  {user.avatar || user.email[0].toUpperCase()}
                </span>
              </button>
              {profile && (
                <div className="dropdown">
                  <Link to="/profile" onClick={() => setProfile(false)}>
                    My profile
                  </Link>
                  <Link to="/dashboard" onClick={() => setProfile(false)}>
                    Back to dashboard
                  </Link>
                  <button
                    onClick={() =>
                      logout().catch((e) => window.alert(e.message))
                    }
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {isPreview && (
          <div className="preview-banner">
            <span>
              <strong>UI PREVIEW</strong> Sample data · saved only in this
              browser
            </span>
            <button onClick={() => setResetConfirm(true)}>
              Reset sample data
            </button>
          </div>
        )}
        {resetConfirm && (
          <Modal
            title="Reset this browser workspace?"
            onClose={() => setResetConfirm(false)}
          >
            <p>
              This removes locally added records, edits, attachments and
              activity. Download a workspace backup from Settings first if you
              want to keep your work.
            </p>
            <div className="form-buttons">
              <button
                className="secondary"
                onClick={() => setResetConfirm(false)}
              >
                Keep my work
              </button>
              <button
                className="primary"
                onClick={async () => {
                  const { resetPreview } = await import("../preview/api");
                  resetPreview();
                  window.location.reload();
                }}
              >
                Reset sample data
              </button>
            </div>
          </Modal>
        )}
        {latestNotification && (
          <section
            className="live-notification-toast"
            aria-label="New notification"
            aria-live="polite"
          >
            <Bell size={18} />
            <div>
              <strong>{latestNotification.title}</strong>
              <p>{latestNotification.message}</p>
              <button
                className="notification-toast-open"
                onClick={() =>
                  window.dispatchEvent(new Event("mt-open-notifications"))
                }
              >
                View notifications →
              </button>
            </div>
            <button
              className="icon"
              aria-label="Dismiss notification"
              onClick={() => setLatestNotification(null)}
            >
              <X size={15} />
            </button>
          </section>
        )}
        {notificationsOpen && (
          <section
            ref={notificationPanelRef}
            id="notification-popover"
            role="dialog"
            aria-modal="false"
            aria-labelledby="notification-popover-title"
            tabIndex={-1}
            className="notification-popover"
            style={{
              top: panelPosition.top,
              right: panelPosition.right,
              "--notification-top": `${panelPosition.top}px`,
            }}
          >
            <Notifications compact onClose={closeNotifications} />
          </section>
        )}
        <main>
          <Outlet context={{ search }} />
        </main>
      </div>
    </div>
  );
}
