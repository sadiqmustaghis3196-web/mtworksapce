import React, { useState } from 'react';
import {
  Truck,
  BarChart3,
  Fuel,
  Shield,
  Users,
  Menu,
  X,
  Bell,
  Brain,
  Plug,
  MapPin,
  Navigation,
  Route as RouteIcon,
  DollarSign,
  LogIn,
  UserPlus,
  ShieldCheck,
  Building2,
  Activity,
  MessageSquare,
  Lock,
  Sparkles,
  
  Settings,
  Award
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import UserDropdown from './UserDropdown';
import DemoModeBanner from './DemoModeBanner';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}
const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { user, profile, isAdmin, isSuperAdmin, isFleetManager, isDispatcher, isDriver, isGuestMode } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');
  const isMobile = useIsMobile();

  const hasPremiumAccess = isSuperAdmin() || isAdmin() || isFleetManager() || isDispatcher() || profile?.role === 'admin' || profile?.role === 'super_admin';

  const navigation = [
    { id: 'pricing', name: 'Pricing', icon: DollarSign, section: 'main', requiresAuth: false, isFree: true, mobileVisible: true },
    { id: 'contact', name: 'Contact', icon: MessageSquare, section: 'main', requiresAuth: false, isFree: true, mobileVisible: true },
    { id: 'login', name: 'Sign In', icon: LogIn, section: 'auth', requiresAuth: false, hideWhenAuth: true, isFree: true, mobileVisible: true },
    { id: 'signup', name: 'Sign Up', icon: UserPlus, section: 'auth', requiresAuth: false, hideWhenAuth: true, isFree: true, mobileVisible: true },
    { id: 'diagnostics', name: 'System Diagnostics', icon: Settings, section: 'admin', requiresAuth: true, adminOnly: true, isFree: true, mobileVisible: false },
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3, section: 'operations', requiresAuth: true, isFree: true, mobileVisible: true },
    { id: 'my-onboarding', name: 'My Onboarding', icon: Activity, section: 'operations', requiresAuth: true, driverOnly: true, isFree: true, mobileVisible: true },
    { id: 'my-training', name: 'Safety Training', icon: Award, section: 'operations', requiresAuth: true, driverOnly: true, isFree: true, mobileVisible: true },
    { id: 'live-tracking', name: 'Live Tracking', icon: MapPin, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: true, mobileVisible: true },
    { id: 'route-optimization', name: 'Route Optimization', icon: RouteIcon, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: true, mobileVisible: true },
    { id: 'driver-behavior-ai', name: 'Driver Behavior', icon: Brain, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: true, mobileVisible: true },
    { id: 'vehicles', name: 'Vehicles', icon: Truck, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: true, mobileVisible: true },
    { id: 'vehicle-health-ai', name: 'Vehicle Health', icon: Brain, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'drivers-management', name: 'Drivers', icon: Users, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'driver-tracking', name: 'Driver Tracking', icon: Navigation, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'fuel', name: 'Fuel Optimization', icon: Fuel, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'safety', name: 'Safety & Compliance', icon: Shield, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'drivers', name: 'Driver Onboarding', icon: Users, section: 'operations', requiresAuth: true, fleetManagerOnly: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'integrations', name: 'Fleet Integrations', icon: Plug, section: 'operations', requiresAuth: true, adminOnly: true, hideFromDriver: true, isFree: false, mobileVisible: true },
    { id: 'company-verification', name: 'Company Verification', icon: Building2, section: 'admin', requiresAuth: true, adminOnly: true, hideFromDriver: true, isFree: false, mobileVisible: false },
    { id: 'driver-invitations', name: 'Driver Invitations', icon: Users, section: 'admin', requiresAuth: true, adminOnly: true, hideFromDriver: true, isFree: true, mobileVisible: false },
    { id: 'admin-users', name: 'User Management', icon: Users, section: 'admin', requiresAuth: true, adminOnly: true, hideFromDriver: true, isFree: true, mobileVisible: false },
    { id: 'fleet-manager-dashboard', name: 'Fleet Manager Dashboard', icon: BarChart3, section: 'admin', requiresAuth: true, fleetManagerOnly: true, isFree: true, mobileVisible: false },
    { id: 'fleet-operations', name: 'Fleet Operations', icon: Activity, section: 'operations', requiresAuth: true, hideFromDriver: true, isFree: true, mobileVisible: true },
    { id: 'admin-dashboard', name: 'Admin Dashboard', icon: ShieldCheck, section: 'admin', requiresAuth: true, adminOnly: true, isFree: true, mobileVisible: false },
    { id: 'super-admin-panel', name: 'Super Admin Panel', icon: ShieldCheck, section: 'admin', requiresAuth: true, superAdminOnly: true, isFree: true, mobileVisible: false },
    { id: 'operations-monitoring', name: 'Operations Monitoring', icon: Activity, section: 'admin', requiresAuth: true, adminOnly: true, isFree: true, mobileVisible: false },
    { id: 'feedback-management', name: 'Feedback Management', icon: MessageSquare, section: 'admin', requiresAuth: true, adminOnly: true, isFree: true, mobileVisible: false },
    { id: 'customer-success', name: 'Customer Success', icon: Building2, section: 'system', requiresAuth: true, adminOnly: true, hideFromDriver: true, isFree: true, mobileVisible: false },
  ];

  const sections = [
    { id: 'main', title: 'Main' },
    { id: 'auth', title: 'Authentication' },
    { id: 'operations', title: 'Fleet Operations' },
    { id: 'admin', title: 'Admin & Management' },
    { id: 'system', title: 'System' },
  ];

  const filteredNavigation = navigation.filter(item => {
    if (isGuestMode && !user) {
      if (item.hideWhenAuth) return true;
      if (item.requiresAuth) return false;
      if (isMobile && item.mobileVisible === false) return false;
      return true;
    }
    if (item.hideWhenAuth && user) return false;
    if (item.requiresAuth && !user) return false;

    const itemSuperAdminOnly = (item as {superAdminOnly?: boolean}).superAdminOnly;
    const itemAdminOnly = (item as {adminOnly?: boolean}).adminOnly;
    const itemFleetManagerOnly = (item as {fleetManagerOnly?: boolean}).fleetManagerOnly;
    const itemDriverOnly = (item as {driverOnly?: boolean}).driverOnly;
    const itemHideFromDriver = (item as {hideFromDriver?: boolean}).hideFromDriver;

    if (itemSuperAdminOnly && !isSuperAdmin()) return false;
    if (itemAdminOnly && !isAdmin() && !isSuperAdmin()) return false;
    if (itemFleetManagerOnly && !isFleetManager() && !isAdmin() && !isSuperAdmin()) return false;
    
    if (isDriver() && itemHideFromDriver) return false;
    if (!isDriver() && itemDriverOnly) return false;

    if (isMobile && item.mobileVisible === false) return false;

    return true;
  });

  const visibleSections = sections.filter(section =>
    filteredNavigation.some(item => item.section === section.id)
  );

  const handleNavClick = (item: {id: string, name: string, isFree?: boolean}) => {
    if (!item.isFree && !hasPremiumAccess) {
      setLockedFeatureName(item.name);
      setShowPremiumModal(true);
      if (isMobile) setSidebarOpen(false);
      return;
    }
    onTabChange(item.id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleLogoClick = () => {
    sessionStorage.setItem('trigger_onboarding_modal', 'true');
    onTabChange('dashboard');
    if (isMobile) setSidebarOpen(false);
  };

  // Reusable nav item renderer so mobile & desktop stay in sync
  const renderNavItem = (item: {id: string, name: string, isFree?: boolean, icon: React.ElementType, section: string, requiresAuth?: boolean, hideWhenAuth?: boolean, mobileVisible?: boolean}) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const isLocked = !item.isFree && !hasPremiumAccess;

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item)}
        className={`relative w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group border ${
          isActive
            ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
            : isLocked
              ? 'text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
              : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:translate-x-0.5'
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-0 h-full w-1 bg-blue-600 rounded-r-full" />
        )}
        <div className="flex items-center relative z-10">
          <Icon className={`h-[18px] w-[18px] mr-3 transition-colors ${
            isActive ? 'text-blue-600' : isLocked ? 'text-slate-300' : 'text-slate-400 group-hover:text-blue-500'
          }`} />
          {item.name}
        </div>
        <div className="flex items-center gap-1.5 relative z-10">
          {isLocked && (
            <div className="bg-amber-50 p-1.5 rounded-md border border-amber-200">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            </div>
          )}
        </div>
      </button>
    );
  };

  const sidebarBody = (
    <>
      {visibleSections.map((section) => (
        <div key={section.id}>
          <div className="px-3 mb-3 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-blue-400" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{section.title}</div>
          </div>
          <div className="space-y-1.5">
            {filteredNavigation.filter((item) => item.section === section.id).map(renderNavItem)}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200/50">

      {/* MOBILE SIDEBAR */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-white border-r border-slate-200 shadow-2xl animate-slideRight">
            <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200">
              <span onClick={handleLogoClick} className="text-xl font-extrabold tracking-tight text-slate-900 cursor-pointer hover:scale-[1.02] transition-transform">
                TranspoPilot
              </span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
              {sidebarBody}
            </nav>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col z-30 border-r border-slate-200 bg-white">
        <div className="flex h-20 items-center px-8 border-b border-slate-200">
          <span onClick={handleLogoClick} className="text-2xl font-extrabold tracking-tight text-slate-900 cursor-pointer hover:scale-[1.02] transition-transform">
            TranspoPilot
          </span>
        </div>

        <nav className="flex-1 px-5 py-8 space-y-8 overflow-y-auto custom-scrollbar">
          {sidebarBody}
        </nav>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen transition-all duration-300">

        {isGuestMode && activeTab !== 'signup' && activeTab !== 'login' && (
          <div className="sticky top-0 z-50 hidden md:block">
            <DemoModeBanner onNavigate={onTabChange} />
          </div>
        )}

        <div className={`sticky ${isGuestMode && activeTab !== 'signup' && activeTab !== 'login' ? 'md:top-[52px]' : 'top-0'} top-0 z-40 flex h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 shadow-sm items-center justify-between`}>

          <div className="flex items-center gap-4 overflow-hidden">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl lg:hidden transition-colors">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-extrabold text-slate-900 truncate tracking-tight">
              {navigation.find(item => item.id === activeTab)?.name || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {!user && (
              <div className="flex items-center gap-3">
                <button onClick={() => onTabChange('login')} className="hidden sm:block px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                  Sign In
                </button>
                <button onClick={() => onTabChange('signup')} className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 whitespace-nowrap">
                  Free Account
                </button>
              </div>
            )}

            {user && (
              <>
                <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
                  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-white"></div>
                  <Bell className="h-5 w-5" />
                </button>

                <UserDropdown onNavigate={onTabChange} />
              </>
            )}
          </div>
        </div>

        <main className="flex-1 p-0 overflow-x-hidden relative">
          {children}

          {showPremiumModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowPremiumModal(false)}></div>

              <div className="bg-white rounded-[2rem] w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-slide-up border border-slate-100">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
                  <div className="mx-auto w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/20 shadow-xl">
                    <Lock className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight">Unlock {lockedFeatureName}</h3>
                  <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-8 bg-white">
                  <p className="text-slate-600 font-medium text-center mb-8 leading-relaxed">
                    This advanced feature is locked in the Beta version. Upgrade to a Premium plan to gain full access to enterprise fleet analytics and AI tools.
                  </p>

                  <div className="space-y-4">
                    <button
                      onClick={() => { setShowPremiumModal(false); onTabChange('pricing'); }}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 px-6 rounded-xl font-bold shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] transition-all hover:-translate-y-0.5"
                    >
                      <Sparkles className="w-5 h-5"/> View Premium Plans
                    </button>
                    <button
                      onClick={() => setShowPremiumModal(false)}
                      className="w-full flex items-center justify-center bg-slate-50 text-slate-600 py-4 px-6 rounded-xl font-bold hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #CBD5E1; }
      `}</style>
    </div>
  );
};

export default Layout;