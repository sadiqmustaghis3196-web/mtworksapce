import React, { useState, useEffect } from 'react';
import {
  Truck,
  Shield,
  CheckCircle,
  ArrowRight,
  Zap,
  MapPin,
  Clock,
  Menu,
  X,
  ChevronRight,
  Globe,
  Activity,
  Cpu,
  Layers,
  BarChart3,
  Star,
  Quote
} from 'lucide-react';
import LegalModal from '../components/LegalModals';

interface LandingPageProps {
  onNavigate?: (tab: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | 'security' | null>(null);

  // Smooth navbar background transition on scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigation = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
      setIsMenuOpen(false);
    }
  };

  const features = [
    {
      icon: MapPin,
      title: "Real-Time GPS Tracking",
      description: "Pinpoint accuracy with sub-second latency. Monitor your entire fleet's movement on a unified, high-performance map.",
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-50/50"
    },
    {
      icon: Layers,
      title: "Universal Telematics Sync",
      description: "One-click integration with Geotab, Samsara, and Motive. We pull your vehicles and drivers automatically.",
      color: "from-indigo-500 to-indigo-600",
      bg: "bg-indigo-50/50"
    },
    {
      icon: Shield,
      title: "Automated Compliance logs",
      description: "Stay audit-ready. Our System automatically categorizes trip histories, driver logs, and compliance metrics.",
      color: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50/50"
    },
     {
      icon: Cpu,
      title: "Advanced Dispatching",
      description: "Let our routing algorithms suggest the most optimized assignments based on real-time traffic, HOS, and vehicle status.",
      color: "from-purple-500 to-purple-600",
      bg: "bg-purple-50/50"
    },
  ];

  const testimonials = [
    {
      quote: "Since switching to TranspoPilot, our dispatch team saves almost 15 hours a week. The universal telematics sync pulled in our Samsara data instantly. It's an absolute game-changer.",
      name: "Marcus Johnson",
      title: "Fleet Operations Manager",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=80",
      borderColor: "border-t-blue-500",
      quoteColor: "text-blue-500"
    },
    {
      quote: "The Advanced route optimization is incredibly accurate. We've reduced our fuel costs by 12% in just the first month. Plus, the dark mode interface is gorgeous and easy on the eyes.",
      name: "Emily Rodriguez",
      title: "Logistics Director — Nexus Freight",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
      borderColor: "border-t-indigo-500",
      quoteColor: "text-indigo-500"
    },
    {
      quote: "As an owner-operator scaling up, keeping track of HOS and compliance was a nightmare. TranspoPilot automates all of that. It feels like having a full-time dispatch team in my pocket.",
      name: "David Chen",
      title: "Owner — Chen Trucking LLC",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80",
      borderColor: "border-t-purple-500",
      quoteColor: "text-purple-500"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-500/30 selection:text-blue-900">
      
      {/* --- Premium Navbar (Transparent to Glassmorphism Dark) --- */}
      <nav className={`fixed w-full z-50 transition-all duration-500 ${
        scrolled ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-lg py-3' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center cursor-pointer group" onClick={() => { handleNavigation('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl mr-3 shadow-[0_0_15px_rgba(37,99,235,0.5)] group-hover:shadow-[0_0_25px_rgba(37,99,235,0.7)] transition-all duration-300">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <span className={`text-xl font-extrabold tracking-tight transition-colors duration-300 ${scrolled ? 'text-white' : 'text-slate-900 md:text-white'}`}>
                TranspoPilot
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className={`font-medium transition-colors text-sm hover:text-blue-400 ${scrolled ? 'text-slate-300' : 'text-slate-300'}`}>Features</button>
              <button onClick={() => document.getElementById('integrations')?.scrollIntoView({ behavior: 'smooth' })} className={`font-medium transition-colors text-sm hover:text-blue-400 ${scrolled ? 'text-slate-300' : 'text-slate-300'}`}>Integrations</button>
              <button onClick={() => handleNavigation('pricing')} className={`font-medium transition-colors text-sm hover:text-blue-400 ${scrolled ? 'text-slate-300' : 'text-slate-300'}`}>Pricing</button>
              
              <div className="flex items-center space-x-4 border-l border-slate-700 pl-6">
                <button 
                  onClick={() => handleNavigation('login')} 
                  className={`font-medium transition-colors text-sm hover:text-white ${scrolled ? 'text-slate-300' : 'text-slate-300'}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => handleNavigation('signup')} 
                  className="bg-white text-slate-950 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-0.5"
                >
                  Get Started
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`transition-colors p-2 ${scrolled ? 'text-white' : 'text-slate-900'}`}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown (Glassmorphism) */}
        <div className={`md:hidden absolute top-full left-0 w-full bg-slate-950/95 backdrop-blur-2xl border-b border-white/10 shadow-2xl transition-all duration-300 origin-top ${isMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}>
          <div className="flex flex-col space-y-4 px-6 py-8">
            <button onClick={() => { document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); setIsMenuOpen(false); }} className="text-left text-slate-300 font-medium text-lg">Features</button>
            <button onClick={() => { document.getElementById('integrations')?.scrollIntoView({ behavior: 'smooth' }); setIsMenuOpen(false); }} className="text-left text-slate-300 font-medium text-lg">Integrations</button>
            <button onClick={() => handleNavigation('pricing')} className="text-left text-slate-300 font-medium text-lg">Pricing</button>
            <hr className="border-slate-800 my-2" />
            <button onClick={() => handleNavigation('login')} className="text-left text-white font-semibold text-lg">Sign In</button>
            <button onClick={() => handleNavigation('signup')} className="bg-blue-600 text-white px-4 py-3.5 rounded-xl font-bold text-center text-lg shadow-lg shadow-blue-600/20 mt-4">Start Free Trial</button>
          </div>
        </div>
      </nav>

      {/* --- Dark Premium Hero Section --- */}
      <div className="relative pt-32 pb-20 lg:pt-52 lg:pb-32 overflow-hidden bg-slate-950">
        
        {/* Abstract Glowing Orbs (Premium Tech Feel) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
            {/* Grid Pattern Overlay */}

            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          {/* Neon Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl mb-8 animate-fade-in-up hover:bg-white/10 transition-colors cursor-pointer group">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 text-xs font-semibold tracking-wide uppercase group-hover:text-white transition-colors">TranspoPilot v2.0 is Live</span>
            <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-white transition-colors" />
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-8 leading-[1.05] max-w-5xl mx-auto">
            The Operating System for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 animate-gradient-x">
              Modern Fleets.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            Unify your Geotab and Samsara data into one intelligent dashboard. Track live, automate compliance, and optimize routes with Enterprise-grade analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => handleNavigation('signup')}
              className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-base hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-1 flex items-center justify-center group"
            >
              Start 14-Day Free Trial
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
               onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-transparent text-white px-8 py-4 rounded-full font-semibold text-base hover:bg-white/5 transition-all border border-white/20 flex items-center justify-center backdrop-blur-sm"
            >
              Explore Platform
            </button>
          </div>
        </div>

        {/* Dashboard Mockup - Glassmorphism */}
        <div className="max-w-5xl mx-auto mt-20 px-4 sm:px-6 relative z-10 hidden md:block">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-t-[2rem] shadow-2xl overflow-hidden pt-4 px-4 sm:pt-6 sm:px-6 translate-y-12 hover:translate-y-8 transition-transform duration-700">
             <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
               <div className="flex gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                 <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                 <div className="w-3 h-3 rounded-full bg-slate-700"></div>
               </div>
               <div className="ml-4 bg-slate-800/50 rounded-md h-5 w-48"></div>
             </div>
             {/* Map Mockup Area */}
             <div className="h-64 bg-slate-950/50 border border-white/5 rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-500/20 blur-2xl rounded-full"></div>
                <MapPin className="text-blue-500 w-10 h-10 relative z-10 animate-bounce" />
                <div className="absolute bottom-4 left-4 bg-slate-900 border border-white/10 px-4 py-2 rounded-lg text-slate-300 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> 14 Active Vehicles synced via Samsara</div>
             </div>
          </div>
        </div>
      </div>

      {/* --- Stats / Social Proof Bar --- */}
      <div className="bg-white border-b border-slate-100 py-10 relative z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-slate-100">
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">10M+</div>
              <div className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-wide">Miles Tracked</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">99.9%</div>
              <div className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-wide">API Uptime</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">&lt;1s</div>
              <div className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-wide">Sync Latency</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">24/7</div>
              <div className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-wide">Monitoring</div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Integrations Section --- */}
      <div id="integrations" className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-3">Plug & Play</h2>
          <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tight">Connect your entire fleet in seconds.</h3>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-light mb-16">Enter your API key or credentials and our backend engine instantly maps your vehicles, drivers, and historical data securely.</p>
          
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:-translate-y-2 transition-transform duration-300">
                <span className="text-2xl font-black text-blue-700 tracking-tighter">Geotab</span>
              </div>
              <span className="text-sm font-semibold text-slate-600">Native Integration</span>
            </div>
            <ArrowRight className="text-slate-300 w-8 h-8 hidden md:block" />
            
            <div className="flex flex-col items-center group">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl shadow-xl border border-blue-500 flex items-center justify-center mb-4 relative z-10 scale-110">
                <Truck className="text-white w-12 h-12" />
              </div>
              <span className="text-sm font-bold text-slate-900">TranspoPilot Core</span>
            </div>
            
            <ArrowRight className="text-slate-300 w-8 h-8 hidden md:block" />
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:-translate-y-2 transition-transform duration-300">
                <span className="text-2xl font-black text-slate-900 tracking-tighter">Samsara</span>
              </div>
              <span className="text-sm font-semibold text-slate-600">API Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Core Features Section (Bento Grid) --- */}
      <div id="features" className="py-24 sm:py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-3">Platform Capabilities</h2>
            <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Built for scale.<br/>Designed for speed.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                  <div className={`${feature.bg} w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 border border-slate-100`}>
                    <Icon className={`h-6 w-6 text-slate-800 drop-shadow-sm`} style={{ strokeWidth: '2.5' }} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed font-light text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- NEW: Testimonials Section (Social Proof) --- */}
      <div className="py-24 sm:py-32 bg-slate-900 relative border-y border-slate-800 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-blue-500 font-bold tracking-widest uppercase text-xs mb-3">Testimonials</h2>
            <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight">Trusted by fleet businesses worldwide</h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light">See how TranspoPilot is helping fleet owners save time and scale with confidence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className={`bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-3xl p-8 shadow-xl flex flex-col justify-between border-t-4 ${testimonial.borderColor}`}>
                <div>
                  <Quote className={`w-8 h-8 mb-6 opacity-80 ${testimonial.quoteColor}`} fill="currentColor" />
                  <div className="flex gap-1 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400" fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-slate-300 font-medium leading-relaxed mb-8">
                    "{testimonial.quote}"
                  </p>
                </div>
                
                <div className="border-t border-slate-700/50 pt-6 flex items-center gap-4">
                  <img src={testimonial.avatar} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-700" />
                  <div>
                    <h4 className="text-white font-bold text-sm">{testimonial.name}</h4>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">{testimonial.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-20">
             <h4 className="text-amber-400 font-bold tracking-widest uppercase text-xs mb-2">Real People. Real Results.</h4>
             <h2 className="text-3xl font-extrabold text-white tracking-tight">TranspoPilot in action</h2>
          </div>
        </div>
      </div>

      {/* --- Premium Dark CTA Section --- */}
      <div className="py-24 bg-slate-950 relative overflow-hidden m-4 sm:m-8 lg:m-12 rounded-[3rem] border border-slate-800">

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to modernize your operations?</h2>
          <p className="text-xl text-slate-400 mb-10 font-light max-w-2xl mx-auto">Join the forward-thinking fleet owners who are saving hours of admin work daily with TranspoPilot.</p>
          <button
            onClick={() => handleNavigation('signup')}
            className="bg-white text-slate-950 px-10 py-4 rounded-full font-bold text-lg hover:bg-slate-100 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:-translate-y-1"
          >
            Create Your Free Account
          </button>
          <p className="text-slate-500 text-sm mt-6 font-medium">14-day free trial • Set up in 2 minutes • No credit card</p>
        </div>
      </div>

      {/* --- Minimalist Enterprise Footer --- */}
      <footer className="bg-white pt-16 pb-8 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
            <div className="flex items-center space-x-2">
              <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
                  <Truck className="h-5 w-5 text-white" />
              </div>
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">TranspoPilot</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-slate-600 font-medium">
              <button onClick={() => setActiveLegalModal('privacy')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
              <button onClick={() => setActiveLegalModal('terms')} className="hover:text-blue-600 transition-colors">Terms of Service</button>
              <button onClick={() => setActiveLegalModal('security')} className="hover:text-blue-600 transition-colors">Security</button>
              <button onClick={() => handleNavigation('contact')} className="hover:text-blue-600 transition-colors">Contact Support</button>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-400 text-sm font-medium">
              © {new Date().getFullYear()} TranspoPilot Inc. All rights reserved.
            </div>
            <div className="flex space-x-4">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all"><Globe className="w-4 h-4"/></div>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all"><Activity className="w-4 h-4"/></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Modals */}
      {activeLegalModal && (
        <LegalModal 
          isOpen={!!activeLegalModal} 
          type={activeLegalModal} 
          onClose={() => setActiveLegalModal(null)} 
        />
      )}
    </div>
  );
};

export default LandingPage;