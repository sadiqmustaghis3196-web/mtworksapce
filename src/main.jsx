import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/auth/Login";
import Profile from "./pages/auth/Profile";
import Projects from "./pages/projects/Projects";
import Dashboard from "./pages/dashboard/Dashboard";
import { State, PageHeader } from "./components/common/UI";
import "./styles/app.css";
function Protected() {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <State loading />;
  if (error)
    return (
      <div className="auth-screen">
        <div>
          <State error={error} />
          <button className="secondary" onClick={refresh}>
            Retry connection
          </button>
        </div>
      </div>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function PendingModule() {
  return (
    <>
      <PageHeader
        eyebrow="IMPLEMENTATION IN PROGRESS"
        title="Module not available yet"
      />
      <section className="panel">
        <p>
          This module has not completed its API, authorization and database
          integration checks.
        </p>
        <p className="muted">
          No sample records or simulated save actions are shown.
        </p>
        <Link className="secondary" to="/projects">
          Back to project boards
        </Link>
      </section>
    </>
  );
}
function NotFound() {
  return (
    <div className="panel">
      <h1>Page not found</h1>
      <p>Return to your workspace to continue.</p>
      <Link to="/dashboard">Back to dashboard</Link>
    </div>
  );
}
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<Login />} />
          <Route path="/reset-password" element={<Login />} />
          <Route element={<Protected />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/projects" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId/:view" element={<Projects />} />
              <Route path="profile" element={<Profile />} />
              {[
                "clients",
                "hiring",
                "employees",
                "attendance",
                "internships",
                "finance",
                "creative",
                "crm",
                "support",
                "departments",
                "admin/users",
                "notifications",
              ].map((path) => (
                <Route
                  key={path}
                  path={`${path}/*`}
                  element={<PendingModule />}
                />
              ))}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
