# TranspoPilot AI - Integration Testing Guide

This guide helps you verify that all integrations and production features are working correctly.

---

## Quick Test Checklist

Use this checklist to verify production readiness:

- [ ] Health check endpoint responds
- [ ] User authentication works
- [ ] GPS data ingestion works
- [ ] Rate limiting functions
- [ ] Audit logging records events
- [ ] Production monitoring displays data
- [ ] Integrations can be configured
- [ ] AI predictions generate results

---

## 1. Health Check Verification

### Test the Health Endpoint

```bash
# Replace with your Supabase URL
curl https://your-project.supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "database": { "status": "up", "latency": 45 },
    "edgeFunctions": { "status": "up" },
    "integrations": { "status": "up" },
    "aiServices": { "status": "up" }
  },
  "metrics": {
    "responseTime": 234,
    "uptime": 99.95
  }
}
```

**Success Criteria:**
- Status code: 200
- Status: "healthy" or "degraded"
- All services showing status
- Response time < 1 second

---

## 2. Authentication Testing

### Test User Signup

```bash
curl -X POST https://your-project.supabase.co/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "data": {
      "full_name": "Test User"
    }
  }'
```

**Expected Response:**
- Status code: 200
- User object with ID
- Access token returned

### Test User Login

```bash
curl -X POST https://your-project.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

**Expected Response:**
- Status code: 200
- Access token
- Refresh token
- User data

**Success Criteria:**
- User created successfully
- Login returns valid JWT
- User profile created in database

---

## 3. GPS Data Ingestion Testing

### Test Single Vehicle Location

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "your-vehicle-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "speed": 55,
    "heading": 180,
    "timestamp": "2024-01-01T12:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vehicle location ingested successfully",
  "processingTime": 123
}
```

**Success Criteria:**
- Status code: 200
- Success: true
- Processing time < 500ms
- Location appears in database

### Test Driver Location

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=driver" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": "your-driver-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "status": "driving",
    "timestamp": "2024-01-01T12:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Driver location ingested successfully",
  "processingTime": 98
}
```

### Test Batch Ingestion

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=batch" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicles": [
      {
        "vehicle_id": "uuid-1",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "speed": 55,
        "heading": 180
      },
      {
        "vehicle_id": "uuid-2",
        "latitude": 34.0522,
        "longitude": -118.2437,
        "speed": 60,
        "heading": 90
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Batch processing completed",
  "results": {
    "vehicles": {
      "success": 2,
      "failed": 0,
      "errors": []
    }
  }
}
```

**Success Criteria:**
- Batch accepts multiple records
- Processing completes successfully
- All valid records ingested
- Invalid records reported in errors

---

## 4. Rate Limiting Testing

### Test Rate Limit

Send 1001 requests rapidly to trigger rate limiting:

```bash
# Send requests in a loop
for i in {1..1001}; do
  curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"vehicle_id":"test","latitude":37.7749,"longitude":-122.4194}' &
done
```

**Expected Behavior:**
- First 1000 requests succeed (200 OK)
- Request 1001+ returns 429 Too Many Requests
- Response includes Retry-After header

**Example Rate Limit Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

**Success Criteria:**
- Rate limiting activates at configured threshold
- Proper 429 status code
- Retry-After header present
- Normal operation resumes after window

---

## 5. Webhook Signature Verification Testing

### Without Signature (Should Work)

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "test-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194
  }'
```

**Expected:** Should succeed if GPS_WEBHOOK_SECRET not configured

### With Valid Signature

```bash
# Generate signature
PAYLOAD='{"vehicle_id":"test-uuid","latitude":37.7749,"longitude":-122.4194}'
SECRET="your-webhook-secret"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

# Send request
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

**Expected:** Success (200 OK)

### With Invalid Signature

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: invalid-signature" \
  -d '{
    "vehicle_id": "test-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194
  }'
```

**Expected:** 401 Unauthorized if GPS_WEBHOOK_SECRET is configured

**Success Criteria:**
- Valid signatures accepted
- Invalid signatures rejected
- Works without signature if not configured

---

## 6. Audit Logging Testing

### Verify Audit Logs

```sql
-- Run in Supabase SQL Editor
SELECT
  action,
  success,
  created_at,
  details,
  error_message
FROM security_audit_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Data:**
- GPS ingestion events
- Authentication events
- Integration sync events
- Success/failure status
- Timestamps

**Success Criteria:**
- All tested operations appear in logs
- Success status matches actual result
- Timestamps are accurate
- Details contain relevant information

---

## 7. Integration Testing

### Test Samsara Integration

```bash
# Test connection
curl -X GET "https://your-project.supabase.co/functions/v1/samsara-sync?action=test" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Expected Response (Without Credentials):**
```json
{
  "error": "Samsara credentials not configured"
}
```

**With Credentials:**
```json
{
  "success": true,
  "message": "Successfully connected to Samsara API",
  "circuitBreakerState": "CLOSED"
}
```

### Test Integration Sync

```bash
# Sync vehicles
curl -X GET "https://your-project.supabase.co/functions/v1/samsara-sync?action=sync-vehicles" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Expected Response:**
```json
{
  "success": true,
  "synced": 25,
  "failed": 0
}
```

**Success Criteria:**
- Connection test returns appropriate status
- Sync operations complete without errors
- Data appears in database
- Sync logs created

---

## 8. AI Features Testing

