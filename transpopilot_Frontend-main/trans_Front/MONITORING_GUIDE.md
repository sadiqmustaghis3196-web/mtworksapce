# Operations Monitoring System Guide

## Overview

The automated operations monitoring system is now fully activated and will automatically monitor your trucking company's fleet operations once you connect your telematics API (Geotab, Samsara, Motive, or Custom).

## How It Works

### 1. Automatic Activation on API Connection

When you successfully connect a telematics provider:

1. Navigate to **Integrations** page
2. Select your provider (Geotab, Samsara, Motive, or Custom)
3. Enter credentials and click **Test Connection**
4. Upon successful connection, monitoring is **automatically activated**

### 2. What Gets Monitored

The system tracks:

- **Database Performance** - Connection health and query response times
- **API Performance** - All API calls and response times
- **Vehicle Locations API** - Real-time tracking data availability
- **Driver Locations API** - Driver tracking system health
- **Integration Systems** - Connected telematics provider health

### 3. Monitoring Frequency

- **Health Checks**: Every 30 seconds on Operations Monitoring Dashboard
- **Dashboard Health Checks**: Every 5 minutes when logged in
- **API Performance Logging**: Real-time (every API call is logged)
- **Uptime Metrics**: Calculated hourly from health check data

### 4. Alert Generation

Automatic alerts are created when:

- **Critical**: Service is down (no response or error)
- **Medium**: Service is degraded (response time > 1000ms)
- **Low**: Integration monitoring notices

Alerts appear on the Operations Monitoring Dashboard and show:
- Alert type
- Severity level
- Service affected
- Detailed message
- Timestamp
- Resolution status

## Accessing Monitoring Data

### Operations Monitoring Dashboard

Navigate to **Operations Monitoring** to view:

1. **System Status Overview**
   - Overall health status
   - Active alerts count
   - Average uptime percentage
   - Average response time

2. **Active Alerts Panel**
   - Open alerts by severity
   - Alert details and timestamps
   - Resolve button (admin only)

3. **Service Health Status**
   - Real-time status for each service
   - Response times
   - Last check timestamp

4. **Uptime Metrics Table**
   - Service uptime percentages
   - Average response times
   - Health ratings

## Database Tables

All monitoring data is stored in Supabase:

- `system_health_checks` - Individual health check results
- `system_alerts` - System alerts and their resolution status
- `api_performance_logs` - API call performance tracking
- `system_uptime_metrics` - Aggregated uptime statistics
- `integration_sync_logs` - Integration synchronization history

## Edge Function

The system uses a Supabase Edge Function (`system-health-monitor`) that:

- Performs comprehensive health checks
- Monitors connected integrations
- Creates alerts for issues
- Can be triggered manually via API

## API Performance Interceptor

An automatic fetch interceptor logs:
- Endpoint called
- HTTP method
- Response status
- Response time
- Request/response sizes
- Any errors

This provides visibility into all API interactions without manual logging.

## Manual Health Checks

To manually trigger a health check:

```typescript
import { triggerHealthCheck } from './api/monitoring';

await triggerHealthCheck();
```

## Integration with Your Systems

Once your telematics API is connected:

1. **Vehicle data syncs** → Monitoring tracks sync performance
2. **Location updates arrive** → System validates data freshness
3. **Driver status changes** → Monitoring logs API performance
4. **Routes are optimized** → Integration health is verified

## Security

- Row Level Security (RLS) enabled on all monitoring tables
- Only authenticated users can view monitoring data
- Only admins can resolve alerts
- Service role key used for Edge Function operations

## Future Enhancements

Potential additions:
- SMS/Email alert notifications
- Custom alert rules and thresholds
- Performance trend analysis
- Automated incident response
- SLA tracking and reporting

---

**Questions?** Check the Operations Monitoring Dashboard or review the integration sync logs for detailed performance data.
