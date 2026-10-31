import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import SetupWizard from './components/SetupWizard';
import { isSupabaseConfigured } from './lib/supabase';

// Lazy-loaded pages to eliminate upfront bundle load and make navigation immediate
const Dashboard = lazy(() => import('./components/Dashboard'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ContactPage = lazy(() => import('./components/ContactPage'));
const FuelOptimization = lazy(() => import('./components/FuelOptimization'));
const SafetyCompliance = lazy(() => import('./components/SafetyCompliance'));
const DriverOnboardingManagement = lazy(() => import('./components/DriverOnboardingManagement'));
const DriverSelfOnboarding = lazy(() => import('./components/DriverSelfOnboarding'));
const DriverTraining = lazy(() => import('./components/DriverTraining'));
const IntegrationDashboard = lazy(() => import('./components/IntegrationDashboard'));
const LiveTracking = lazy(() => import('./components/LiveTracking'));
const DriverTracking = lazy(() => import('./components/DriverTracking'));
const RouteOptimization = lazy(() => import('./components/RouteOptimization'));
const IntegrationsPage = lazy(() => import('./components/IntegrationsPage'));
const CompanyVerificationPage = lazy(() => import('./components/CompanyVerificationPage'));
const DriverInvitationManagement = lazy(() => import('./components/DriverInvitationManagement'));
const AcceptInvitation = lazy(() => import('./components/AcceptInvitation'));
const VehiclesManagement = lazy(() => import('./components/VehiclesManagement'));
const DriversManagement = lazy(() => import('./components/DriversManagement'));
const VehicleHealthAI = lazy(() => import('./components/VehicleHealthAI'));
const DriverBehaviorAI = lazy(() => import('./components/DriverBehaviorAI'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const DriverDashboard = lazy(() => import('./components/DriverDashboard'));
const PricingPage = lazy(() => import('./components/PricingPage'));
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'));
const SuperAdminPanel = lazy(() => import('./components/SuperAdminPanel'));
const AdminUsersManagement = lazy(() => import('./components/AdminUsersManagement'));
const UserProfilePage = lazy(() => import('./components/UserProfilePage'));
const OperationsMonitoringDashboard = lazy(() => import('./components/OperationsMonitoringDashboard'));
const CustomerSuccessDashboard = lazy(() => import('./components/CustomerSuccessDashboard'));
const FleetManagerDashboard = lazy(() => import('./components/FleetManagerDashboard'));
const FleetOperations = lazy(() => import('./components/FleetOperations'));
const FeedbackPage = lazy(() => import('./components/FeedbackPage'));
const FeedbackManagementDashboard = lazy(() => import('./components/FeedbackManagementDashboard'));
const ProductionMonitoringDashboard = lazy(() => import('./components/ProductionMonitoringDashboard'));
const DiagnosticsPage = lazy(() => import('./components/DiagnosticsPage'));

const AppContent: React.FC = () => {
  const { isAdmin, isSuperAdmin, isDriver, user, profile, loading } = useAuth();
  
  // Read initial tab from URL param or default
  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'accept-invitation' || window.location.pathname.includes('/accept-invitation')) {
      return 'accept-invitation';
    }
    if (tabParam) {
      return tabParam;
    }
    return user ? 'dashboard' : 'landing';
  });

  // Keep URL query param ?tab= in sync without reloading page for browser history and direct refresh
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const currentParams = new URLSearchParams(window.location.search);
    if (tab === 'landing') {
      currentParams.delete('tab');
    } else {
      currentParams.set('tab', tab);
    }
    const newSearch = currentParams.toString();
    const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
    window.history.pushState({ tab }, '', newUrl);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        setActiveTab(user ? 'dashboard' : 'landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  const urlToken = new URLSearchParams(window.location.search).get('token') || '';

  const integrationConfig = {
    apiKey: 'demo-api-key-12345',
    companyId: 'demo-trucking-company',
    environment: 'sandbox' as const,
    webhookUrl: 'https://your-company.com/webhooks/transpopilot',
  };

  // Automatic Redirect Logic
  useEffect(() => {
    if (user && profile) {
      if (['landing', 'login', 'signup'].includes(activeTab)) {
        if (isAdmin() || isSuperAdmin()) {
          handleTabChange('admin-dashboard');
        } else {
          handleTabChange('dashboard');
        }
      }
    } else if (!user && !loading) {
      if (!['landing', 'login', 'signup', 'about', 'contact', 'pricing', 'accept-invitation'].includes(activeTab)) {
        handleTabChange('landing');
      }
    }
  }, [user, profile, activeTab, isAdmin, isSuperAdmin, loading]);

  // Public pages jahan Sidebar nahi dikhani
  const publicPages = ['landing', 'login', 'signup', 'my-onboarding', 'accept-invitation'];
  const isPublicPage = publicPages.includes(activeTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'landing':
        return <LandingPage onNavigate={handleTabChange} />;
      case 'login':
        return <Login onNavigate={handleTabChange} />;
      case 'signup':
        return <Signup onNavigate={handleTabChange} />;
      case 'accept-invitation':
        return <AcceptInvitation token={urlToken} onNavigate={handleTabChange} />;
      case 'pricing':
        return <PricingPage onNavigate={handleTabChange} />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      
      // Protected Routes
      case 'dashboard':
        if (isDriver()) return <DriverDashboard onNavigate={handleTabChange} />;
        return <Dashboard onNavigate={handleTabChange} />;
      case 'vehicles':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <VehiclesManagement />;
      case 'vehicle-health-ai':
        return <VehicleHealthAI />;
      case 'drivers-management':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <DriversManagement />;
      case 'live-tracking':
        return <LiveTracking />;
      case 'driver-tracking':
        return <DriverTracking />;
      case 'driver-behavior-ai':
        return <DriverBehaviorAI />;
      case 'route-optimization':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <RouteOptimization />;
      case 'fuel':
        return <FuelOptimization />;
      case 'safety':
        return <SafetyCompliance />;
      case 'drivers':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <DriverOnboardingManagement />;
      case 'my-onboarding':
        return <DriverSelfOnboarding onNavigate={handleTabChange} />;
      case 'my-training':
        return <DriverTraining />;
      case 'integration':
        return <IntegrationDashboard config={integrationConfig} />;
      case 'integrations':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <IntegrationsPage />;
      case 'company-verification':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <CompanyVerificationPage />;
      case 'driver-invitations':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <DriverInvitationManagement />;
      case 'profile':
        return <UserProfilePage />;
      
      // Admin Routes
      case 'admin-users':
        if (!user || !isAdmin()) return <AccessDenied onNavigate={handleTabChange} />;
        return <AdminUsersManagement />;
      case 'admin-dashboard':
        if (!user || !isAdmin()) return <AccessDenied onNavigate={handleTabChange} />;
        return <AdminDashboardPage />;
      case 'super-admin-panel':
        if (!user || (!isSuperAdmin() && sessionStorage.getItem('super_admin_authenticated') !== 'true')) {
           return <AccessDenied onNavigate={handleTabChange} isSuperAdmin />;
        }
        return <SuperAdminPanel />;
      case 'operations-monitoring':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <OperationsMonitoringDashboard />;
      case 'customer-success':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <CustomerSuccessDashboard />;
      case 'fleet-operations':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <FleetOperations onNavigate={handleTabChange} />;
      case 'fleet-manager-dashboard':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <FleetManagerDashboard onNavigate={handleTabChange} />;
      case 'feedback':
        if (isDriver()) return <AccessDenied onNavigate={handleTabChange} />;
        return <FeedbackPage />;
      case 'feedback-management':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <FeedbackManagementDashboard />;
      case 'production-monitoring':
        if (!user || !isSuperAdmin()) return <AccessDenied onNavigate={handleTabChange} isSuperAdmin />;
        return <ProductionMonitoringDashboard />;
      case 'diagnostics':
        if (!user || (!isAdmin() && !isSuperAdmin())) return <AccessDenied onNavigate={handleTabChange} />;
        return <DiagnosticsPage />;
      case 'settings':
        return <div className="p-6"><h1 className="text-2xl font-bold">Settings</h1><p className="text-gray-600 mt-2">Settings page coming soon...</p></div>;
      default:
        return <LandingPage onNavigate={handleTabChange} />;
    }
  };

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-white">
        <Suspense fallback={<PageSkeleton />}>
          {renderContent()}
        </Suspense>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      <div className="h-full">
        <Suspense fallback={<PageSkeleton />}>
          {renderContent()}
        </Suspense>
      </div>
    </Layout>
  );
};

const AccessDenied = ({ onNavigate, isSuperAdmin }: { onNavigate: (tab: string) => void, isSuperAdmin?: boolean }) => (
  <div className="p-6">
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-red-900 mb-2">Access Denied</h2>
      <p className="text-red-700">You need {isSuperAdmin ? 'super admin' : 'admin'} permissions to access this page.</p>
      <button
        onClick={() => onNavigate('dashboard')}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Go to Dashboard
      </button>
    </div>
  </div>
);

function App() {
  if (!isSupabaseConfigured) {
    return <SetupWizard />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;