### Test Vehicle Health Prediction

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/vehicle-health-ai" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "your-vehicle-uuid"
  }'
```

**Expected Response:**
```json
{
  "vehicle_id": "your-vehicle-uuid",
  "health_score": 85,
  "predictions": [
    {
      "component": "Engine",
      "risk_level": "low",
      "recommended_action": "routine_maintenance"
    }
  ]
}
```

### Test Driver Behavior Analysis

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/driver-behavior-ai" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": "your-driver-uuid"
  }'
```

**Expected Response:**
```json
{
  "driver_id": "your-driver-uuid",
  "safety_score": 92,
  "insights": [
    {
      "category": "speeding",
      "frequency": "low",
      "recommendation": "maintain_current_behavior"
    }
  ]
}
```

**Success Criteria:**
- AI endpoints respond within 2 seconds
- Predictions are generated
- Results saved to database
- Error handling works for missing data

---

## 9. Production Monitoring Testing

### Access Dashboard

1. Log in as super admin
2. Navigate to: Production Monitoring
3. Verify display shows:
   - System health status
   - Service latencies
   - Integration status
   - Recent activity logs

### Verify Dashboard Auto-Refresh

1. Keep dashboard open
2. Trigger an event (e.g., GPS ingestion)
3. Wait 30 seconds
4. Verify event appears in recent activity

**Success Criteria:**
- Dashboard loads without errors
- Data displays correctly
- Auto-refresh works
- Real-time updates appear

---

## 10. Error Handling Testing

### Test Invalid Data

```bash
# Missing required fields
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "test"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Missing required fields: latitude, longitude"
}
```

### Test Invalid Coordinates

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "test-uuid",
    "latitude": 999,
    "longitude": -122.4194
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid latitude: must be between -90 and 90"
}
```

**Success Criteria:**
- Validation catches invalid data
- Clear error messages returned
- Proper HTTP status codes (400 for validation)
- Errors logged in audit log

---

## 11. Retry Logic Testing

### Simulate API Failure

This requires temporarily breaking an integration or using a mock endpoint.

**Test Retry Behavior:**
1. Configure integration with invalid credentials
2. Trigger sync operation
3. Observe retry attempts in logs

**Expected Behavior:**
- Initial request fails
- Automatic retry after 1 second
- Second retry after 2 seconds
- Third retry after 4 seconds
- Final failure after 3 attempts
- Total time: ~7 seconds

**Success Criteria:**
- Retries occur automatically
- Exponential backoff observed
- Circuit breaker opens after threshold
- Error properly reported

---

## 12. Circuit Breaker Testing

### Trigger Circuit Breaker

1. Send 6 requests to failing endpoint rapidly
2. Circuit breaker should open after 5 failures
3. Next requests immediately return error

**Expected Behavior:**
- First 5 requests attempt operation
- Circuit breaker opens
- Request 6+ returns immediately: "Circuit breaker is OPEN"
- After 60 seconds, circuit moves to HALF_OPEN
- Successful request closes circuit

**Success Criteria:**
- Circuit opens at threshold
- Immediate response when open
- Auto-reset after timeout
- Successful request closes circuit

---

## 13. Performance Testing

### Measure Response Times

```bash
# GPS Ingestion
time curl -X POST "https://your-project.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id":"test","latitude":37.7749,"longitude":-122.4194}'

# Health Check
time curl "https://your-project.supabase.co/functions/v1/health-check" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Target Response Times:**
- GPS Ingestion: < 200ms
- Health Check: < 500ms
- Integration Sync: < 5s per 100 records
- AI Predictions: < 2s

**Success Criteria:**
- Response times meet targets
- No timeouts under normal load
- Consistent performance

---

## Testing Summary Checklist

After completing all tests, verify:

- [ ] ✅ Health endpoint healthy
- [ ] ✅ Authentication working
- [ ] ✅ GPS ingestion accepting data
- [ ] ✅ Rate limiting triggering correctly
- [ ] ✅ Webhook signatures validating
- [ ] ✅ Audit logs recording events
- [ ] ✅ Integrations configurable
- [ ] ✅ AI predictions generating
- [ ] ✅ Production dashboard showing data
- [ ] ✅ Error handling working
- [ ] ✅ Retry logic functioning
- [ ] ✅ Circuit breaker protecting services
- [ ] ✅ Performance meeting targets

---

## Troubleshooting Common Issues

### Health Check Returns Unhealthy

**Check:**
- Database connectivity
- Edge functions deployed
- Integration credentials (if required)

### GPS Ingestion Fails

**Check:**
- Vehicle/Driver exists in database
- Coordinates are valid (-90 to 90, -180 to 180)
- Authorization header present
- Rate limit not exceeded

### Integration Test Fails

**Check:**
- API credentials configured correctly
- Network connectivity to provider API
- Provider API not under maintenance
- Rate limits on provider side

### Rate Limiting Not Working

**Check:**
- Multiple requests from same client
- Client ID header present
- Function redeployed recently (state reset)

---

## Next Steps

After successful testing:

1. Document any issues found
2. Configure real integration credentials
3. Set up external monitoring
4. Begin production rollout
5. Monitor health check regularly
6. Review audit logs periodically

---

## Support

For issues during testing:

1. Check PRODUCTION_DEPLOYMENT_GUIDE.md
2. Review security_audit_logs table
3. Check edge function logs in Supabase
4. Verify environment variables
5. Test with Supabase SQL Editor for database issues

All systems should pass these tests before production deployment.
