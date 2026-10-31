import React, { useState, useEffect } from 'react';
import { Mail, Check, X, Clock, Plus, AlertTriangle, Copy, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DriverInvitation, getDriverInvitations, inviteDriver, cancelInvitation, resendInvitation } from '../api/driverInvitations';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const DriverInvitationManagement: React.FC = () => {
  const { profile, user } = useAuth();
  const [invitations, setInvitations] = useState<DriverInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newInvite, setNewInvite] = useState({
    email: '',
    firstName: '',
    lastName: '',
    employeeType: 'employee' as 'employee' | 'contractor'
  });
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');

  useEffect(() => {
    if (profile === undefined) return; // still loading auth context
    if (!profile?.organization_id) {
      // Profile loaded but no org assigned — clear spinner immediately
      setLoading(false);
      setError('Your account is not linked to an organization. Contact your administrator.');
      return;
    }
    loadInvitations();
  }, [profile?.organization_id, profile]);

  const loadInvitations = async () => {
    setLoading(true);
    setError('');

    // Safety-net: if the fetch hangs for >10s, surface an error
    const timeout = setTimeout(() => {
      setLoading(false);
      setError('Request timed out. Check your connection and try again.');
    }, 10000);

    try {
      const data = await getDriverInvitations(profile!.organization_id!);
      setInvitations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invitations');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !user?.id) return;

    try {
      setInviting(true);
      setError('');
      setInviteSuccessMsg('');
      
      await inviteDriver(
        profile.organization_id,
        newInvite.email,
        newInvite.firstName,
        newInvite.lastName,
        newInvite.employeeType,
        user.id
      );
      
      setShowInviteModal(false);
      setNewInvite({ email: '', firstName: '', lastName: '', employeeType: 'employee' });
      setInviteSuccessMsg(`Invitation sent successfully to ${newInvite.email}.`);
      loadInvitations();
    } catch (err: any) {
      // If invitation was created but email failed, we still want to reload the list
      const serverError = err.response?.data?.error || err.message || '';
      const serverWarning = err.response?.data?.message || err.message || '';
      
      if (serverError.includes('could not be delivered') || serverWarning.includes('email could not be sent') || serverWarning.includes('Invitation created, but')) {
        setError('');
        setShowInviteModal(false);
        setNewInvite({ email: '', firstName: '', lastName: '', employeeType: 'employee' });
        loadInvitations();
        const tokenStr = err.response?.data?.data?.token || '';
        if (tokenStr) {
           setInviteSuccessMsg(`Invitation created but email failed. You can copy the link manually.`);
        } else {
           setInviteSuccessMsg(`Invitation created but email failed.`);
        }
      } else {
        setError(serverError || 'Failed to send invitation');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (id: string) => {
    if (!profile?.organization_id || !user?.id) return;
    try {
      setResendingId(id);
      setError('');
      setInviteSuccessMsg('');
      
      await resendInvitation(id, profile.organization_id, user.id);
      
      setInviteSuccessMsg('Invitation resent successfully.');
      loadInvitations();
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.message || '';
      setError(serverError || 'Failed to resend invitation');
      if (serverError.includes('could not be delivered')) {
        loadInvitations(); // Reload list even if email failed
      }
    } finally {
      setResendingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      await cancelInvitation(id);
      loadInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invitation');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error && invitations.length === 0) return (
    <div className="p-6 flex flex-col items-center space-y-4">
      <p className="text-red-600 font-medium">{error}</p>
      {profile?.organization_id && (
        <button
          onClick={loadInvitations}
          className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-bg p-6 sm:p-8 space-y-6 max-w-[1600px] mx-auto selection:bg-brand-accent/30 selection:text-brand-accent">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Driver Invitations</h1>
          <p className="text-slate-300 mt-1">Manage pending invites for your drivers</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center space-x-2 bg-brand-accent text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Invite Driver</span>
        </button>
      </div>

      {error && <ErrorMessage message={error} />}
      {inviteSuccessMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-center mb-4">
          <Clock className="h-5 w-5 mr-2" />
          {inviteSuccessMsg}
        </div>
      )}

      <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-brand-bg-secondary text-white uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Driver</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Sent On</th>
                <th className="px-6 py-4 font-medium">Expires</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-brand-bg-secondary">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{inv.first_name} {inv.last_name}</div>
                    <div className="text-brand-muted">{inv.email}</div>
                  </td>
                  <td className="px-6 py-4 capitalize">{inv.employee_type}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                      inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-brand-muted">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-brand-muted">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {(inv.status === 'PENDING' || inv.status === 'EXPIRED' || inv.status === 'CANCELLED') && (
                      <button
                        onClick={() => handleResend(inv.id)}
                        disabled={resendingId === inv.id}
                        className="text-blue-600 hover:text-blue-900 font-medium disabled:opacity-50"
                      >
                        {resendingId === inv.id ? 'Resending...' : 'Resend'}
                      </button>
                    )}
                    {inv.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/accept-invitation?token=${inv.token}`;
                            navigator.clipboard.writeText(url);
                            setInviteSuccessMsg('Invite link copied to clipboard!');
                          }}
                          className="text-emerald-600 hover:text-emerald-900 font-medium ml-3 flex items-center inline-flex"
                          title="Copy manual invite link"
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Copy Link
                        </button>
                        <button
                          onClick={() => handleCancel(inv.id)}
                          className="text-red-600 hover:text-red-900 font-medium ml-3"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-brand-muted">
                    No invitations found. Click "Invite Driver" to send one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-bg-secondary text-white border-brand-border rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-brand-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Invite New Driver</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-brand-muted hover:text-slate-300">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newInvite.firstName}
                    onChange={(e) => setNewInvite({ ...newInvite, firstName: e.target.value })}
                    className="w-full p-2 border border-brand-border rounded-lg bg-brand-bg-secondary text-white [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newInvite.lastName}
                    onChange={(e) => setNewInvite({ ...newInvite, lastName: e.target.value })}
                    className="w-full p-2 border border-brand-border rounded-lg bg-brand-bg-secondary text-white [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  className="w-full p-2 border border-brand-border rounded-lg bg-brand-bg-secondary text-white [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Driver Type</label>
                <select
                  value={newInvite.employeeType}
                  onChange={(e) => setNewInvite({ ...newInvite, employeeType: e.target.value as 'employee' | 'contractor' })}
                  className="w-full p-2 border border-brand-border rounded-lg bg-brand-bg-secondary text-white [color-scheme:dark]"
                >
                  <option value="employee">W-2 Employee</option>
                  <option value="contractor">1099 Independent Contractor</option>
                </select>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2 px-4 border border-brand-border text-white rounded-lg hover:bg-brand-bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 py-2 px-4 bg-brand-accent text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center"
                >
                  {inviting ? <LoadingSpinner /> : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverInvitationManagement;
