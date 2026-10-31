import React from 'react';
import { CheckCircle2, Truck, Zap, Building2, ArrowRight, Sparkles, Rocket } from 'lucide-react';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const plans = [
    {
      name: 'STARTER',
      price: 399,
      yearlyPrice: '3,990',
      period: 'month',
      description: 'Up to 10 vehicles.',
      icon: Truck,
      theme: 'light',
      accent: 'text-blue-600',
      bgAccent: 'bg-blue-50',
      buttonClass: 'bg-slate-900/60 border-2 border-white/10 text-white hover:border-blue-600 hover:bg-[#05070f]',
      buttonText: 'Start Free Trial',
      trialText: '14-Day Free Trial',
      features: [
        'Unlimited driver profiles',
        'Real-time GPS tracking',
        'Driver & vehicle management',
        'Driver compliance monitoring',
        'Document expiration alerts',
        'Vehicle maintenance tracking',
        'Maintenance reminders',
        'Fuel consumption monitoring',
        'Driver performance metrics',
        'Basic route optimization',
        'Fleet alerts & notifications',
        'TranspoPilot AI daily fleet summary',
        'Mobile app access',
        'Essential fleet reporting',
        'Email support',
      ],
      recommended: false,
    },
    {
      name: 'GROWTH',
      price: 899,
      yearlyPrice: '8,990',
      period: 'month',
      description: 'Up to 25 vehicles.',
      icon: Zap,
      theme: 'dark', // Premium Dark Card
      accent: 'text-blue-400',
      bgAccent: 'bg-blue-900/30',
      buttonClass: 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] border border-blue-500',
      buttonText: 'Start Free Trial',
      trialText: '14-Day Free Trial',
      features: [
        '---DIVIDER---Everything in Starter, plus:',
        'Advanced route optimization',
        'AI-powered compliance assistance',
        'AI document data extraction',
        'Advanced compliance dashboard',
        'Automated maintenance scheduling',
        'Advanced fuel analytics',
        'Fuel efficiency & cost-per-mile insights',
        'Fuel anomaly alerts',
        'Advanced driver performance analytics',
        'Custom fleet alerts',
        'Geofencing',
        'Advanced dashboards & reporting',
        'Dispatch and fleet operations tools',
        'Integration-ready telematics connections',
        'Fuel card integration support',
        'Audit history',
        'Multiple fleet manager accounts',
        'Priority email & chat support',
      ],
      recommended: true,
    },
    {
      name: 'SCALE',
      price: 1699,
      yearlyPrice: '16,990',
      period: 'month',
      description: 'Up to 50 vehicles.',
      icon: Rocket,
      theme: 'light',
      accent: 'text-white',
      bgAccent: 'bg-slate-800',
      buttonClass: 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg border border-white/10 hover:border-slate-600',
      buttonText: 'Talk to Sales',
      trialText: '',
      features: [
        '---DIVIDER---Everything in Growth, plus:',
        'Advanced TranspoPilot AI fleet insights',
        'AI-powered operational recommendations',
        'Advanced fuel anomaly detection',
        'Fleet-wide efficiency benchmarking',
        'Advanced maintenance intelligence',
        'Multi-location fleet management',
        'Custom compliance workflows',
        'Advanced user roles & permissions',
        'Advanced audit logs',
        'Custom dashboards',
        'Advanced reporting & exports',
        'API & webhook access',
        'Advanced telematics integrations',
        'Fuel card integrations',
        'Custom notification rules',
        'Priority implementation & onboarding',
        'Priority phone, chat & email support',
        'Dedicated customer success support',
      ],
      recommended: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#05070f] font-sans selection:bg-blue-100 relative overflow-hidden">
      
      {/* Background Subtle Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none">
         <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[100px] mix-blend-multiply"></div>
         <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[100px] mix-blend-multiply"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/10 shadow-sm mb-6">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Simple Pricing. Smarter Fleet Management.</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Simple Pricing. <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Smarter Fleet Management.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-light mb-4">
            Choose the plan that fits your fleet today. Upgrade as you grow. No complicated pricing. No paying for dozens of tools you don't need.
          </p>
          <p className="text-sm font-medium text-blue-400 uppercase tracking-widest">
            Pay annually and receive approximately 2 months free.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-6 items-start mb-24 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isDark = plan.theme === 'dark';
            
            return (
              <div
                key={plan.name}
                className={`rounded-[2.5rem] relative transition-all duration-300 ${
                  isDark 
                    ? 'bg-slate-950 text-white shadow-2xl scale-100 lg:scale-105 z-10 border border-slate-800' 
                    : 'bg-slate-900/60 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]'
                }`}
              >
                {/* Popular Badge for Pro */}
                {plan.recommended && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-blue-500/30 flex items-center gap-1.5">
                       <Zap className="w-3 h-3 fill-current" /> Most Popular
                    </div>
                  </div>
                )}

                <div className="p-8 sm:p-10">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-2xl font-bold tracking-tight text-white`}>{plan.name}</h3>
                    <div className={`${plan.bgAccent} p-3 rounded-2xl`}>
                      <Icon className={`h-6 w-6 ${plan.accent}`} />
                    </div>
                  </div>
                  
                  <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-5xl font-extrabold tracking-tight">
                        ${plan.price}
                      </span>
                      <span className={`ml-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>/ {plan.period}</span>
                    </div>
                    <p className={`text-sm mt-2 font-medium ${isDark ? 'text-blue-400' : 'text-slate-400'}`}>
                      (${plan.yearlyPrice}/year)
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigate(plan.buttonText === 'Talk to Sales' ? 'contact' : 'signup')}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center group ${plan.buttonClass}`}
                  >
                    {plan.buttonText}
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {plan.trialText && (
                    <p className="text-center text-xs font-medium text-slate-400 mt-4">
                      {plan.trialText}
                    </p>
                  )}

                  <div className="mt-8 space-y-4 border-t border-white/5 pt-8">
                    {plan.features.map((feature, index) => {
                      if (feature.startsWith('---DIVIDER---')) {
                        const dividerText = feature.replace('---DIVIDER---', '');
                        return (
                          <div key={index} className="pt-4 pb-2">
                            <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-slate-400'}`}>
                              {dividerText}
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={index} className="flex items-start">
                          <CheckCircle2 className={`h-5 w-5 flex-shrink-0 mr-3 mt-0.5 ${isDark ? 'text-blue-500' : 'text-slate-400'}`} />
                          <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-300'}`}>{feature}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Enterprise Banner */}
        <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-slate-950 z-0 border border-white/10 rounded-[2.5rem]"></div>
          {/* Abstract Glows inside the banner */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/30 blur-[100px] rounded-full pointer-events-none z-0"></div>
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/30 blur-[100px] rounded-full pointer-events-none z-0"></div>
          
          <div className="relative z-10 px-8 py-16 md:px-16 flex flex-col md:flex-row items-center justify-between text-center md:text-left">
            <div className="mb-8 md:mb-0 md:pr-8">
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">ENTERPRISE</h2>
              <h3 className="text-xl font-bold text-blue-400 mb-4 tracking-tight">Custom Pricing</h3>
              <p className="text-lg text-slate-400 font-light max-w-xl">
                50+ vehicles, multiple terminals, custom integrations. We build a tailored solution to scale with your organization.
              </p>
            </div>
            <button
              onClick={() => onNavigate('contact')}
              className="bg-white text-slate-950 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all shadow-lg whitespace-nowrap border-0"
            >
              Contact Sales
            </button>
          </div>
        </div>

        {/* Footer Tagline */}
        <div className="mt-24 text-center">
          <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">
            One Platform. One Simple Price.
          </h3>
          <p className="text-slate-400 font-medium">
            TranspoPilot — Your Fleet. Simplified.
          </p>
        </div>

      </div>
    </div>
  );
};

export default PricingPage;