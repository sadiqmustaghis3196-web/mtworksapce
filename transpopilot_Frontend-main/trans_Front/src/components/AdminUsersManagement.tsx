import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, RefreshCw, UserCheck, UserX, AlertCircle,
  CheckCircle2, Clock, Truck, Mail, Calendar, Shield, ChevronRight,
  UserCog, Loader2, Plus, X, Link as LinkIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getOrganizationUsers, makeDriver, inviteTeamMember, getInviteToken, resendTeamMemberInvite, OrgUser } from '../api/adminApi';
import { cancelInvitation } from '../api/driverInvitations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-violet-900/40 text-violet-300 ring-1 ring-violet-500/30',
    super_admin: 'bg-rose-900/40 text-rose-300 ring-1 ring-rose-500/30',
    fleet_manager: 'bg-blue-900/40 text-blue-300 ring-1 ring-blue-500/30',
    dispatcher: 'bg-indigo-900/40 text-indigo-300 ring-1 ring-indigo-500/30',
    driver: 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-500/30',
    user: 'bg-slate-700/50 text-slate-300 ring-1 ring-slate-500/30',
  };
  return map[role] || map.user;
}

function invBadge(status: string | null) {
  if (!status) return 'bg-slate-800 text-slate-500 text-xs px-2 py-0.5 rounded-full';
  const map: Record<string, string> = {
    PENDING: 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-500/30 text-xs px-2 py-0.5 rounded-full',
    ACCEPTED: 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-500/30 text-xs px-2 py-0.5 rounded-full',
    EXPIRED: 'bg-red-900/40 text-red-300 ring-1 ring-red-500/30 text-xs px-2 py-0.5 rounded-full',
    CANCELLED: 'bg-slate-800 text-slate-400 ring-1 ring-slate-600/30 text-xs px-2 py-0.5 rounded-full',
  };
  return map[status] || map.CANCELLED;
}

