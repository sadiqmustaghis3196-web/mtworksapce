import ModuleWorkspace from "./pages/modules/ModuleWorkspace";
import { modules } from "./modules/catalog";
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
              <Route
                path="projects/manage/*"
                element={<ModuleWorkspace module="projects" />}
              />
              {Object.keys(modules)
                .filter((key) => key !== "projects")
                .map((key) => (
                  <Route
                    key={key}
                    path={`${key}/*`}
                    element={<ModuleWorkspace module={key} />}
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
