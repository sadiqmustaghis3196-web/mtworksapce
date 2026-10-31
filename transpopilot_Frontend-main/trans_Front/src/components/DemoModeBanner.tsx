import React, { useState } from 'react';
import { Sparkles, X, LogIn, UserPlus } from 'lucide-react';

interface DemoModeBannerProps {
  onNavigate: (tab: string) => void;
}

const DemoModeBanner: React.FC<DemoModeBannerProps> = ({ onNavigate }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Sparkles className="h-6 w-6 text-yellow-300 animate-pulse" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold">
                Demo Mode Active - Exploring with Sample Data
              </p>
              <p className="text-xs text-white/90 mt-0.5 hidden sm:block">
                Create a free account to manage your real fleet and save your work
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('signup')}
              className="inline-flex items-center px-4 py-2 border-2 border-white text-sm font-bold rounded-lg text-white hover:bg-white hover:text-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create Free Account
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="inline-flex items-center px-3 py-2 text-sm font-semibold rounded-lg text-white hover:bg-white/20 transition-all duration-200"
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              Sign In
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors ml-2"
              aria-label="Dismiss banner"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoModeBanner;
