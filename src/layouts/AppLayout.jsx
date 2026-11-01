import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
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
  const [open, setOpen] = useState(false),
    [light, setLight] = useState(false),
    [search, setSearch] = useState(""),
    [profile, setProfile] = useState(false);
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
        <div className="sidebar-footer">
          <strong>MT Nexus Global</strong>
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
              aria-label="Search authorized tasks"
              placeholder="Search cards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <span className="workspace-label">TEAM WORKSPACE</span>
            <button
              className="icon"
              onClick={() => setLight(!light)}
              aria-label="Toggle color theme"
            >
              {light ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <Link
              className="icon notification"
              to="/notifications"
              aria-label="Notifications"
            >
              <Bell size={19} />
            </Link>
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
        <main>
          <Outlet context={{ search }} />
        </main>
      </div>
    </div>
  );
}
