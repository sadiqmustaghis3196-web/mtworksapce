# Quick Fix: "Load Fail" Error

## Problem
Users see "load fail" errors when accessing the deployed app.

## Root Cause
Missing Supabase environment variables in deployment.

## Quick Fix (2 Minutes)

### Step 1: Get Credentials
1. Go to https://app.supabase.com
2. Click Settings → API
3. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ`)

### Step 2: Add to Platform

#### Vercel
```
Dashboard → Settings → Environment Variables → Add
```
Add these two:
```
VITE_SUPABASE_URL = [paste your URL]
VITE_SUPABASE_ANON_KEY = [paste your key]
```

#### Netlify
```
Site → Site settings → Environment variables → Add
```
Add these two:
```
VITE_SUPABASE_URL = [paste your URL]
VITE_SUPABASE_ANON_KEY = [paste your key]
```

### Step 3: Redeploy
Click "Trigger deploy" or push to git

### Step 4: Verify
Visit: `https://your-app.com/diagnostics`

All checks should be ✅ green

---

## Checklist
- [ ] Got Supabase URL and anon key
- [ ] Added both env vars to hosting platform
- [ ] Redeployed the app
- [ ] Visited `/diagnostics` - all green
- [ ] Tested login and data loading - works!

---

**Still having issues?** See [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)
