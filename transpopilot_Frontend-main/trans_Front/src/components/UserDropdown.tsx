import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Shield, Building2, ChevronDown, Lock, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserDropdownProps {
  onNavigate: (page: string) => void;
}

const UserDropdown: React.FC<UserDropdownProps> = ({ onNavigate }) => {
  const { user, profile, signOut, isAdmin, isSuperAdmin, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // Super Admin Modal State
  const [showSuperAdminPrompt, setShowSuperAdminPrompt] = useState(false);
  const [saUsername, setSaUsername] = useState('');
  const [saPassword, setSaPassword] = useState('');
  const [saError, setSaError] = useState('');
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // SAFE FALLBACKS: Database delete hone par bhi Profile/Dropdown crash ya hide nahi hoga
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || 'user@transpopilot.com';
  const userRole = profile?.role || 'user';
  const avatarUrl = profile?.avatar_url;

  const getInitials = (name: string) => {
    if (!name) return 'TP';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = () => {
    if (userRole === 'super_admin' || userRole === 'superadmin') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-full">
          Super Admin
        </span>
      );
    }

    if (userRole === 'admin') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full">
          Admin
        </span>
      );
    }

    return null;
  };

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      sessionStorage.removeItem('super_admin_authenticated');
      await signOut();
      onNavigate('landing');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleMenuClick = (page: string) => {
    setIsOpen(false);
    onNavigate(page);
  };

  const handleSuperAdminClick = () => {
    setIsOpen(false);
    setShowSuperAdminPrompt(true);
  };

  const handleSuperAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    
    const expectedUsername = 'admin';
    const expectedPassword = 'admin123';

    if (saUsername === expectedUsername && saPassword === expectedPassword) {
      setShowSuperAdminPrompt(false);
      setSaUsername('');
      setSaPassword('');
      setSaError('');
      
      sessionStorage.setItem('super_admin_authenticated', 'true');
      onNavigate('super-admin-panel');
    } else {
      setSaError('Invalid credentials. Please try again.');
    }
  };

  // Safe Check: Strictly prevent returning null if auth context is loaded
  if (!user && !profile) return null;

  const avatarColor = avatarUrl
    ? 'bg-gray-200'
    : 'bg-gradient-to-br from-blue-500 to-blue-600';

  const handleToggleDropdown = () => {
    // Open immediately without blocking UI on network/API round-trips
    setIsOpen(prev => !prev);
  };

  // STRICT ACCESS CHECKS FOR ADMIN / SUPER ADMIN
  const isSessionSuperAdmin = sessionStorage.getItem('super_admin_authenticated') === 'true';
  const isUserAdminRole = userRole === 'admin' || (isAdmin && isAdmin());
  const isUserSuperAdminRole = userRole === 'super_admin' || userRole === 'superadmin' || (isSuperAdmin && isSuperAdmin());
  
  // Controls visibility of Admin / Super Admin options
  const canShowAdminSection = isUserAdminRole || isUserSuperAdminRole || isSessionSuperAdmin;
  const canShowSuperAdminPanel = isUserSuperAdminRole || isSessionSuperAdmin;

  return (
    <>
      <div className="relative" ref={dropdownRef} key={user?.id || 'user-dropdown'}>
        <button
          onClick={handleToggleDropdown}
          className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
        >
          <div className={`h-10 w-10 rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md hover:scale-105 transition-transform`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-xl object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-gray-900 leading-tight">{displayName}</div>
            <div className="text-xs text-gray-500 leading-tight">{displayEmail}</div>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 animate-slideDown">
            {/* Header / Profile info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`h-12 w-12 rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold shadow-lg`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
                  <div className="text-xs text-gray-500 truncate">{displayEmail}</div>
                  {getRoleBadge() && <div className="mt-1">{getRoleBadge()}</div>}
                </div>
              </div>
            </div>

            {/* General Links (Visible to ALL Users) */}
            <div className="py-2">
              <button
                onClick={() => handleMenuClick('profile')}
                className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">My Profile</span>
              </button>
            </div>

            {/* ADMINISTRATION SECTION: Only visible to Admins or Super Admins */}
            {canShowAdminSection && (
              <>
                <div className="border-t border-gray-200 my-1"></div>
                <div className="px-4 py-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center">
                    <Shield className="h-3 w-3 mr-1.5" />
                    Administration
                  </div>
                </div>
                
                <div className="pb-2">
                  {/* Password Prompt Option */}
                  <button
                    onClick={handleSuperAdminClick}
                    className="w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-orange-50 transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                      <Lock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-orange-700">Super Admin Access</span>
                      <p className="text-[10px] text-orange-600">Restricted platform control</p>
                    </div>
                  </button>

                  {/* Organization Admin Dashboard */}
                  <button
                    onClick={() => handleMenuClick('admin-dashboard')}
                    className="w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                      <Shield className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-blue-700">Admin Dashboard</span>
                      <p className="text-[10px] text-blue-600">Manage organization</p>
                    </div>
                  </button>

                  {/* Super Admin Panel (Direct link for verified Super Admin users) */}
                  {canShowSuperAdminPanel && (
                    <button
                      onClick={() => handleMenuClick('super-admin-panel')}
                      className="w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-violet-50 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 group-hover:from-violet-200 group-hover:to-purple-200 transition-colors">
                        <Building2 className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-violet-700">Super Admin Panel</span>
                        <p className="text-[10px] text-violet-600">Platform control</p>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Logout Section */}
            <div className="border-t border-gray-100 pt-2">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Super Admin Authentication Modal */}
      {showSuperAdminPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 min-h-screen w-full">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-fadeIn transform transition-all scale-100">
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white">
                <Lock className="h-5 w-5" />
                <h3 className="font-bold text-lg">Super Admin Authentication</h3>
              </div>
              <button 
                onClick={() => setShowSuperAdminPrompt(false)}
                className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSuperAdminAuth} className="p-6 space-y-5">
              {saError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-600 text-sm animate-pulse">
                  <AlertCircle className="h-4 w-4" />
                  <span>{saError}</span>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={saUsername}
                  onChange={(e) => setSaUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none text-gray-900"
                  placeholder="admin"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={saPassword}
                  onChange={(e) => setSaPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none text-gray-900"
                  placeholder="admin123"
                />
              </div>
              
              <div className="pt-3 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowSuperAdminPrompt(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UserDropdown;