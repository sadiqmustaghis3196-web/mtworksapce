import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiConfig';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  Truck, 
  Activity, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  X,
  Mail
} from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  last_sign_in_at: string | null;
  created_at: string;
}

const SuperAdminPanel: React.FC = () => {
  const { user, isSuperAdmin, session } = useAuth(); // Current logged in user
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    totalRoutes: 0
  });
  
  // Organizations list for assignment
  const [organizations, setOrganizations] = useState<{ id: string, name: string }[]>([]);

  // --- Modals State ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // --- Forms & Selections ---
  const [editForm, setEditForm] = useState({ 
    id: '', 
    email: '', 
    fullName: '', 
    role: 'user',
    organizationId: '',
    newOrganizationName: ''
  });
  const [userToDelete, setUserToDelete] = useState<{ id: string, name: string } | null>(null);

  // --- Loading & Messages ---
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData as UserProfile[]);

      // 2. Fetch Stats Counts
      const { count: vehicleCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
      const { count: driverCount } = await supabase.from('drivers').select('*', { count: 'exact', head: true });
      const { count: routeCount } = await supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'active');

      setStats({
        totalUsers: usersData?.length || 0,
        totalVehicles: vehicleCount || 0,
        totalDrivers: driverCount || 0,
        totalRoutes: routeCount || 0
      });

      // 3. Fetch Organizations
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (orgsData) setOrganizations(orgsData);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // --- UPDATE USER (CRUD) ---
  const openEditModal = (targetUser: UserProfile) => {
    setEditForm({
      id: targetUser.id,
      email: targetUser.email || '',
      fullName: targetUser.full_name || '',
      role: targetUser.role || 'user',
      // @ts-ignore - organization_id is fetched but not in interface yet
      organizationId: targetUser.organization_id || '',
      newOrganizationName: ''
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${editForm.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: editForm.role,
          full_name: editForm.fullName,
          organization_id: editForm.organizationId === 'NEW' ? null : editForm.organizationId,
          new_organization_name: editForm.organizationId === 'NEW' ? editForm.newOrganizationName : null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user role.');
      }

      showFeedback('success', 'User profile and role updated successfully!');
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to update user.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- DELETE USER (CRUD) ---
  const openDeleteModal = (targetUser: UserProfile) => {
    setUserToDelete({ id: targetUser.id, name: targetUser.full_name || targetUser.email });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setActionLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/super-admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete user.');
      }

      showFeedback('success', 'User permanently removed from the system.');
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      showFeedback('error', 'Unable to remove this user. No changes were made.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- HELPER FOR BADGES ---
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-full shadow-sm">Super Admin</span>;
      case 'admin':
        return <span className="px-3 py-1 text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 rounded-full">Admin</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold bg-slate-800 text-slate-300 border border-white/10 rounded-full">User</span>;
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex items-center shadow-sm">
          <AlertTriangle className="text-red-500 mr-4 h-10 w-10" />
          <div>
            <h2 className="text-2xl font-black text-red-900 mb-1">Access Restricted</h2>
            <p className="text-red-700 font-medium">This panel is strictly for Super Administrators. You do not have clearance to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-[#05070f] min-h-screen">
      
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

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <ShieldCheck className="h-10 w-10 text-orange-600" />
          Super Admin Control Panel
        </h1>
        <p className="text-slate-400 mt-2 font-medium text-lg">Manage platform-wide settings, user roles, and view global statistics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/60 p-6 rounded-2xl shadow-sm border border-white/10 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Users</p>
              <h3 className="text-4xl font-black text-white mt-2">{stats.totalUsers}</h3>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-6 rounded-2xl shadow-sm border border-white/10 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Vehicles</p>
              <h3 className="text-4xl font-black text-white mt-2">{stats.totalVehicles}</h3>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <Truck className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-6 rounded-2xl shadow-sm border border-white/10 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Drivers</p>
              <h3 className="text-4xl font-black text-white mt-2">{stats.totalDrivers}</h3>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-6 rounded-2xl shadow-sm border border-white/10 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Routes</p>
              <h3 className="text-4xl font-black text-white mt-2">{stats.totalRoutes}</h3>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl">
              <Activity className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-slate-900/60 rounded-2xl shadow-sm border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-[#05070f] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-orange-600" />
              Global User Management
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">Full CRUD access to modify roles, update names, or remove accounts entirely.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#05070f] border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">User Identity</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Current Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Joined Date</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900/60 divide-y divide-slate-800">
              {users.map((u) => {
                const isCurrentUser = user?.id === u.id;

                return (
                  <tr key={u.id} className="hover:bg-[#05070f]/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold shadow-sm">
                          {u.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-white">
                            {u.full_name || 'Unknown'} 
                            {isCurrentUser && <span className="ml-2 text-[10px] bg-slate-200 text-slate-400 px-2 py-0.5 rounded-md">You</span>}
                          </div>
                          <div className="text-xs font-medium text-slate-400 flex items-center mt-0.5">
                            <Mail className="h-3 w-3 mr-1" /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(u.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-400">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Never Logged In'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-400">
                      {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(u)}
                          className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm"
                          title="Edit User Role & Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        
                        {!isCurrentUser ? (
                          <button 
                            onClick={() => openDeleteModal(u)}
                            className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all shadow-sm"
                            title="Delete User Permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="p-2.5 w-9"></div> /* Placeholder to keep alignment if it's the current user */
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* === MODALS SECTION === */}

      {/* 1. Edit / Update Role Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/60 rounded-[2rem] shadow-2xl max-w-md w-full p-8 relative animate-slideDown border border-white/5">
            <button onClick={() => setShowEditModal(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-full transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Edit2 className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Modify User</h2>
                <p className="text-sm font-medium text-slate-400">Update identity and access levels</p>
              </div>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Registered Email</label>
                <input type="email" disabled value={editForm.email} className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-slate-400 font-medium cursor-not-allowed" />
                <p className="text-xs text-slate-400 mt-1">Emails cannot be changed for security reasons.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Full Name</label>
                <input type="text" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Platform Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })} className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-white">
                  <option value="user">User (Basic Access)</option>
                  <option value="admin">Admin (Company Admin)</option>
                  <option value="super_admin">Super Admin (System Admin)</option>
                </select>
                {editForm.role === 'super_admin' && (
                  <p className="text-xs text-red-400 mt-2 flex items-start bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                    Warning: Granting Super Admin provides full system access across all organizations.
                  </p>
                )}
              </div>

              {(editForm.role === 'admin' || editForm.role === 'super_admin') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Organization</label>
                  <select 
                    value={editForm.organizationId || ''} 
                    onChange={(e) => setEditForm({ ...editForm, organizationId: e.target.value })} 
                    className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium mb-3 text-white"
                  >
                    <option value="" disabled>Select an Organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                    <option value="NEW">+ Create New Organization</option>
                  </select>
                  
                  {editForm.organizationId === 'NEW' && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-slate-400 mb-2">New Organization Name</label>
                      <input 
                        type="text" 
                        value={editForm.newOrganizationName} 
                        onChange={(e) => setEditForm({ ...editForm, newOrganizationName: e.target.value })}
                        placeholder="Enter company name"
                        className="w-full px-4 py-3 bg-[#05070f] border border-white/10 rounded-xl focus:bg-slate-900/60 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-white"
                        required={editForm.organizationId === 'NEW'}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-3 pt-6 mt-6 border-t border-white/10">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 bg-slate-900/60 border border-white/10 text-slate-300 rounded-xl font-bold hover:bg-[#05070f] transition-colors">Cancel</button>
                <button type="submit" disabled={actionLoading} className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] disabled:opacity-50 flex items-center justify-center">
                  {actionLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Modifications'}
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
            <h2 className="text-3xl font-black text-white mb-2">Obliterate Record?</h2>
            <p className="text-slate-400 font-medium mb-8 leading-relaxed">
              Are you absolutely certain you want to permanently delete <span className="font-bold text-white">{userToDelete?.name}</span>? This action is irreversible and they will instantly lose all access.
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

export default SuperAdminPanel;