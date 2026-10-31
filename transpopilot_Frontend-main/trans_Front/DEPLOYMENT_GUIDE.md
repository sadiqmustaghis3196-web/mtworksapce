# TranspoPilot AI - Deployment Guide

## Overview

This guide ensures trucking companies always see the latest version of TranspoPilot AI when you share it with them. The deployment setup includes automatic versioning, cache-busting, and fresh content delivery.

## CRITICAL: Environment Variables Required

**IMPORTANT**: TranspoPilot AI REQUIRES Supabase environment variables to function. Without these, users will see a blank screen or configuration warning.

**Required Variables:**
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Getting Your Credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project or create a new one
3. Navigate to Settings → API
4. Copy Project URL and anon/public key

**Verification:**
After deployment, visit `https://your-domain.com/diagnostics` to verify configuration.

## Current Version

**Version:** 1.0.0

The version is automatically displayed in:
- Landing page footer
- Dashboard sidebar (bottom)
- Mobile sidebar (bottom)

## Quick Deployment (Vercel - Recommended)

### Prerequisites
- GitHub account
- Vercel account (free tier available)
- Node.js 18+ installed locally

### Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial deployment setup v1.0.0"

# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/yourusername/transpopilot-ai.git

# Push to GitHub
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your `transpopilot-ai` repository
4. Configure the project:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. Add Environment Variables (click "Environment Variables"):
   ```
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_ENVIRONMENT=production
   ```

6. Click "Deploy"

### Step 3: Configure Custom Domain (Optional but Recommended)

1. In Vercel project settings, go to "Domains"
2. Add custom domain: `app.transpopilot.ai`
3. Follow DNS configuration instructions
4. Wait for SSL certificate to be automatically provisioned

### Step 4: Verify Deployment

1. Visit your deployment URL (e.g., `https://transpopilot-ai.vercel.app`)
2. Check the footer/sidebar for version number (should show "v1.0.0")
3. Test key features:
   - Landing page loads correctly
   - Sign up/Login works
   - Dashboard displays properly
   - GPS tracking functions
   - AI features respond

## Alternative: Netlify Deployment

### Quick Deploy

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Initialize and deploy:
   ```bash
   netlify init
   netlify deploy --prod
   ```

4. Set environment variables in Netlify dashboard

### Or Deploy via UI

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select repository
4. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Add environment variables
6. Click "Deploy site"

## Cache-Busting Strategy

The deployment automatically handles cache-busting through:

### 1. Hashed Filenames
Every build generates unique filenames with content hashes:
```
assets/index-[hash].js
assets/index-[hash].css
```

### 2. Cache Headers
- **Assets (JS/CSS):** Cached for 1 year (immutable)
  - `Cache-Control: public, max-age=31536000, immutable`
- **HTML:** Always revalidated
  - `Cache-Control: public, max-age=0, must-revalidate`

### 3. Version Display
Version number is injected at build time from `package.json`, ensuring users can verify they're seeing the latest version.

## Updating for New Releases

### 1. Update Version Number

Edit `package.json`:
```json
{
  "version": "1.1.0"
}
```

### 2. Commit and Push

```bash
git add package.json
git commit -m "Bump version to 1.1.0"
git push
```

### 3. Automatic Deployment

Vercel/Netlify automatically:
1. Detects the push
2. Runs `npm run build`
3. Generates new hashed assets
4. Deploys new version
5. Updates DNS/CDN within seconds

### 4. Share with Trucking Companies

Share the URL:
- Production: `https://app.transpopilot.ai`
- Or Vercel: `https://transpopilot-ai.vercel.app`

They'll always get the latest version because:
- HTML is never cached
- New assets have new filenames
- Old assets are not loaded

## Verification Checklist

Before sharing with trucking companies:

- [ ] Version number displays correctly (footer/sidebar)
- [ ] All pages load without errors
- [ ] Supabase connection works
- [ ] Authentication (signup/login) functions
- [ ] Dashboard displays data
- [ ] GPS tracking works
- [ ] AI features respond
- [ ] Mobile responsive design works
- [ ] HTTPS is active (green padlock)
- [ ] Custom domain points correctly (if used)

## Troubleshooting

### Issue: Blank screen or "Configuration Required" warning

**Symptoms:**
- Application shows a blank white screen
- Yellow warning banner about missing configuration
- Console errors about Supabase connection

**Solution:**
1. Navigate to `/diagnostics` to see detailed configuration status
2. Verify environment variables are set:
   - Check Vercel/Netlify dashboard → Environment Variables
   - Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured
   - Variables must start with `VITE_` prefix
3. After adding variables, trigger a new deployment
4. Verify configuration at `https://your-domain.com/diagnostics`
5. All checks should show green checkmarks

**For local development:**
1. Create `.env` file in project root
2. Add the required variables (see "Getting Your Credentials" section above)
3. Restart development server: `npm run dev`
4. Visit `http://localhost:5173/diagnostics` to verify

### Issue: Old version still showing

**Solution:**
1. Hard refresh in browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Try incognito/private window
4. Check version number in footer - should match package.json

### Issue: Environment variables not working

**Solution:**
1. Check Vercel/Netlify dashboard → Environment Variables
2. Ensure all variables start with `VITE_`
3. Redeploy after adding variables
4. Check browser console for connection errors

### Issue: Build fails

**Solution:**
1. Check build logs in Vercel/Netlify
2. Verify Node.js version (should be 18+)
3. Run `npm install` and `npm run build` locally first
4. Check for TypeScript errors

### Issue: 404 errors on refresh

**Solution:**
This is already handled by:
- `vercel.json` rewrites configuration
- `netlify.toml` redirects configuration
- If still occurring, check these files are in repository

## Monitoring

### Check Deployment Status

**Vercel:**
- Dashboard: `https://vercel.com/dashboard`
- Deployments tab shows history
- Real-time build logs

**Netlify:**
- Dashboard: `https://app.netlify.com`
- Deploys tab shows history
- Build logs available

### Analytics (Optional)

Add Google Analytics in `.env`:
```
VITE_GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
```

## Best Practices

1. **Version Incrementing:**
   - Bug fixes: 1.0.1 → 1.0.2
   - New features: 1.0.0 → 1.1.0
   - Major changes: 1.0.0 → 2.0.0

2. **Testing:**
   - Always test locally first: `npm run build && npm run preview`
   - Use staging environment for major changes
   - Test on multiple browsers

3. **Communication:**
   - Include version number when sharing with trucking companies
   - Example: "Try TranspoPilot AI v1.0.0 at https://app.transpopilot.ai"
   - Mention new features in each version

4. **Rollback Plan:**
   - Vercel/Netlify keep deployment history
   - Can instantly rollback to previous version if issues occur
   - Click "Rollback" in deployment list

## Support

If trucking companies report seeing an old version:

1. Ask them to hard refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`
2. Ask them to check version number in footer
3. Check deployment status in Vercel/Netlify
4. Verify DNS propagation (can take up to 48 hours for new domains)

## Security Notes

- Never commit `.env` file (already in `.gitignore`)
- Keep Supabase keys secure
- Use environment variables for all secrets
- Enable 2FA on Vercel/Netlify accounts
- Regularly update dependencies: `npm audit fix`

## Next Steps

1. Deploy to Vercel/Netlify
2. Test thoroughly
3. Configure custom domain (recommended)
4. Share with first trucking company
5. Monitor for issues
6. Iterate and improve

---

**Current Version:** 1.0.0
**Last Updated:** December 2024
**Documentation:** [README.md](./README.md)
