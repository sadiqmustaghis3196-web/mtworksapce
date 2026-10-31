import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Award,
  Bug,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Star,
  Filter,
  Search,
  Eye,
  CheckSquare,
  XSquare,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllFeedback,
  getAllTestimonials,
  getAllPerformanceFeedback,
  updateFeedbackStatus,
  updateTestimonialStatus,
  updatePerformanceFeedbackStatus,
  FeedbackSubmission,
  Testimonial,
  AppPerformanceFeedback
} from '../api/feedback';

const FeedbackManagementDashboard: React.FC = () => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'feedback' | 'testimonials' | 'performance'>('feedback');
  const [feedbackList, setFeedbackList] = useState<FeedbackSubmission[]>([]);
  const [testimonialsList, setTestimonialsList] = useState<Testimonial[]>([]);
  const [performanceList, setPerformanceList] = useState<AppPerformanceFeedback[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (activeTab === 'feedback') {
      const { data } = await getAllFeedback();
      setFeedbackList(data);
    } else if (activeTab === 'testimonials') {
      const { data } = await getAllTestimonials();
      setTestimonialsList(data);
    } else {
      const { data } = await getAllPerformanceFeedback();
      setPerformanceList(data);
    }
  };

  const handleUpdateFeedbackStatus = async (id: string, status: string, response?: string) => {
    const result = await updateFeedbackStatus(id, status, response);
    if (result.success) {
      loadData();
      setSelectedItem(null);
    } else {
      alert('Error updating status');
    }
  };

  const handleUpdateTestimonialStatus = async (id: string, status: string) => {
    const result = await updateTestimonialStatus(id, status);
    if (result.success) {
      loadData();
      setSelectedItem(null);
    } else {
      alert('Error updating testimonial');
    }
  };

  const handleUpdatePerformanceStatus = async (id: string, status: string) => {
    const result = await updatePerformanceFeedbackStatus(id, status);
    if (result.success) {
      loadData();
      setSelectedItem(null);
    } else {
      alert('Error updating performance feedback');
    }
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-[#05070f] flex items-center justify-center p-4">
        <div className="bg-slate-900/60 rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  const getStats = () => {
    if (activeTab === 'feedback') {
      return {
        total: feedbackList.length,
        new: feedbackList.filter(f => f.status === 'new').length,
        inProgress: feedbackList.filter(f => f.status === 'in_progress').length,
        resolved: feedbackList.filter(f => f.status === 'resolved').length
      };
    } else if (activeTab === 'testimonials') {
      return {
        total: testimonialsList.length,
        pending: testimonialsList.filter(t => t.approval_status === 'pending').length,
        approved: testimonialsList.filter(t => t.approval_status === 'approved').length,
        rejected: testimonialsList.filter(t => t.approval_status === 'rejected').length
      };
    } else {
      return {
        total: performanceList.length,
        critical: performanceList.filter(p => p.severity === 'critical').length,
        high: performanceList.filter(p => p.severity === 'high').length,
        new: performanceList.filter(p => p.status === 'new').length
      };
    }
  };

  const stats = getStats();

  const tabs = [
    { id: 'feedback' as const, name: 'General Feedback', icon: MessageSquare, gradient: 'from-blue-500 to-cyan-600' },
    { id: 'testimonials' as const, name: 'Testimonials', icon: Award, gradient: 'from-emerald-500 to-teal-600' },
    { id: 'performance' as const, name: 'Performance Issues', icon: Bug, gradient: 'from-orange-500 to-red-600' }
  ];

  const filteredFeedback = feedbackList.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredTestimonials = testimonialsList.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.quote?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.approval_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPerformance = performanceList.filter(item => {
    const matchesSearch = item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.error_message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#05070f] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Feedback Management</h1>
          <p className="text-slate-400">Review and manage user feedback, testimonials, and performance reports</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/60 rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">Total Items</span>
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">
                {activeTab === 'feedback' ? 'New' : activeTab === 'testimonials' ? 'Pending' : 'Critical'}
              </span>
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-white">
              {activeTab === 'feedback' ? stats.new : activeTab === 'testimonials' ? stats.pending : stats.critical}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">
                {activeTab === 'feedback' ? 'In Progress' : activeTab === 'testimonials' ? 'Approved' : 'High Priority'}
              </span>
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-white">
              {activeTab === 'feedback' ? stats.inProgress : activeTab === 'testimonials' ? stats.approved : stats.high}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">
                {activeTab === 'testimonials' ? 'Rejected' : 'Resolved'}
              </span>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-white">
              {activeTab === 'testimonials' ? stats.rejected : stats.resolved || stats.new}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-xl shadow-sm mb-6">
          <div className="flex space-x-1 p-2 border-b border-white/10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchTerm('');
                    setStatusFilter('all');
                    setSelectedItem(null);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  {activeTab === 'feedback' && (
                    <>
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </>
                  )}
                  {activeTab === 'testimonials' && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </>
                  )}
                  {activeTab === 'performance' && (
                    <>
                      <option value="new">New</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="wont_fix">Won't Fix</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {activeTab === 'feedback' && filteredFeedback.map((item) => (
                <div key={item.id} className="border border-white/10 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'new' ? 'bg-blue-100 text-blue-700' :
                          item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          item.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {item.status}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300">
                          {item.category}
                        </span>
                      </div>
                      {item.rating && (
                        <div className="flex items-center space-x-1 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < item.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-slate-300 mb-2">{item.message}</p>
                      <p className="text-sm text-slate-400">
                        {new Date(item.created_at!).toLocaleDateString()} at {new Date(item.created_at!).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUpdateFeedbackStatus(item.id!, 'reviewed')}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => handleUpdateFeedbackStatus(item.id!, 'in_progress')}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                    >
                      In Progress
                    </button>
                    <button
                      onClick={() => handleUpdateFeedbackStatus(item.id!, 'resolved')}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}

              {activeTab === 'testimonials' && filteredTestimonials.map((item) => (
                <div key={item.id} className="border border-white/10 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {item.avatar_initials}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            item.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            item.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.approval_status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">
                          {item.position && `${item.position}, `}{item.company} {item.fleet_size && `(${item.fleet_size})`}
                        </p>
                        <p className="text-slate-300 mb-2 italic">"{item.quote}"</p>
                        {item.savings_metric && (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                            {item.savings_metric}
                          </span>
                        )}
                        <p className="text-sm text-slate-400 mt-2">
                          {new Date(item.created_at!).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {item.approval_status === 'pending' && (
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => handleUpdateTestimonialStatus(item.id!, 'approved')}
                        className="flex items-center space-x-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleUpdateTestimonialStatus(item.id!, 'rejected')}
                        className="flex items-center space-x-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <XSquare className="h-4 w-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {activeTab === 'performance' && filteredPerformance.map((item) => (
                <div key={item.id} className="border border-white/10 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          item.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          item.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                          item.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.severity} severity
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300">
                          {item.issue_type}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'new' ? 'bg-blue-100 text-blue-700' :
                          item.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                          item.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-slate-300 mb-2">{item.description}</p>
                      {item.error_message && (
                        <pre className="text-sm bg-slate-800 p-2 rounded mb-2 overflow-x-auto">
                          {item.error_message}
                        </pre>
                      )}
                      <div className="text-sm text-slate-400 space-y-1">
                        <p><span className="font-medium">Page:</span> {item.page_url}</p>
                        {item.browser && <p><span className="font-medium">Browser:</span> {item.browser}</p>}
                        <p className="text-slate-400">
                          {new Date(item.created_at!).toLocaleDateString()} at {new Date(item.created_at!).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUpdatePerformanceStatus(item.id!, 'investigating')}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                    >
                      Investigating
                    </button>
                    <button
                      onClick={() => handleUpdatePerformanceStatus(item.id!, 'resolved')}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleUpdatePerformanceStatus(item.id!, 'wont_fix')}
                      className="px-3 py-1 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Won't Fix
                    </button>
                  </div>
                </div>
              ))}

              {activeTab === 'feedback' && filteredFeedback.length === 0 && (
                <div className="text-center py-12 text-slate-400">No feedback found</div>
              )}
              {activeTab === 'testimonials' && filteredTestimonials.length === 0 && (
                <div className="text-center py-12 text-slate-400">No testimonials found</div>
              )}
              {activeTab === 'performance' && filteredPerformance.length === 0 && (
                <div className="text-center py-12 text-slate-400">No performance reports found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackManagementDashboard;