function driverStatusBadge(u: OrgUser) {
  if (u.role === 'driver' || u.driver_id) {
    const s = u.driver_status || 'training';
    const map: Record<string, string> = {
      active: 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-500/30',
      training: 'bg-blue-900/40 text-blue-300 ring-1 ring-blue-500/30',
      inactive: 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-500/30',
      pending: 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-500/30',
    };
    return { label: s.charAt(0).toUpperCase() + s.slice(1), cls: map[s] || map.training };
  }
  if (u.invitation_status === 'PENDING' || u.invitation_status === 'ACCEPTED') {
    return { label: 'Pending Activation', cls: 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-500/30' };
  }
  return { label: 'Not a Driver', cls: 'bg-slate-800 text-slate-500 ring-1 ring-slate-600/30' };
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; type: 'success' | 'error'; text: string }

const Toast: React.FC<{ toasts: ToastMsg[]; remove: (id: number) => void }> = ({ toasts, remove }) => (
  <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 max-w-sm">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium
          ${t.type === 'success'
            ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
            : 'bg-red-950 border-red-700 text-red-200'}`}
      >
        {t.type === 'success'
          ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />}
        <span className="flex-1">{t.text}</span>
        <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-white ml-2">✕</button>
      </div>
    ))}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number; icon: React.FC<any>; color: string }> =
  ({ label, value, icon: Icon, color }) => (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-white">{value}</p>
        <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );

// ─── Main Component ───────────────────────────────────────────────────────────

type Filter = 'all' | 'users' | 'drivers' | 'pending';
type InvFilter = 'all' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

const AdminUsersManagement: React.FC = () => {
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Filter>('all');
  const [invFilter, setInvFilter] = useState<InvFilter>('all');
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('fleet_manager');
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);


  const addToast = useCallback((type: 'success' | 'error', text: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);


  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await inviteTeamMember(inviteEmail, inviteRole);
      addToast('success', res.message || `Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      await loadUsers(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to invite user';
      if (msg.includes('email could not be sent') || msg.includes('could not be delivered')) {
          addToast('success', 'Invitation created but email failed. You can copy the link manually.');
          setShowInviteModal(false);
          setInviteEmail('');
          await loadUsers(true);
      } else {
          addToast('error', msg);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleResendEmail = async (invitationId: string) => {
    if (resendingId) return; // prevent double-click
    setResendingId(invitationId);
    try {
      const res = await resendTeamMemberInvite(invitationId);
      if (res.success && res.emailSent) {
        addToast('success', 'Invitation email resent successfully.');
      } else {
        addToast('error', res.warning || res.message || 'Unable to resend invitation email. Use Copy Link instead.');
      }
    } catch (err: any) {
      const backendError = err.response?.data?.message || err.response?.data?.error;
      addToast('error', backendError || 'Unable to resend invitation email. Use Copy Link instead.');
    } finally {
      setResendingId(null);
    }
  };

  const handleCopyLink = async (invitationId: string) => {
    try {
      const token = await getInviteToken(invitationId);
      const url = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(url);
      addToast('success', 'Invite link copied to clipboard!');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to copy link');
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      await cancelInvitation(invitationId);
      addToast('success', 'Invitation cancelled.');
      await loadUsers(true);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to cancel invitation');
    }
  };

  const loadUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getOrganizationUsers();
      setUsers(data);
    } catch (err: any) {
      const status = err.response?.status;
      let errorMsg = 'Unable to load users right now.';
      if (status === 401) {
        errorMsg = 'Your session has expired. Please log in again.';
      } else if (status === 403) {
        errorMsg = "You don't have permission to manage users.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast('error', errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleMakeDriver = async (user: OrgUser) => {
    if (promotingId) return; // prevent double-click
    setPromotingId(user.id);
    try {
      await makeDriver(user.id);
      addToast('success', `${user.full_name || user.email} has been promoted to Driver.`);
      await loadUsers(true); // refresh from DB
    } catch (err: any) {
      const msg = err.message || 'Failed to promote user';
      // 409 means already a driver — still a non-critical outcome
      if (err.response?.status === 409) {
        addToast('error', 'This user is already a driver. Refreshing list...');
        await loadUsers(true);
      } else {
        addToast('error', msg);
      }
    } finally {
      setPromotingId(null);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);

    const isDriver = u.role === 'driver' || !!u.driver_id;
    const isPending =
      !isDriver &&
      (u.invitation_status === 'PENDING' || u.invitation_status === 'ACCEPTED');

    const matchRole =
      roleFilter === 'all' ||
      (roleFilter === 'drivers' && isDriver) ||
      (roleFilter === 'users' && !isDriver && u.role !== 'admin' && u.role !== 'super_admin') ||
      (roleFilter === 'pending' && isPending);

    const matchInv =
      invFilter === 'all' ||
      u.invitation_status === invFilter;

    return matchSearch && matchRole && matchInv;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total: users.length,
    drivers: users.filter(u => u.role === 'driver' || !!u.driver_id).length,
    pending: users.filter(u => {
      const isDriver = u.role === 'driver' || !!u.driver_id;
      return !isDriver && (u.invitation_status === 'PENDING' || u.invitation_status === 'ACCEPTED');
    }).length,
    users: users.filter(u => {
      const isDriver = u.role === 'driver' || !!u.driver_id;
      return !isDriver && u.role !== 'admin' && u.role !== 'super_admin';
    }).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-[#05070f] flex items-center justify-center p-6">
        <div className="bg-red-950/40 border border-red-700/30 rounded-2xl p-8 text-center max-w-md">
          <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">You need admin permissions to access User Management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070f] p-4 sm:p-8 font-sans max-w-[1600px] mx-auto">
      <Toast toasts={toasts} remove={removeToast} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6
        bg-slate-900/60 p-6 sm:p-8 rounded-[2rem] border border-white/5 relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/60 border border-blue-500/20 mb-4">
            <UserCog className="h-4 w-4 text-blue-400" />
            <span className="text-blue-300 text-xs font-bold tracking-wide uppercase">Organization</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            User Management
          </h1>
          <p className="text-slate-400 font-medium max-w-xl">
            View and manage all registered users in your organization. Promote users to drivers and manage the complete driver lifecycle.
          </p>
        </div>
        <div className="relative z-10">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-accent hover:bg-blue-600 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 mr-3"
          >
            <Plus className="h-4 w-4" />
            Invite Team Member
          </button>
          <button
            onClick={() => loadUsers(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.total} icon={Users} color="bg-blue-900/40 text-blue-300" />
        <StatCard label="Active Drivers" value={stats.drivers} icon={UserCheck} color="bg-emerald-900/40 text-emerald-300" />
        <StatCard label="Pending Activation" value={stats.pending} icon={Clock} color="bg-amber-900/40 text-amber-300" />
        <StatCard label="Non-Driver Users" value={stats.users} icon={UserX} color="bg-slate-700/60 text-slate-300" />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl
              text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Role filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'users', 'drivers', 'pending'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                ${roleFilter === f
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
            >
              {f === 'all' ? 'All' : f === 'users' ? 'Non-Drivers' : f === 'pending' ? 'Pending' : 'Drivers'}
            </button>
          ))}
        </div>

        {/* Invitation filter */}
        <select
          value={invFilter}
          onChange={e => setInvFilter(e.target.value as InvFilter)}
          className="px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-slate-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="all">All Invitations</option>
          <option value="PENDING">Inv: Pending</option>
          <option value="ACCEPTED">Inv: Accepted</option>
          <option value="EXPIRED">Inv: Expired</option>
          <option value="CANCELLED">Inv: Cancelled</option>
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="text-slate-400 font-medium">Loading organization users...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-12 text-center">
          <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 font-semibold text-lg">No users found</p>
          <p className="text-slate-500 mt-1 text-sm">
            {search || roleFilter !== 'all' || invFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'No users are registered in your organization yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const isDriver = u.role === 'driver' || !!u.driver_id;
            const isAdmin2 = u.role === 'admin' || u.role === 'super_admin';
            const isPromoting = promotingId === u.id;
            const driverBadge = driverStatusBadge(u);
            const displayName = u.full_name || u.email.split('@')[0];

            return (
              <div
                key={u.id}
                className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:border-white/10
                  transition-all hover:shadow-lg hover:shadow-black/20 group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                  {/* Avatar + identity */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold shrink-0
                      ${isDriver
                        ? 'bg-emerald-900/40 text-emerald-300'
                        : isAdmin2
                        ? 'bg-violet-900/40 text-violet-300'
                        : 'bg-slate-800 text-slate-300'}`}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-base">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                        <p className="text-slate-400 text-xs truncate">{u.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 lg:min-w-[400px]">
                    {/* Role */}
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${roleBadge(u.role)}`}>
                      {u.role.replace('_', ' ')}
                    </span>

                    {/* Driver status */}
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${driverBadge.cls}`}>
                      {driverBadge.label}
                    </span>

                    {/* Invitation status */}
                    {u.invitation_status && (
                      <span className={invBadge(u.invitation_status)}>
                        Inv: {u.invitation_status}
                      </span>
                    )}

                    {/* Created date */}
                    <div className="flex items-center gap-1 text-slate-500 text-xs ml-auto">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(u.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(u as any).is_pure_invite || u.invitation_status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <button
                          id={`resend-invite-${u.invitation_id || u.id}`}
                          onClick={() => handleResendEmail(u.invitation_id || u.id)}
                          disabled={resendingId === (u.invitation_id || u.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-900/30 border border-blue-700/30 text-blue-300 hover:bg-blue-800/40 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Resend invitation email"
                        >
                          {resendingId === (u.invitation_id || u.id) ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Mail className="h-3.5 w-3.5" />
                              Resend Email
                            </>
                          )}
                        </button>
                        <button
                          id={`copy-invite-${u.invitation_id || u.id}`}
                          onClick={() => handleCopyLink(u.invitation_id || u.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-900/30 border border-emerald-700/30 text-emerald-300 hover:bg-emerald-800/40 text-xs font-bold transition-colors"
                          title="Copy manual invite link"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          Copy Link
                        </button>
                        <button
                          id={`cancel-invite-${u.invitation_id || u.id}`}
                          onClick={() => handleCancelInvite(u.invitation_id || u.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-900/30 border border-red-700/30 text-red-300 hover:bg-red-800/40 text-xs font-bold transition-colors"
                          title="Cancel invitation"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </div>
                    ) : !isDriver && !isAdmin2 ? (
                      <button
                        id={`make-driver-${u.id}`}
                        onClick={() => handleMakeDriver(u)}
                        disabled={!!promotingId}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all
                          ${isPromoting
                            ? 'bg-blue-900/40 text-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5'
                          } disabled:opacity-60`}
                      >
                        {isPromoting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Promoting…
                          </>
                        ) : (
                          <>
                            <Truck className="h-4 w-4" />
                            Make Driver
                          </>
                        )}
                      </button>
                    ) : isDriver ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-900/30
                          border border-emerald-700/30 text-emerald-300 text-xs font-bold">
                          <UserCheck className="h-3.5 w-3.5" />
                          Driver Active
                        </div>
                        {u.driver_id && (
                          <div className="text-slate-500 text-xs font-mono px-2 py-1 bg-slate-800 rounded-lg">
                            ID: {u.driver_id.slice(0, 8)}…
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-900/30
                        border border-violet-700/30 text-violet-300 text-xs font-bold">
                        <Shield className="h-3.5 w-3.5" />
                        Admin
                      </div>
                    )}
                  </div>
                </div>

                {/* Driver detail row */}
                {isDriver && (
                  <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 mb-0.5">Employee Type</p>
                      <p className="text-slate-200 font-medium capitalize">
                        {u.driver_employee_type || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5">Onboarding</p>
                      <p className="text-slate-200 font-medium capitalize">
                        {u.driver_onboarding_status || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5">Driver Since</p>
                      <p className="text-slate-200 font-medium">{formatDate(u.driver_created_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5">Last Login</p>
                      <p className="text-slate-200 font-medium">{formatDate(u.last_login_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Results count */}
      {!loading && filtered.length > 0 && (
        <p className="text-slate-600 text-xs mt-4 text-right">
          Showing {filtered.length} of {users.length} users
        </p>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold text-white">Invite New Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleInviteSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full p-3 border border-white/10 rounded-xl bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full p-3 border border-white/10 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="fleet_manager">Fleet Manager</option>
                  <option value="dispatcher">Dispatcher</option>
                  {/* Driver is invited via the Driver Invitations page */}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  To invite a driver, please use the Drivers page.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2"
                >
                  {inviting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    'Send Invitation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
  );
};

export default AdminUsersManagement;
