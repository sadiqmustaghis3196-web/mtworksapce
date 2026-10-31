import React from 'react';
import { Eye, Sparkles } from 'lucide-react';

const SignupPreviewBanner: React.FC = () => {
  return (
    <div className="px-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 border-b border-emerald-600">
      <div className="flex items-center space-x-2 text-white">
        <div className="flex-shrink-0">
          <Eye className="h-5 w-5 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight">
            Feature Preview
          </p>
          <p className="text-[10px] leading-tight opacity-90">
            All features available instantly after signup
          </p>
        </div>
        <div className="flex-shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

export default SignupPreviewBanner;
