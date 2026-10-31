-- Seed Data for Operations Monitoring Dashboard

-- 1. Insert recent health checks (last 1 hour)
INSERT INTO system_health_checks (service_name, check_type, status, response_time_ms, checked_at)
VALUES 
  ('Main Database', 'database', 'healthy', 45, now() - interval '5 minutes'),
  ('Auth Service', 'api', 'healthy', 82, now() - interval '7 minutes'),
  ('Vehicle Tracking API', 'api', 'healthy', 120, now() - interval '10 minutes'),
  ('AI Route Optimizer', 'ai_model', 'healthy', 450, now() - interval '15 minutes'),
  ('Telematics Integration (Geotab)', 'integration', 'healthy', 310, now() - interval '20 minutes'),
  ('Telematics Integration (Samsara)', 'integration', 'degraded', 2100, now() - interval '25 minutes'),
  ('Storage Service', 'external_service', 'healthy', 65, now() - interval '30 minutes'),
  ('Real-time Messaging', 'api', 'healthy', 40, now() - interval '35 minutes'),
  ('Email Notification Service', 'external_service', 'healthy', 150, now() - interval '40 minutes'),
  ('Map Services (Mapbox)', 'external_service', 'healthy', 95, now() - interval '45 minutes');

-- 2. Insert some active alerts
INSERT INTO system_alerts (alert_type, severity, service_name, message, status, triggered_at)
VALUES 
  ('performance', 'medium', 'Telematics Integration (Samsara)', 'High latency detected in Samsara API responses (avg 2100ms). Monitoring for potential degradation.', 'open', now() - interval '25 minutes'),
  ('error', 'low', 'AI Route Optimizer', 'Occasional 502 Bad Gateway errors observed on heavy optimization requests.', 'open', now() - interval '2 hours');

-- 3. Insert historical uptime metrics (past 7 days)
INSERT INTO system_uptime_metrics (service_name, uptime_percentage, total_checks, successful_checks, failed_checks, average_response_time_ms, period_start, period_end)
VALUES 
  ('Main Database', 99.99, 10080, 10079, 1, 42, now() - interval '7 days', now()),
  ('Auth Service', 99.95, 10080, 10075, 5, 85, now() - interval '7 days', now()),
  ('Vehicle Tracking API', 99.80, 10080, 10060, 20, 115, now() - interval '7 days', now()),
  ('AI Route Optimizer', 99.50, 1440, 1433, 7, 520, now() - interval '7 days', now()),
  ('Fleet Integrations', 99.20, 10080, 10000, 80, 250, now() - interval '7 days', now());

-- 4. Insert some mock API performance logs
INSERT INTO api_performance_logs (endpoint, method, status_code, response_time_ms, created_at)
VALUES 
  ('/rest/v1/vehicles', 'GET', 200, 45, now() - interval '1 minute'),
  ('/rest/v1/drivers', 'GET', 200, 38, now() - interval '2 minutes'),
  ('/functions/v1/route-optimization', 'POST', 200, 1250, now() - interval '5 minutes'),
  ('/rest/v1/vehicle_locations', 'GET', 200, 52, now() - interval '8 minutes'),
  ('/rest/v1/organizations', 'GET', 200, 30, now() - interval '10 minutes');
