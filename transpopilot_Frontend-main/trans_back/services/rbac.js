// services/rbac.js
// RBAC middleware for Express with Supabase Auth + user_profiles
// Uses the existing config/supabase.js client which already has the correct
// key fallback chain (SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SERVICE_KEY →
// SUPABASE_KEY → VITE_SUPABASE_ANON_KEY).

import { supabase as configuredSupabase } from '../config/supabase.js';

/**
 * requireRole(...allowedRoles)
 * Express middleware — enforces that req.user exists and has an allowed role.
 * Returns 401 if no authenticated user was attached.
 * Returns 403 if the user's role is not in the allowed list.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ success: false, error: 'Unauthenticated' });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

/**
 * attachSupabaseUser(req, res, next)
 * Reads the Bearer token from the Authorization header, validates it against
 * Supabase Auth, then loads the user_profiles row to get the authoritative
 * role and organization_id.
 *
 * After this middleware:
 *   req.user = { id, email, role, organization_id, full_name }
 *
 * If no Authorization header → req.user stays undefined, next() called.
 * If token is invalid/expired → req.user stays undefined, next() called.
 * Downstream requireRole() will then return 401.
 */
export async function attachSupabaseUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided — leave req.user unset, let route handlers decide
      return next();
    }

    const token = authHeader.slice(7); // strip 'Bearer '

    if (!token || token === 'undefined' || token === 'null') {
      console.warn('[rbac] Empty or invalid token string in Authorization header');
      return next();
    }

    // Validate token with the configured Supabase client
    // configuredSupabase uses SUPABASE_SERVICE_ROLE_KEY → VITE_SUPABASE_ANON_KEY
    const { data: { user }, error: authError } = await configuredSupabase.auth.getUser(token);

    if (authError || !user) {
      console.warn('[rbac] Token validation failed:', authError?.message || 'no user returned');
      return next(); // invalid token → req.user unset → requireRole returns 401
    }

    // Load user_profiles for authoritative role + organization_id
    const { data: profile, error: profileError } = await configuredSupabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(`[rbac] user_profiles query ERROR: code=${profileError.code}, message="${profileError.message}", details="${profileError.details}"`);
      // Do NOT silently fall back or downgrade role on DB / RLS errors
      return res.status(500).json({
        success: false,
        error: `Database authorization query error: ${profileError.message}`
      });
    }

    let userRole = profile?.role || 'user';
    let userOrgId = profile?.organization_id || null;

    // Fallback logic removed: user_profiles are guaranteed to be created by the handle_new_user DB trigger.
    if (!profile) {
      console.warn(`[rbac] No user_profiles row found for auth user ${user.id} (${user.email}). The handle_new_user trigger may have failed.`);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: userRole,
      organization_id: userOrgId,
      full_name: profile?.full_name || user.user_metadata?.full_name || user.email,
    };

    next();
  } catch (e) {
    console.error('[rbac] attachSupabaseUser error:', e.message);
    next(); // don't crash the server; requireRole will enforce 401
  }
}
