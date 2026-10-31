# TranspoPilot AI - Production Deployment Guide

This comprehensive guide will help you deploy TranspoPilot AI to production with all necessary configurations, integrations, and monitoring systems fully operational.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Edge Functions Deployment](#edge-functions-deployment)
5. [Integration Configuration](#integration-configuration)
6. [Security Configuration](#security-configuration)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Production Checklist](#production-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying to production, ensure you have:

- Supabase project (already configured)
- Node.js 18+ installed
- Git repository access
- Domain name (optional but recommended)
- SSL certificate (handled by Supabase automatically)
- API credentials for integrations (Samsara, Geotab, Motive)

---

## Environment Setup

### 1. Environment Variables

The following environment variables are already configured in your Supabase project:

**Frontend (.env):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Edge Functions (Auto-configured):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend operations
- `SUPABASE_ANON_KEY` - Anonymous key for client operations
- `SUPABASE_DB_URL` - Direct database connection string

### 2. Optional Webhook Secrets

For enhanced security, you can configure webhook secrets:

```bash
# In Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets
GPS_WEBHOOK_SECRET=your_secure_random_string_here
```

Generate a secure webhook secret:
```bash
openssl rand -hex 32
```

---

## Database Configuration

### 1. Database Migrations

All database migrations are already applied. Verify the current state:

```bash
# Check migration status
supabase db remote commit
```

### 2. Row Level Security (RLS)

All tables have RLS enabled with appropriate policies. Verify:

- Users can only access their own organization's data
- Super admins have full access
- Fleet managers have limited access to assigned vehicles/drivers
- All tables require authentication

### 3. Database Indexes

Performance indexes are already created for:
- Foreign keys
- Frequently queried fields (vehicle_id, driver_id, organization_id)
- Timestamp fields for time-range queries

---

## Edge Functions Deployment

All edge functions are production-ready with:

### Core Features Implemented:

1. **Error Handling**
   - Comprehensive try-catch blocks
   - Detailed error messages
   - Proper HTTP status codes

2. **Retry Logic**
   - Automatic retry with exponential backoff
   - Maximum 3 retry attempts
   - Configurable timeout (30 seconds default)

3. **Circuit Breaker**
   - Automatic service protection
   - Opens after 5 consecutive failures
   - Auto-resets after 60 seconds

4. **Rate Limiting**
   - 1000 requests per minute per client
   - Returns 429 status with Retry-After header
   - Automatic cleanup of old entries

5. **Audit Logging**
   - All requests logged to security_audit_logs
   - Success/failure tracking
   - Performance metrics

6. **Webhook Signature Verification**
   - HMAC-SHA256 signature validation
   - Optional but recommended for GPS ingestion

### Available Edge Functions:

| Function | Purpose | Endpoint |
|----------|---------|----------|
| health-check | System health monitoring | `/functions/v1/health-check` |
| gps-ingest | GPS data ingestion | `/functions/v1/gps-ingest` |
| samsara-sync | Samsara integration | `/functions/v1/samsara-sync` |
| geotab-sync | Geotab integration | `/functions/v1/geotab-sync` |
| motive-sync | Motive integration | `/functions/v1/motive-sync` |
| vehicle-health-ai | Vehicle diagnostics AI | `/functions/v1/vehicle-health-ai` |
| driver-behavior-ai | Driver behavior AI | `/functions/v1/driver-behavior-ai` |
| route-optimization | Route planning | `/functions/v1/route-optimization` |
| fuel-optimization | Fuel analysis | `/functions/v1/fuel-optimization` |

---

## Integration Configuration

### Samsara Integration

1. **Obtain API Credentials:**
   - Log in to Samsara Dashboard
   - Navigate to Settings → API Tokens
   - Generate a new API token with permissions:
     - Read Vehicles
     - Read Drivers
     - Read GPS Locations

2. **Configure in TranspoPilot:**
   - Navigate to Integrations page
   - Click "Connect" on Samsara card
   - Enter API key
   - Test connection
   - Enable auto-sync (optional)

3. **Webhook Configuration (Optional):**
   - In Samsara Dashboard: Settings → Webhooks
   - Add webhook URL: `https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle`
   - Add header: `X-Webhook-Signature: [your_webhook_secret]`

### Geotab Integration

1. **Obtain API Credentials:**
   - Contact Geotab support for API access
   - Get: username, password, database name

2. **Configure in TranspoPilot:**
   - Navigate to Integrations page
   - Click "Connect" on Geotab card
   - Enter credentials
   - Test connection

### Motive (KeepTruckin) Integration

1. **Obtain API Credentials:**
   - Log in to Motive Dashboard
   - Navigate to Settings → Integrations → API
   - Generate API key

2. **Configure in TranspoPilot:**
   - Navigate to Integrations page
   - Click "Connect" on Motive card
   - Enter API key
   - Test connection

### Custom Fleet Systems

For custom telematics systems:

1. Use the GPS Ingest API endpoint
2. Send GPS data in this format:

```json
POST /functions/v1/gps-ingest?type=vehicle
{
  "vehicle_id": "uuid",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "speed": 55,
  "heading": 180,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

3. Include webhook signature header if configured:
```
X-Webhook-Signature: hmac_sha256_hash
```

---

## Security Configuration

### 1. API Security

**Rate Limiting:**
- Configured: 1000 requests/minute per client
- Location: Edge functions (built-in)
- Customizable per function

**Authentication:**
- All protected endpoints require JWT token
- Service role key for backend operations
- Anonymous key for frontend operations

**Webhook Security:**
- HMAC-SHA256 signature verification
- Configure GPS_WEBHOOK_SECRET in environment

### 2. Data Security

**Encryption:**
- All data encrypted at rest (Supabase default)
- All API calls over HTTPS/TLS
- Database connections encrypted

**Row Level Security:**
- All tables have RLS enabled
- Organization-based data isolation
- Role-based access control

### 3. Audit Logging

All critical operations are logged:
- User authentication events
- Data modifications
- Integration syncs
- API calls
- Errors and failures

Access logs via Production Monitoring Dashboard (Super Admin only).

---

## Monitoring & Health Checks

### Health Check Endpoint

Monitor system health:

```bash
curl https://your-project.supabase.co/functions/v1/health-check
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "up",
      "latency": 45
    },
    "edgeFunctions": {
      "status": "up",
      "latency": 120
    },
    "integrations": {
      "status": "up",
      "message": "3 active integrations"
    },
    "aiServices": {
      "status": "up"
    }
  },
  "metrics": {
    "responseTime": 234,
    "uptime": 99.95
  }
}
```

### Production Monitoring Dashboard

Access via: Super Admin → Production Monitoring

Features:
- Real-time health status
- Service latency metrics
- Integration status
- Recent activity logs
- Uptime percentage
- Error tracking

### Alerts & Notifications

Set up monitoring alerts:

1. **Uptime Monitoring:**
   - Use external service (e.g., UptimeRobot, Pingdom)
   - Monitor: `/functions/v1/health-check`
   - Alert on 503 status or timeout

2. **Error Rate Monitoring:**
   - Query security_audit_logs table
   - Alert on high failure rate
   - Check system_health_metrics table

---

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations applied and verified
- [ ] RLS policies tested
- [ ] Edge functions deployed
- [ ] Integration credentials configured
- [ ] Webhook secrets generated (if using webhooks)
- [ ] SSL/TLS certificate verified
- [ ] Domain configured (if custom domain)

### Post-Deployment

- [ ] Health check endpoint returns 200 OK
- [ ] Test user authentication (login/signup)
- [ ] Test vehicle creation and tracking
- [ ] Test driver creation and tracking
- [ ] Test GPS data ingestion
- [ ] Test integrations (Samsara/Geotab/Motive)
- [ ] Verify AI predictions working
- [ ] Check audit logs populating
- [ ] Monitor error rates
- [ ] Set up uptime monitoring
- [ ] Configure backup alerts

### Security Verification

- [ ] RLS policies blocking unauthorized access
- [ ] API rate limiting working
- [ ] Webhook signatures validating (if configured)
- [ ] Audit logs recording events
- [ ] No secrets exposed in client code
- [ ] CORS headers properly configured
- [ ] Input validation working

### Performance Verification

- [ ] Database queries optimized
- [ ] Indexes created for common queries
- [ ] Edge functions responding < 1 second
- [ ] GPS ingestion handling high volume
- [ ] Circuit breakers protecting services
- [ ] Retry logic handling failures

---

## Troubleshooting

### Health Check Fails

**Symptoms:** `/health-check` returns 503 or unhealthy status

**Solutions:**
1. Check database connectivity
2. Verify edge functions are deployed
3. Check security_audit_logs for errors
4. Restart edge functions if needed

### GPS Data Not Ingesting

**Symptoms:** Location data not appearing in dashboard

**Solutions:**
1. Verify webhook URL is correct
2. Check webhook signature if configured
3. Review gps-ingest function logs
4. Verify vehicle_id exists in database
5. Check rate limiting (429 errors)

### Integration Sync Failing

**Symptoms:** Integration shows "Error" status

**Solutions:**
1. Verify API credentials are correct
2. Check integration_sync_logs table for errors
3. Test API connection manually
4. Verify rate limits not exceeded
5. Check circuit breaker status
6. Review integration provider's status page

### Performance Issues

**Symptoms:** Slow response times, timeouts

**Solutions:**
1. Check database query performance
2. Review indexes on frequently queried tables
3. Monitor edge function execution time
4. Check for rate limiting
5. Review circuit breaker state
6. Scale Supabase plan if needed

### Authentication Issues

**Symptoms:** Login fails, permission denied

**Solutions:**
1. Verify Supabase credentials
2. Check RLS policies
3. Review security_audit_logs
4. Confirm user role assignments
5. Verify JWT token validity

---

## Support & Resources

### Documentation
- [Supabase Documentation](https://supabase.com/docs)
- [API Integration Guide](./docs/integration-guide.md)
- [AI Features Guide](./AI_FEATURES_GUIDE.md)
- [GPS Tracking Guide](./GPS_TRACKING_GUIDE.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)

### Production Support

For production issues:

1. Check Production Monitoring Dashboard
2. Review security_audit_logs table
3. Check system_health_metrics table
4. Review edge function logs in Supabase Dashboard
5. Contact support if persistent issues

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor health check status
- Review error logs
- Check integration sync status

**Weekly:**
- Review audit logs
- Check database performance
- Verify backup status
- Monitor disk usage

**Monthly:**
- Update dependencies
- Review security policies
- Optimize database queries
- Review and archive old logs
- Test disaster recovery procedures

### Scaling Considerations

As your fleet grows:

1. **Database:** Upgrade Supabase plan for more connections
2. **Edge Functions:** Automatically scale with Supabase
3. **GPS Ingestion:** Consider batch processing for high volume
4. **Storage:** Monitor and increase storage as needed
5. **Indexes:** Add indexes for new query patterns

---

## Conclusion

TranspoPilot AI is now production-ready with:

- Comprehensive error handling and retry logic
- Circuit breaker protection
- Rate limiting
- Audit logging
- Webhook security
- Health monitoring
- Integration support
- AI-powered analytics

All systems are designed for high availability, security, and scalability.

For questions or issues, refer to the troubleshooting section or contact support.
