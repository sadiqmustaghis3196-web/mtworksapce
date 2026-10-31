import React, { useEffect, useState } from 'react';
import { 
  Users, Truck, TrendingUp, Activity, Shield, 
  MessageSquare, Edit2, Trash2, AlertTriangle, 
  CheckCircle2, Loader2, X, Mail, Phone, Building2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getContactSubmissions } from '../api/contactSubmissions'; 

const AdminDashboardPage: React.FC = () => {
  const { isAdmin, isSuperAdmin, profile } = useAuth();
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    activeRoutes: 0,
  });
  
  const [inquiries, setInquiries] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // --- Modals State ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // --- Forms & Selections ---
  const [inquiryForm, setInquiryForm] = useState({ id: '', name: '', email: '', phone: '', company: '', message: '' });
  const [inquiryToDelete, setInquiryToDelete] = useState<{ id: string, name: string } | null>(null);

  // --- Loading & Messages ---
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      let userQuery = supabase.from('user_profiles').select('*', { count: 'exact', head: true });
      let vehicleQuery = supabase.from('vehicles').select('*', { count: 'exact', head: true });
      let driverQuery = supabase.from('drivers').select('*', { count: 'exact', head: true });
      let routeQuery = supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'active');

      if (!isSuperAdmin() && profile?.organization_id) {
        userQuery = userQuery.eq('organization_id', profile.organization_id);
        vehicleQuery = vehicleQuery.eq('organization_id', profile.organization_id);
        driverQuery = driverQuery.eq('organization_id', profile.organization_id);
        routeQuery = routeQuery.eq('organization_id', profile.organization_id);
      }

      const { count: userCount } = await userQuery;
      const { count: vehicleCount } = await vehicleQuery;
      const { count: driverCount } = await driverQuery;
      const { count: routeCount } = await routeQuery;

      setStats({
        totalUsers: userCount || 0,
        totalVehicles: vehicleCount || 0,
        totalDrivers: driverCount || 0,
        activeRoutes: routeCount || 0,
      });

      // Fetch Client Inquiries
      const inquiriesData = await getContactSubmissions();
      setInquiries(inquiriesData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // --- UPDATE INQUIRY ---
  const openEditModal = (req: any) => {
    setInquiryForm({
      id: req.id,
      name: req.name || '',
      email: req.email || '',
      phone: req.phone || '',
      company: req.company || '',
      message: req.message || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      // Note: Make sure your table name in supabase is exactly 'contact_submissions'
      const { error } = await supabase
        .from('contact_submissions')
        .update({
          name: inquiryForm.name,
          email: inquiryForm.email,
          phone: inquiryForm.phone,
          company: inquiryForm.company,
          message: inquiryForm.message
        })
        .eq('id', inquiryForm.id);

      if (error) throw error;

      showFeedback('success', 'Inquiry details updated successfully!');
      setShowEditModal(false);
      fetchDashboardData();
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to update inquiry.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- DELETE INQUIRY ---
  const openDeleteModal = (req: any) => {
    setInquiryToDelete({ id: req.id, name: req.name });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!inquiryToDelete) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('id', inquiryToDelete.id);

      if (error) throw error;

      showFeedback('success', 'Inquiry removed successfully!');
      setShowDeleteModal(false);
      setInquiryToDelete(null);
      fetchDashboardData();
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to delete inquiry.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center">
          <AlertTriangle className="text-red-500 mr-3" />
          <div>
            <h2 className="text-xl font-bold text-red-900 mb-1">Access Denied</h2>
            <p className="text-red-700">You do not have admin permissions to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#05070f] min-h-screen">
      
      {/* Global Feedback Message */}
      {feedbackMessage && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-start animate-slideDown max-w-sm border ${
          feedbackMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-500 mr-3 shrink-0" />}
          <p className={`text-sm font-bold ${feedbackMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {feedbackMessage.text}
          </p>
        </div>
      )}

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center">
          <Shield className="h-8 w-8 mr-3 text-blue-600" />
          Admin Dashboard
        </h1>
        <p className="text-slate-400 mt-1 font-medium">Manage client inquiries and view platform statistics</p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/60 rounded-2xl shadow-sm border border-white/10 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="h-6 w-6" /></div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.totalUsers}</div>
          <div className="text-sm font-medium text-slate-400 mt-1">Total Users</div>
        </div>

        <div className="bg-slate-900/60 rounded-2xl shadow-sm border border-white/10 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Truck className="h-6 w-6" /></div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.totalVehicles}</div>
          <div className="text-sm font-medium text-slate-400 mt-1">Total Vehicles</div>
        </div>

        <div className="bg-slate-900/60 rounded-2xl shadow-sm border border-white/10 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Users className="h-6 w-6" /></div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.totalDrivers}</div>
          <div className="text-sm font-medium text-slate-400 mt-1">Total Drivers</div>
        </div>

        <div className="bg-slate-900/60 rounded-2xl shadow-sm border border-white/10 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Activity className="h-6 w-6" /></div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.activeRoutes}</div>
          <div className="text-sm font-medium text-slate-400 mt-1">Active Routes</div>
        </div>
      </div>

      {/* CONTACT INQUIRIES (CRUD TABLE) */}
      <div className="bg-slate-900/60 rounded-2xl shadow-sm border border-white/10 mt-6 overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-[#05070f] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center">
              <MessageSquare className="h-6 w-6 mr-2 text-blue-600" />
              Client Inquiries & Bookings
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">Review, update, and manage contact form submissions</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#05070f] border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Date</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Client Info</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Message</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">No inquiries or bookings yet.</td>
                </tr>
              ) : (
                inquiries.map((req) => (
                  <tr key={req.id} className="hover:bg-[#05070f]/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-medium">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-base">{req.name}</div>
                      {req.company && req.company !== 'N/A' && (
                        <div className="text-xs font-bold text-blue-600 mb-1 flex items-center">
                          <Building2 className="h-3 w-3 mr-1" /> {req.company}
                        </div>
                      )}
                      <div className="text-xs font-medium text-slate-400 mt-1 flex flex-col space-y-1">
                        <span className="flex items-center"><Mail className="h-3 w-3 mr-1"/> {req.email}</span>
                        {req.phone && <span className="flex items-center"><Phone className="h-3 w-3 mr-1"/> {req.phone}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm leading-relaxed max-w-md">
                      {req.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => openEditModal(req)}
                          className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm"
                          title="Edit Inquiry"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(req)}
                          className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all shadow-sm"
                          title="Delete Inquiry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === MODALS SECTION === */}

      {/* 1. Edit Inquiry Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/60 rounded-[2rem] shadow-2xl max-w-lg w-full p-8 relative animate-slideDown border border-white/5">
            <button onClick={() => setShowEditModal(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-full transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Edit2 className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Edit Inquiry</h2>
                <p className="text-sm font-medium text-slate-400">Update client contact details</p>
              </div>
            </div>
            <form onSubmit={handleUpdateInquiry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Full Name</label>
                  <input type="text" required value={inquiryForm.name} onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Company</label>
                  <input type="text" value={inquiryForm.company} onChange={(e) => setInquiryForm({ ...inquiryForm, company: e.target.value })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Email Address</label>
                  <input type="email" required value={inquiryForm.email} onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Phone Number</label>
                  <input type="text" value={inquiryForm.phone} onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Message</label>
                <textarea rows={4} required value={inquiryForm.message} onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium resize-none"></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 bg-slate-900/60 border border-white/10 text-slate-300 rounded-xl font-bold hover:bg-[#05070f] transition-colors">Cancel</button>
                <button type="submit" disabled={actionLoading} className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] disabled:opacity-50 flex items-center justify-center">
                  {actionLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/60 rounded-[2rem] shadow-2xl max-w-md w-full p-8 relative animate-slideDown border border-white/5 text-center">
            <div className="mx-auto w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border-4 border-red-100">
              <Trash2 className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">Delete Inquiry?</h2>
            <p className="text-slate-400 font-medium mb-8 leading-relaxed">
              Are you sure you want to permanently delete the inquiry from <span className="font-bold text-white">{inquiryToDelete?.name}</span>? This action is irreversible.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-3.5 bg-[#05070f] border border-white/10 text-slate-300 rounded-xl font-bold hover:bg-slate-800 transition-colors">Cancel</button>
              <button type="button" onClick={handleConfirmDelete} disabled={actionLoading} className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] disabled:opacity-50 flex items-center justify-center">
                {actionLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Yes, Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-slideDown { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default AdminDashboardPage;