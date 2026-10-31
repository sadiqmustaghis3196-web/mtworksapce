# TranspoPilot AI - Turnkey SaaS Deployment Guide

## Overview

TranspoPilot AI is designed as a turnkey SaaS solution. Users can simply visit your URL, sign up, and immediately start using the platform with demo data or connect their telematics systems to sync real fleet data.

## Table of Contents

1. [Quick Deploy](#quick-deploy)
2. [Prerequisites](#prerequisites)
3. [Deployment Platforms](#deployment-platforms)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Post-Deployment](#post-deployment)
7. [User Onboarding Flow](#user-onboarding-flow)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Quick Deploy

The fastest way to deploy TranspoPilot AI:

### Option 1: Deploy to Vercel (Recommended)

```bash
# 1. Fork or clone this repository
git clone your-repo-url
cd transpopilot-ai

# 2. Install Vercel CLI
npm install -g vercel

# 3. Deploy
vercel --prod

# 4. Add environment variables in Vercel dashboard
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Option 2: Deploy to Netlify

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Build the project
npm run build

# 3. Deploy
netlify deploy --prod

# 4. Add environment variables in Netlify dashboard
```

---

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Account** (Free tier available)
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Note your Project URL and anon/public key

2. **Node.js 18+** installed locally for building

3. **Git** for version control

4. **Deployment Platform Account**
   - Vercel (recommended)
   - Netlify
   - Or any static hosting provider

---

## Deployment Platforms

### Vercel (Recommended)

**Pros:**
- Automatic deployments from Git
- Excellent performance with Edge Network
- Built-in CI/CD
- Free SSL certificates
- Great analytics

**Steps:**
1. Connect your Git repository to Vercel
2. Configure environment variables
3. Deploy with one click
4. Custom domain setup is automatic

**Environment Variables in Vercel:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Netlify

**Pros:**
- Simple deployment process
- Great for static sites
- Built-in form handling
- Free SSL certificates

**Steps:**
1. Connect your Git repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Configure environment variables
5. Deploy

**Build Settings:**
```
Build command: npm run build
Publish directory: dist
```

### Other Platforms

TranspoPilot AI can be deployed to any platform that supports static sites:
- **GitHub Pages** (with custom workflows)
- **AWS S3 + CloudFront**
- **Google Cloud Storage**
- **DigitalOcean App Platform**
- **Render**

---

## Environment Configuration

### Required Environment Variables

Create a `.env` file in your project root:

```env
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Analytics
VITE_GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
```

### Getting Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon/public** key → Use as `VITE_SUPABASE_ANON_KEY`

**IMPORTANT:** Never commit your `.env` file to Git. It's already in `.gitignore`.

---

## Database Setup

### Automatic Setup (Recommended)

Your Supabase database will automatically initialize on first deployment:

1. **Migrations are auto-applied** via Supabase
2. **Demo data seeding** is automatic for new users
3. **RLS policies** are configured for multi-tenant security

### Manual Verification

To verify your database is set up correctly:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query to check tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- `user_profiles`
- `organizations`
- `vehicles`
- `drivers`
- `integration_providers`
- `integration_credentials`
- `gps_tracking`
- And more...

### Database Migrations

All migrations are in `supabase/migrations/`. They run automatically when:
- You push to your Supabase project
- New users sign up (demo data seeding)

---

## Post-Deployment

### 1. Test the Application

Visit your deployed URL and verify:

- [ ] Landing page loads correctly
- [ ] Sign up flow works
- [ ] Demo data appears after signup
- [ ] Integration page is accessible
- [ ] All main features load

### 2. Configure Custom Domain (Optional)

**Vercel:**
1. Go to your project settings
2. Add your custom domain
3. Update DNS records as instructed
4. SSL is automatic

**Netlify:**
1. Go to Domain Settings
2. Add custom domain
3. Update DNS
4. Enable HTTPS (automatic)

### 3. Set Up Monitoring

Recommended monitoring tools:
- **Sentry** for error tracking
- **Google Analytics** for usage metrics
- **Supabase Dashboard** for database monitoring
- **Vercel/Netlify Analytics** for performance

---

## User Onboarding Flow

When users visit your deployed application:

### Step 1: Landing Page
- Users see the marketing landing page
- Clear call-to-action: "Start Free Trial"
- Pricing and features displayed

### Step 2: Sign Up
- User enters: Company Name, Full Name, Email, Password
- Account created instantly
- Organization created automatically
- User profile initialized with demo_mode=true

### Step 3: Welcome Modal
- Friendly welcome message
- Prominent "Connect Your Telematics" button
- Option to explore demo first
- 30-day trial information

### Step 4: Dashboard with Demo Data
- User sees working dashboard immediately
- 3 demo vehicles pre-loaded
- 3 demo drivers pre-loaded
- Demo data clearly labeled
- Banner prompts to connect real telematics

### Step 5: Connect Telematics (Optional)
- User navigates to Integrations page
- Selects provider (Geotab, Samsara, Motive, Custom)
- Enters API credentials
- Tests connection
- Data syncs automatically

### Step 6: Live Data
- Real fleet data replaces demo data
- "Live Data" badge appears
- All features work with real data
- Demo data is no longer shown

---

## Monitoring & Maintenance

### Health Checks

The application includes built-in health monitoring:

1. **Integration Health**
   - Checks connection status every 5 minutes
   - Alerts on sync failures

2. **System Health**
   - Database connection monitoring
   - Edge function availability
   - API response times

3. **User Metrics**
   - Active users
   - Trial conversions
   - Integration connections

### Database Backups

**Supabase automatically backs up your database:**
- Point-in-time recovery available
- Daily backups on Pro plan
- Download backups from dashboard

### Updates & Maintenance

To update your deployment:

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Deploy
vercel --prod
# or
netlify deploy --prod
```

**Automatic deployments:**
- Connect your Git repository to Vercel/Netlify
- Every push to `main` deploys automatically

---

## Troubleshooting

### Issue: Blank Screen After Deployment

**Solution:**
1. Check browser console for errors
2. Verify environment variables are set correctly
3. Ensure `VITE_` prefix is used for all env vars
4. Redeploy after adding env vars

### Issue: Users Can't Sign Up

**Solution:**
1. Check Supabase dashboard → Authentication
2. Ensure email confirmation is disabled (or configured)
3. Check RLS policies on `user_profiles` table
4. Verify `seed_user_demo_data` function exists

### Issue: Demo Data Not Appearing

**Solution:**
1. Check Supabase logs for function errors
2. Verify user has `demo_mode=true` in `user_profiles`
3. Check if `seed_user_demo_data` function ran
4. Check RLS policies allow user to see their data

### Issue: Integration Won't Connect

**Solution:**
1. Verify API credentials are correct
2. Check Supabase Edge Functions are deployed
3. Test the specific provider's API directly
4. Check CORS configuration

---

## Security Checklist

Before going live:

- [ ] Environment variables are not committed to Git
- [ ] Supabase RLS policies are enabled on all tables
- [ ] API keys are stored in `integration_credentials` table (encrypted at rest)
- [ ] HTTPS is enabled (automatic with Vercel/Netlify)
- [ ] Supabase project has strong database password
- [ ] Rate limiting configured in Supabase
- [ ] User input validation in place

---

## Scaling Considerations

### Free Tier Limits (Supabase)
- 500 MB database
- 2 GB bandwidth
- 50 MB file storage
- Sufficient for 100-1000 users

### When to Upgrade

Upgrade to Supabase Pro ($25/month) when:
- You exceed 500 MB database
- You need more than 2 GB bandwidth/month
- You want daily backups
- You need priority support

### Performance Optimization

1. **Database Indexes**
   - Already created on foreign keys
   - Add custom indexes for frequently queried fields

2. **Caching**
   - Use browser caching for static assets
   - Cache API responses client-side

3. **CDN**
   - Vercel/Netlify include global CDN
   - Assets served from edge locations

---

## Support & Community

### Getting Help

- **Documentation:** This guide and other docs in the repo
- **Supabase Discord:** For database/auth questions
- **GitHub Issues:** For bug reports and feature requests

### Contributing

To contribute to TranspoPilot AI:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## Conclusion

You now have a fully functional turnkey SaaS! Users can:

1. Visit your URL
2. Sign up in 30 seconds
3. Immediately see working demo data
4. Connect their telematics in 5 minutes
5. Start managing their fleet with AI-powered insights

No database setup required. No complex configuration. Just share the URL.

**Next Steps:**
1. Customize branding (logo, colors, company name)
2. Set up custom domain
3. Configure email templates (Supabase Auth)
4. Add payment processing (if needed)
5. Launch and share!

---

## Quick Reference

**Essential Commands:**
```bash
# Development
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod
```

**Essential URLs:**
```
Your App: https://your-domain.com
Supabase Dashboard: https://app.supabase.com
Vercel Dashboard: https://vercel.com/dashboard
Netlify Dashboard: https://app.netlify.com
```

**Support:**
- Issues: Your GitHub repo issues page
- Supabase: https://supabase.com/support
- Vercel: https://vercel.com/support
