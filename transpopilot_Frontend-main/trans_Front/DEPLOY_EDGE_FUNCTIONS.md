# Deploying Edge Functions for GPS Tracking

## Prerequisites

1. Supabase CLI installed
2. Supabase project created and linked
3. Logged in to Supabase CLI

## Setup Instructions

### 1. Install Supabase CLI (if not installed)

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

### 3. Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in your Supabase dashboard URL:
`https://app.supabase.com/project/YOUR_PROJECT_REF`

### 4. Deploy Edge Functions

#### Deploy GPS Simulator Function

```bash
supabase functions deploy gps-simulator
```

This function handles:
- Automated GPS location simulation for all active vehicles
- Single vehicle location updates
- Realistic movement patterns
- Driver status updates

#### Deploy GPS Ingest Function

```bash
supabase functions deploy gps-ingest
```

This function handles:
- Receiving GPS data from external sources
- Single vehicle/driver location ingestion
- Batch processing of multiple locations
- Input validation and error handling

### 5. Verify Deployment

Check that functions are deployed:

```bash
supabase functions list
```

You should see:
- `gps-simulator`
- `gps-ingest`
- `system-health-monitor` (already deployed)

### 6. Test the Functions

#### Test GPS Simulator

```bash
curl -X GET "https://YOUR_PROJECT_REF.supabase.co/functions/v1/gps-simulator?action=simulate" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected response:
```json
{
  "success": true,
  "message": "GPS locations simulated successfully",
  "vehicles_updated": 5,
  "drivers_updated": 3
}
```

#### Test GPS Ingest

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/gps-ingest?type=vehicle" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "VEHICLE_UUID_HERE",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "speed": 55,
    "heading": 180
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Vehicle location ingested successfully",
  "data": {...}
}
```

## Environment Variables

The following environment variables are automatically available in Edge Functions:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin access)

No additional configuration needed!

## Function Endpoints

Once deployed, your functions will be available at:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/gps-simulator
https://YOUR_PROJECT_REF.supabase.co/functions/v1/gps-ingest
```

## Updating Functions

To update an already-deployed function:

```bash
# Make your code changes, then:
supabase functions deploy gps-simulator
# or
supabase functions deploy gps-ingest
```

## Troubleshooting

### Function Not Found
- Verify project is linked: `supabase status`
- Check function name spelling
- Re-link project if needed

### Authentication Errors
- Verify you're logged in: `supabase login`
- Check your access token is valid
- Try logging out and back in

### Deployment Fails
- Check function code for syntax errors
- Verify all imports are correct
- Check Deno runtime compatibility
- Look at deployment logs

### Function Errors at Runtime
- Check Supabase logs in dashboard
- Verify database tables exist
- Check RLS policies allow operations
- Validate input data format

## Using in Production

### Best Practices

1. **Rate Limiting**: Implement API gateway rate limiting
2. **Authentication**: Use service role key for trusted sources only
3. **Monitoring**: Set up logging and alerting
4. **Error Handling**: Implement retry logic in clients
5. **Batch Operations**: Use batch endpoint for multiple updates

### Security Considerations

- Anon key for public/client apps
- Service role key for server-to-server
- Never expose service role key in client code
- Implement additional authentication for sensitive operations
- Validate all input data

### Performance Tips

- Batch updates when possible
- Use appropriate update intervals (30-60 seconds)
- Consider caching for frequently accessed data
- Monitor Edge Function execution times
- Set appropriate timeouts

## Alternative Deployment (Without CLI)

If you cannot use the Supabase CLI, you can deploy through the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to "Edge Functions"
3. Click "New Function"
4. Name it (e.g., `gps-simulator`)
5. Copy the function code from `supabase/functions/gps-simulator/index.ts`
6. Paste into the editor
7. Click "Deploy"
8. Repeat for `gps-ingest`

## Monitoring and Logs

View function logs:

```bash
supabase functions logs gps-simulator
supabase functions logs gps-ingest
```

Or view in the Supabase Dashboard:
1. Go to Edge Functions section
2. Click on function name
3. View "Logs" tab

## Cost Considerations

Supabase Edge Functions pricing:
- Free tier: 500,000 invocations per month
- Pro tier: 2,000,000 invocations per month
- Additional: $2 per 1 million invocations

With simulation running every 5 seconds:
- 12 updates per minute
- 720 per hour
- 17,280 per day
- ~520,000 per month

**Recommendation**: Only run simulation during demonstrations.

## Support

For issues:
1. Check function logs first
2. Verify database connectivity
3. Test with curl commands
4. Review Supabase documentation
5. Check community forums

## Next Steps

After deployment:
1. Test both functions thoroughly
2. Configure simulation frequency
3. Set up external GPS device integration
4. Implement monitoring and alerts
5. Train users on live tracking features

---

**Last Updated**: November 2024
**Status**: Ready for Deployment
