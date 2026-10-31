import React from 'react';

export const PageSkeleton: React.FC<{ title?: string }> = ({ title = 'Loading...' }) => (
  <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
    {/* Page Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
        <div className="h-4 w-72 bg-slate-100 rounded"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-28 bg-slate-200 rounded-xl"></div>
        <div className="h-10 w-28 bg-slate-200 rounded-xl"></div>
      </div>
    </div>

    {/* Metric Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="h-10 w-10 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="h-7 w-20 bg-slate-300 rounded"></div>
          <div className="h-3 w-32 bg-slate-100 rounded"></div>
        </div>
      ))}
    </div>

    {/* Main Content Area Skeleton */}
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 min-h-[360px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-50">
        <div className="h-6 w-36 bg-slate-200 rounded"></div>
        <div className="h-8 w-24 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="space-y-3 pt-2">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center justify-between py-2 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-slate-100 rounded-xl"></div>
              <div className="space-y-1.5">
                <div className="h-4 w-40 bg-slate-200 rounded"></div>
                <div className="h-3 w-28 bg-slate-100 rounded"></div>
              </div>
            </div>
            <div className="h-6 w-20 bg-slate-100 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default PageSkeleton;
