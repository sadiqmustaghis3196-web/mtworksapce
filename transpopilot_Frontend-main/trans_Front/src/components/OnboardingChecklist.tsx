import React from 'react';
import { CheckCircle, Circle, Truck, Users, MapPin, BarChart3, X, Plug, Check } from 'lucide-react';

interface OnboardingChecklistProps {
  completedSteps: string[];
  onStepClick: (step: string) => void;
  onDismiss: () => void;
  isVisible: boolean;
}

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  completedSteps,
  onStepClick,
  onDismiss,
  isVisible,
}) => {
  if (!isVisible) return null;

  const steps: ChecklistStep[] = [
    { id: 'integrations', title: 'Connect Your Telematics', description: 'Link Geotab, Samsara, Motive, or custom system to sync your fleet data', icon: Plug, route: 'integrations' },
    { id: 'live-tracking', title: 'Explore Live Tracking', description: 'See how real-time GPS tracking works', icon: MapPin, route: 'live-tracking' },
    { id: 'vehicles', title: 'Add Your First Vehicle', description: 'Set up your first truck to start tracking', icon: Truck, route: 'vehicles' },
    { id: 'drivers', title: 'Add a Driver', description: 'Onboard your first driver to the system', icon: Users, route: 'drivers' },
    { id: 'dashboard', title: 'View Your Dashboard', description: 'Explore Advanced insights and reports', icon: BarChart3, route: 'dashboard' },
  ];

  const completedCount = completedSteps.length;
  const totalSteps = steps.length;
  const progress = (completedCount / totalSteps) * 100;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/10 p-6 sm:p-8 relative overflow-hidden mt-8">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400"></div>

      <button
        onClick={onDismiss}
        className="absolute top-6 right-6 p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10"
        title="Dismiss checklist"
      >
        <X size={20} />
      </button>

      <div className="mb-8">
        <h3 className="text-2xl font-black text-white tracking-tight mb-2">Get Started with TranspoPilot</h3>
        <p className="text-sm font-medium text-slate-400 mb-6">
          Complete these steps to get the most out of your trial
        </p>

        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(99,102,241,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-black text-slate-300 w-8 text-right">
            {completedCount}/{totalSteps}
          </span>
        </div>

        {completedCount === totalSteps && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mt-4">
            <p className="text-sm text-emerald-400 font-bold flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              All systems go! You have successfully completed the onboarding checklist.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.route)}
              className={`w-full group flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer text-left ${
                isCompleted
                  ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                  : 'bg-slate-950/50 border-white/10 hover:border-indigo-500/40 hover:bg-slate-800 hover:shadow-lg'
              }`}
            >
              <div className="flex items-center gap-4 sm:gap-5">
                <div
                  className={`p-3 rounded-xl border flex-shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-slate-900 border-slate-700 text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30'
                  }`}
                >
                  <Icon size={22} />
                </div>

                <div>
                  <h4 className={`text-base sm:text-lg font-bold transition-colors ${
                    isCompleted ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {step.title}
                  </h4>
                  <p className="text-sm font-medium text-slate-500 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0 ml-4 hidden sm:block">
                {isCompleted ? (
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                    <Check size={16} strokeWidth={3} />
                  </div>
                ) : (
                  <Circle className="h-6 w-6 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {completedCount < totalSteps && (
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Click any step to navigate there directly
          </p>
        </div>
      )}
    </div>
  );
};

export default OnboardingChecklist;