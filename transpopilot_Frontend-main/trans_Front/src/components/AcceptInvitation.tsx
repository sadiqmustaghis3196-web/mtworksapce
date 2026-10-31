import React, { useState, useEffect } from 'react';
import { Mail, Check, AlertTriangle, Key } from 'lucide-react';
import { validateInvitationToken, acceptInvitation } from '../api/driverInvitations';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const AcceptInvitation: React.FC<{ token: string, onNavigate: (tab: string) => void }> = ({ token, onNavigate }) => {
  const { refreshProfile, user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<any>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await validateInvitationToken(token);
      if (!data) throw new Error("Invalid or expired invitation token.");
      if (data.status !== 'PENDING') throw new Error(`This invitation has already been ${data.status.toLowerCase()}.`);
      if (new Date(data.expires_at) < new Date()) throw new Error("This invitation has expired.");
      
      // If user is logged in but emails don't match, show an error.
      if (user && user.email?.toLowerCase() !== data.email.toLowerCase()) {
         throw new Error(`You are logged in as ${user.email}, but this invitation is for ${data.email}. Please log out to accept it.`);
      }

      setInvitation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to validate invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');

      let authUserId = user?.id;
      
      if (!authUserId) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: invitation.email,
          password: password,
          options: {
            data: {
              full_name: `${invitation.first_name} ${invitation.last_name}`
            }
          }
        });

        if (signUpError) {
           if (signUpError.message.includes('already registered')) {
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: invitation.email,
                password: password,
              });
              if (signInError) throw new Error('Account exists, but password was incorrect. Please try again.');
              authUserId = signInData.user?.id;
           } else {
             throw signUpError;
           }
        } else {
          if (!signUpData.user) throw new Error('Failed to create user');
          authUserId = signUpData.user.id;
          
          if (!signUpData.session) {
             const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: invitation.email,
                password: password,
             });
             if (!signInError && signInData.session) {
               authUserId = signInData.user.id;
             }
          }
        }
      }

      if (!authUserId) throw new Error('Authentication failed');

      // 2. Call the backend to link the role and driver record
      await acceptInvitation(token, authUserId);

      // 3. Refresh AuthContext profile
      await refreshProfile();
      
      setSuccess(true);
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        onNavigate('dashboard');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner /></div>;

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => onNavigate('landing')}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-green-200 p-8 text-center">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-600 mb-6">Your account has been created successfully. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-6 text-white text-center">
          <Key className="h-10 w-10 text-blue-100 mx-auto mb-3" />
          <h2 className="text-2xl font-bold">Create Your Account</h2>
          <p className="text-blue-100 mt-1">Complete your registration</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && <ErrorMessage message={error} />}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              disabled
              value={invitation?.email}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              disabled
              value={`${invitation?.first_name} ${invitation?.last_name}`}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
            />
          </div>

          {!user && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Create Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mt-4"
          >
            {submitting ? <LoadingSpinner /> : user ? 'Accept Invitation' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvitation;
