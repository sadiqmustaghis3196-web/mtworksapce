import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Star,
  Send,
  CheckCircle,
  AlertCircle,
  Zap,
  TrendingUp,
  Award,
  Quote,
  Bug,
  Lightbulb
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  createFeedback,
  createTestimonial,
  createPerformanceFeedback,
  getApprovedTestimonials,
  Testimonial
} from '../api/feedback';

const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'testimonial' | 'feedback' | 'performance'>('testimonial');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  const [testimonialForm, setTestimonialForm] = useState({
    name: '',
    company: '',
    position: '',
    fleetSize: '',
    quote: '',
    savingsMetric: ''
  });

  const [feedbackForm, setFeedbackForm] = useState({
    feedbackType: 'general' as 'general' | 'technical' | 'feature_request',
    category: 'ui_ux' as 'ui_ux' | 'performance' | 'bug' | 'feature' | 'other',
    title: '',
    message: ''
  });

  const [performanceForm, setPerformanceForm] = useState({
    issueType: 'bug' as 'bug' | 'crash' | 'slow_performance' | 'error',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    pageUrl: window.location.href,
    browser: navigator.userAgent,
    device: /mobile/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
    description: '',
    stepsToReproduce: '',
    errorMessage: ''
  });

  useEffect(() => {
    loadTestimonials();
  }, []);

  const loadTestimonials = async () => {
    const { data } = await getApprovedTestimonials();
    setTestimonials(data);
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const initials = testimonialForm.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);

    const result = await createTestimonial({
      name: testimonialForm.name,
      company: testimonialForm.company,
      position: testimonialForm.position || undefined,
      fleet_size: testimonialForm.fleetSize || undefined,
      quote: testimonialForm.quote,
      savings_metric: testimonialForm.savingsMetric || undefined,
      avatar_initials: initials
    });

    if (result.success) {
      setIsSubmitted(true);
      setTestimonialForm({
        name: '',
        company: '',
        position: '',
        fleetSize: '',
        quote: '',
        savingsMetric: ''
      });
    } else {
      alert('Error submitting testimonial. Please try again.');
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createFeedback({
      feedback_type: feedbackForm.feedbackType,
      category: feedbackForm.category,
      rating: rating > 0 ? rating : undefined,
      title: feedbackForm.title,
      message: feedbackForm.message,
      metadata: {
        browser: navigator.userAgent,
        page: window.location.href
      }
    });

    if (result.success) {
      setIsSubmitted(true);
      setFeedbackForm({
        feedbackType: 'general',
        category: 'ui_ux',
        title: '',
        message: ''
      });
      setRating(0);
    } else {
      alert('Error submitting feedback. Please try again.');
    }
  };

  const handlePerformanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createPerformanceFeedback({
      issue_type: performanceForm.issueType,
      severity: performanceForm.severity,
      page_url: performanceForm.pageUrl,
      browser: performanceForm.browser,
      device: performanceForm.device,
      description: performanceForm.description,
      steps_to_reproduce: performanceForm.stepsToReproduce || undefined,
      error_message: performanceForm.errorMessage || undefined
    });

    if (result.success) {
      setIsSubmitted(true);
      setPerformanceForm({
        ...performanceForm,
        description: '',
        stepsToReproduce: '',
        errorMessage: ''
      });
    } else {
      alert('Error submitting performance feedback. Please try again.');
    }
  };

  const tabs = [
    {
      id: 'testimonial' as const,
      name: 'Share Your Success',
      icon: Award,
      gradient: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'feedback' as const,
      name: 'General Feedback',
      icon: MessageSquare,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      id: 'performance' as const,
      name: 'Report Issue',
      icon: Bug,
      gradient: 'from-orange-500 to-red-600'
    }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#05070f] flex items-center justify-center p-4">
        <div className="bg-slate-900/60 rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-slate-400">
            Please sign in to submit feedback and testimonials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070f]">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <MessageSquare className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            We Value Your Feedback
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Help us improve TranspoPilot by sharing your experience, suggestions, or reporting issues.
            Your input drives our continuous improvement.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex space-x-2 mb-8 border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsSubmitted(false);
                }}
                className={`flex items-center space-x-2 px-6 py-3 font-semibold rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 rounded-xl shadow-lg p-8">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
                  <p className="text-slate-400 mb-6">
                    {activeTab === 'testimonial' && 'Your testimonial has been submitted for review. We appreciate you sharing your success story!'}
                    {activeTab === 'feedback' && 'Your feedback has been received. Our team will review it carefully.'}
                    {activeTab === 'performance' && 'Your report has been submitted. Our technical team will investigate this issue.'}
                  </p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Submit Another
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'testimonial' && (
                    <form onSubmit={handleTestimonialSubmit} className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Share Your Success Story</h2>
                        <p className="text-slate-400">
                          Tell us how TranspoPilot has transformed your fleet operations. Your story helps other fleet managers discover the value of our platform.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Your Name *
                          </label>
                          <input
                            type="text"
                            value={testimonialForm.name}
                            onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Company Name *
                          </label>
                          <input
                            type="text"
                            value={testimonialForm.company}
                            onChange={(e) => setTestimonialForm({ ...testimonialForm, company: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Position/Title
                          </label>
                          <input
                            type="text"
                            value={testimonialForm.position}
                            onChange={(e) => setTestimonialForm({ ...testimonialForm, position: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Fleet Manager"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Fleet Size
                          </label>
                          <select
                            value={testimonialForm.fleetSize}
                            onChange={(e) => setTestimonialForm({ ...testimonialForm, fleetSize: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select fleet size</option>
                            <option value="1-10 trucks">1-10 trucks</option>
                            <option value="11-50 trucks">11-50 trucks</option>
                            <option value="51-100 trucks">51-100 trucks</option>
                            <option value="100+ trucks">100+ trucks</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Your Experience *
                        </label>
                        <textarea
                          value={testimonialForm.quote}
                          onChange={(e) => setTestimonialForm({ ...testimonialForm, quote: e.target.value })}
                          rows={4}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Share how TranspoPilot has helped your business..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Key Achievement or Savings
                        </label>
                        <input
                          type="text"
                          value={testimonialForm.savingsMetric}
                          onChange={(e) => setTestimonialForm({ ...testimonialForm, savingsMetric: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., $15,000/month savings or 20% efficiency improvement"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                      >
                        <Send className="h-5 w-5" />
                        <span>Submit Testimonial</span>
                      </button>
                    </form>
                  )}

                  {activeTab === 'feedback' && (
                    <form onSubmit={handleFeedbackSubmit} className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Share Your Feedback</h2>
                        <p className="text-slate-400">
                          We're always looking to improve. Tell us what you think about TranspoPilot.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          How would you rate your experience?
                        </label>
                        <div className="flex space-x-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoveredRating(star)}
                              onMouseLeave={() => setHoveredRating(0)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`h-8 w-8 transition-colors ${
                                  star <= (hoveredRating || rating)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Feedback Type *
                          </label>
                          <select
                            value={feedbackForm.feedbackType}
                            onChange={(e) => setFeedbackForm({ ...feedbackForm, feedbackType: e.target.value as any })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="general">General Feedback</option>
                            <option value="technical">Technical Feedback</option>
                            <option value="feature_request">Feature Request</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Category *
                          </label>
                          <select
                            value={feedbackForm.category}
                            onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value as any })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="ui_ux">UI/UX</option>
                            <option value="performance">Performance</option>
                            <option value="bug">Bug Report</option>
                            <option value="feature">Feature Request</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Subject *
                        </label>
                        <input
                          type="text"
                          value={feedbackForm.title}
                          onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Brief description of your feedback"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Details *
                        </label>
                        <textarea
                          value={feedbackForm.message}
                          onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                          rows={5}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Please provide as much detail as possible..."
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                      >
                        <Send className="h-5 w-5" />
                        <span>Submit Feedback</span>
                      </button>
                    </form>
                  )}

                  {activeTab === 'performance' && (
                    <form onSubmit={handlePerformanceSubmit} className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Report a Technical Issue</h2>
                        <p className="text-slate-400">
                          Help us improve app performance by reporting bugs, errors, or slowdowns.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Issue Type *
                          </label>
                          <select
                            value={performanceForm.issueType}
                            onChange={(e) => setPerformanceForm({ ...performanceForm, issueType: e.target.value as any })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            required
                          >
                            <option value="bug">Bug</option>
                            <option value="crash">Crash</option>
                            <option value="slow_performance">Slow Performance</option>
                            <option value="error">Error Message</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Severity *
                          </label>
                          <select
                            value={performanceForm.severity}
                            onChange={(e) => setPerformanceForm({ ...performanceForm, severity: e.target.value as any })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            required
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Description *
                        </label>
                        <textarea
                          value={performanceForm.description}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, description: e.target.value })}
                          rows={4}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="What happened? Describe the issue in detail..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Steps to Reproduce
                        </label>
                        <textarea
                          value={performanceForm.stepsToReproduce}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, stepsToReproduce: e.target.value })}
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="1. Go to...\n2. Click on...\n3. See error..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Error Message (if any)
                        </label>
                        <textarea
                          value={performanceForm.errorMessage}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, errorMessage: e.target.value })}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                          placeholder="Paste any error messages here..."
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                      >
                        <Bug className="h-5 w-5" />
                        <span>Submit Report</span>
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Lightbulb className="h-5 w-5 text-yellow-500 mr-2" />
                Why Your Feedback Matters
              </h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start">
                  <TrendingUp className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Your insights help us prioritize new features and improvements</span>
                </li>
                <li className="flex items-start">
                  <Zap className="h-5 w-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Performance reports help us optimize the app for everyone</span>
                </li>
                <li className="flex items-start">
                  <Award className="h-5 w-5 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Success stories inspire other fleet managers and showcase real results</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
