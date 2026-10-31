import React from 'react';
import { Truck, Shield, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserDropdown from './UserDropdown';

interface HeaderProps {
  onStartTrial: () => void;
  onNavigate: (page: string) => void;
  activeTab?: string;
}

const Header: React.FC<HeaderProps> = ({ onStartTrial, onNavigate, activeTab }) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => onNavigate('landing')}>
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-2.5 rounded-lg shadow-lg">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                TranspoPilot
              </h1>
              <p className="text-xs text-gray-500 font-medium">Advanced Fleet Management</p>
            </div>
          </div>

          <nav className="flex items-center space-x-4 md:space-x-6">
            <a href="#features" className="hidden lg:block text-gray-600 hover:text-blue-600 font-medium transition-colors">
              Features
            </a>
            <a href="#testimonials" className="hidden lg:block text-gray-600 hover:text-blue-600 font-medium transition-colors">
              Testimonials
            </a>
            <button
              onClick={() => onNavigate('pricing')}
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm md:text-base"
            >
              Pricing
            </button>

            {user && isAdmin() && (
              <button
                onClick={() => onNavigate('admin-dashboard')}
                className={`hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'admin-dashboard'
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/50'
                    : 'text-indigo-700 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </button>
            )}

            {user && isSuperAdmin() && (
              <button
                onClick={() => onNavigate('super-admin-panel')}
                className={`hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'super-admin-panel'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-700 text-white shadow-lg shadow-violet-500/50'
                    : 'text-violet-700 hover:bg-gradient-to-r hover:from-violet-500 hover:to-purple-700 hover:text-white hover:shadow-md'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Super Admin</span>
              </button>
            )}
          </nav>

          {user ? (
            <UserDropdown onNavigate={onNavigate} />
          ) : (
            <div className="flex items-center space-x-2 md:space-x-4">
              <button
                onClick={() => onNavigate('login')}
                className="text-gray-600 hover:text-blue-600 font-semibold transition-colors text-sm md:text-base px-2 md:px-0"
              >
                Sign In
              </button>
              <button
                onClick={onStartTrial}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-xs md:text-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 whitespace-nowrap"
              >
                <span className="hidden sm:inline">Start 30-Day Trial</span>
                <span className="sm:hidden">Start Trial</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
