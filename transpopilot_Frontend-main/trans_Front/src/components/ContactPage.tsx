import React, { useState } from 'react';
import { createContactSubmission } from '../api/contactSubmissions';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock,
  CheckCircle,
  MessageSquare,
  Calendar,
  Users,
  X,
  Sparkles,
  ArrowRight,
  HeadphonesIcon
} from 'lucide-react';

const ContactPage: React.FC = () => {
  // Main Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    fleetSize: '',
    phone: '',
    message: '',
    inquiryType: 'demo'
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 15-min Call Modal State
  const [showCallModal, setShowCallModal] = useState(false);
  const [isCallBooked, setIsCallBooked] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [callData, setCallData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createContactSubmission(formData);
    if (result.success) {
      setIsSubmitted(true);
    } else {
      alert(`Error submitting form: ${result.error || 'Please try again.'}`);
    }
  };

  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooking(true);
    
    // Formatting data to prevent check constraint errors
    const submissionData = {
      name: callData.name,
      email: callData.email,
      phone: callData.phone,
      company: 'N/A', 
      fleetSize: 'N/A',
      message: `[15-MIN CALL REQUEST] Date: ${callData.date} at Time: ${callData.time}`,
      inquiryType: 'demo' // Keeps it safe from database constraints
    };

    const result = await createContactSubmission(submissionData);
    setIsBooking(false);
    
    if (result.success) {
      setIsCallBooked(true);
      setTimeout(() => {
        setShowCallModal(false);
        setIsCallBooked(false);
        setCallData({ name: '', email: '', phone: '', date: '', time: '' });
      }, 3000);
    } else {
      alert(`Error booking the call: ${result.error || 'Please try again.'}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCallDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCallData({
      ...callData,
      [e.target.name]: e.target.value
    });
  };

  const contactInfo = [
    {
      icon: Phone,
      title: "Direct Sales & Support",
      details: "+1 512 994-4246",
      description: "Mon-Fri 8AM-6PM EST"
    },
    {
      icon: Mail,
      title: "Partnerships & Email",
      details: "partners@transpopilotai.com",
      description: "Average response: under 2 hours"
    },
    {
      icon: MapPin,
      title: "Global Headquarters",
      details: "123 Innovation Drive, Austin, TX",
      description: "Texas, United States"
    },
    {
      icon: Clock,
      title: "Critical Operations",
      details: "24/7 Emergency Support",
      description: "Available for Enterprise fleets"
    }
  ];

  const faqs = [
    {
      question: "How quickly can we get started?",
      answer: "Most fleets are fully operational within 24-48 hours. Once you provide your telematics API key (Geotab/Samsara), our AI engine syncs your data instantly."
    },
    {
      question: "Do you integrate with our existing systems?",
      answer: "Absolutely. We are built as a Plug-and-Play platform. We currently support native integrations with Geotab, Samsara, and Motive, with Custom APIs available for Enterprise."
    },
    {
      question: "What's included in the free trial?",
      answer: "You get 14 days of unrestricted access to our Premium tier. This includes live tracking, AI route optimization, and full compliance reporting. No credit card is required to start."
    },
    {
      question: "What is the expected ROI?",
      answer: "Our customers typically report an 8-15% reduction in fuel waste and virtually eliminate compliance fines. Most fleets see a full return on investment within the first 60 days."
    }
  ];

  return (
    <div className="min-h-screen bg-[#05070f] font-sans selection:bg-blue-100 relative">
      
      {/* --- Dark Premium Hero Section --- */}
      <div className="relative pt-32 pb-32 lg:pt-40 lg:pb-48 overflow-hidden bg-slate-950">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none overflow-hidden">
            <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
            <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60/5 border border-white/10 backdrop-blur-md mb-8">
            <HeadphonesIcon className="h-4 w-4 text-blue-400" />
            <span className="text-slate-300 text-xs font-bold tracking-widest uppercase">We're here to help</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6 leading-[1.1]">
            Let's transform your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400">fleet operations.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">
            Whether you need a custom demo, technical support, or partnership details, our team of logistics experts is ready to assist you.
          </p>
        </div>
      </div>

      {/* --- Main Content Split --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 -mt-20 lg:-mt-32 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Premium Contact Form */}
          <div className="lg:col-span-7 bg-slate-900/60 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/5 p-6 sm:p-10 lg:p-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2 tracking-tight">
              Schedule Your Personalized Demo
            </h2>
            <p className="text-slate-400 font-medium mb-8">Fill out the form below and we'll connect you with the right expert.</p>
            
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Full Name <span className="text-blue-600">*</span></label>
                    <input
                      type="text" name="name" required value={formData.name} onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Business Email <span className="text-blue-600">*</span></label>
                    <input
                      type="email" name="email" required value={formData.email} onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="john@company.com"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Company Name <span className="text-blue-600">*</span></label>
                    <input
                      type="text" name="company" required value={formData.company} onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="Acme Logistics"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Fleet Size</label>
                    <select
                      name="fleetSize" value={formData.fleetSize} onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-slate-300 appearance-none cursor-pointer"
                    >
                      <option value="">Select fleet size</option>
                      <option value="1-10">1-10 vehicles</option>
                      <option value="11-50">11-50 vehicles</option>
                      <option value="51-200">51-200 vehicles</option>
                      <option value="201-500">201-500 vehicles</option>
                      <option value="500+">500+ vehicles (Enterprise)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Phone Number</label>
                    <input
                      type="tel" name="phone" value={formData.phone} onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Topic of Interest</label>
                    <select
                      name="inquiryType" value={formData.inquiryType} onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-slate-300 appearance-none cursor-pointer"
                    >
                      <option value="demo">Schedule a Platform Demo</option>
                      <option value="trial">Start 14-Day Free Trial</option>
                      <option value="pricing">Enterprise Pricing</option>
                      <option value="integration">Telematics API Integration</option>
                      <option value="support">Technical Support</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">How can we help?</label>
                  <textarea
                    name="message" value={formData.message} onChange={handleChange} rows={4}
                    className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white resize-none"
                    placeholder="Tell us about your current fleet management challenges..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-4 px-4 rounded-xl font-bold text-lg hover:bg-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  Request Demo Access <ArrowRight className="w-5 h-5" />
                </button>
                
                <p className="text-sm font-medium text-slate-400 text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500"/> We typically respond within 2 hours.
                </p>
              </form>
            ) : (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-10 text-center animate-fade-in">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight">Request Received!</h3>
                <p className="text-slate-400 font-medium leading-relaxed">
                  Thank you for your interest in TranspoPilot. Our logistics experts are reviewing your details and will reach out shortly to schedule your personalized session.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Contact Info & Quick Actions */}
          <div className="lg:col-span-5 space-y-6 pt-4 lg:pt-12">
            
            {/* Bento Grid Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contactInfo.map((info, index) => {
                const Icon = info.icon;
                return (
                  <div key={index} className="bg-slate-900/60 rounded-2xl p-6 border border-white/5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-lg transition-all group">
                    <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                      <Icon className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-bold text-white mb-1">{info.title}</h3>
                    <p className="text-slate-300 font-medium text-sm mb-0.5">{info.details}</p>
                    <p className="text-xs font-medium text-slate-400">{info.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Premium Quick Actions */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
              <h3 className="font-extrabold text-xl mb-6 tracking-tight">Accelerate your process</h3>
              <div className="space-y-3 relative z-10">
                <button 
                  onClick={() => setShowCallModal(true)}
                  className="w-full flex items-center justify-between bg-blue-600 text-white py-3.5 px-5 rounded-xl hover:bg-blue-500 transition-all font-bold shadow-lg shadow-blue-500/20 group"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5" /> Book a 15-min Intro Call
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
                </button>
                <button className="w-full flex items-center justify-between bg-slate-900/60/10 border border-white/10 text-white py-3.5 px-5 rounded-xl hover:bg-slate-900/60/20 transition-all font-semibold backdrop-blur-sm group">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5" /> Start Live Chat
                  </div>
                </button>
                <button className="w-full flex items-center justify-between bg-slate-900/60/10 border border-white/10 text-white py-3.5 px-5 rounded-xl hover:bg-slate-900/60/20 transition-all font-semibold backdrop-blur-sm group">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" /> Register for Weekly Webinar
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- Premium FAQ Section --- */}
      <div className="py-24 bg-slate-900/60 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-3">Clear Answers</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-[#05070f] rounded-2xl border border-white/5 p-8 hover:shadow-md transition-shadow">
                <h4 className="font-bold text-white mb-3 text-lg leading-snug">{faq.question}</h4>
                <p className="text-slate-400 font-medium leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- Luxury 15-Min Call Modal --- */}
      {showCallModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900/60 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="bg-[#05070f] px-8 py-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-extrabold text-white flex items-center gap-3 tracking-tight">
                <div className="bg-blue-100 p-2 rounded-lg"><Calendar className="h-5 w-5 text-blue-600" /></div>
                Book a Call
              </h3>
              <button 
                onClick={() => setShowCallModal(false)}
                className="text-slate-400 hover:text-slate-400 bg-slate-900/60 hover:bg-slate-800 p-2 rounded-full transition-all shadow-sm border border-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-8">
              {isCallBooked ? (
                <div className="text-center py-8 animate-fade-in">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100">
                    <CheckCircle className="h-10 w-10 text-emerald-500" />
                  </div>
                  <h4 className="text-2xl font-extrabold text-white mb-2 tracking-tight">Call Requested!</h4>
                  <p className="text-slate-400 font-medium">
                    We have securely received your details. One of our AI logistics experts will confirm the calendar invite with you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCallSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Name <span className="text-blue-600">*</span></label>
                    <input 
                      type="text" name="name" required value={callData.name} onChange={handleCallDataChange}
                      className="w-full bg-[#05070f] border border-white/10 rounded-xl px-4 py-3 focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-white" 
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Email Address <span className="text-blue-600">*</span></label>
                    <input 
                      type="email" name="email" required value={callData.email} onChange={handleCallDataChange}
                      className="w-full bg-[#05070f] border border-white/10 rounded-xl px-4 py-3 focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-white" 
                      placeholder="john@company.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Phone Number <span className="text-blue-600">*</span></label>
                    <input 
                      type="tel" name="phone" required value={callData.phone} onChange={handleCallDataChange}
                      className="w-full bg-[#05070f] border border-white/10 rounded-xl px-4 py-3 focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-white" 
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-300">Date <span className="text-blue-600">*</span></label>
                      <input 
                        type="date" name="date" required value={callData.date} onChange={handleCallDataChange}
                        className="w-full bg-[#05070f] border border-white/10 rounded-xl px-4 py-3 focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-300" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-300">Time <span className="text-blue-600">*</span></label>
                      <input 
                        type="time" name="time" required value={callData.time} onChange={handleCallDataChange}
                        className="w-full bg-[#05070f] border border-white/10 rounded-xl px-4 py-3 focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-300" 
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" disabled={isBooking}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-6 hover:bg-blue-700 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {isBooking ? (
                       <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processing...</>
                    ) : 'Confirm Booking'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default ContactPage;