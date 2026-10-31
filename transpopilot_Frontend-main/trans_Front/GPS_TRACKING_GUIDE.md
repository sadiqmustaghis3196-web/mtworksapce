# GPS Live Tracking & Driver Tracking - User Guide

## Overview

The TranspoPilot AI platform now includes fully functional GPS live tracking and driver tracking features with real-time updates, interactive maps, and simulation capabilities for demonstrations.

## Features Implemented

### 1. **Live Fleet Tracking**
- Real-time vehicle location tracking on interactive Leaflet maps
- Vehicle status indicators (active, maintenance, offline)
- Speed monitoring and color-coded speed indicators
- Driver assignment display
- Search and filter capabilities
- Real-time updates via Supabase Realtime subscriptions

### 2. **Driver Location Tracking**
- Real-time driver location monitoring
- Driver status tracking (driving, active, break, off duty)
- Vehicle assignment information
- Interactive map view (toggle on/off)
- Driver contact information display
- Search and filter by name or license number

### 3. **GPS Simulation System**
- Automated GPS location simulator for demonstrations
- Start/Stop simulation controls
- Manual single-update option
- Realistic movement patterns with:
  - Natural heading changes
  - Speed variations
  - Multiple US city starting locations
  - Automatic driver status updates based on vehicle speed

### 4. **GPS Data Ingestion API**
- RESTful API endpoints for receiving GPS data from external sources
- Support for single vehicle/driver updates
- Batch processing for multiple location updates
- Input validation and error handling
- Rate limiting ready

## How to Use

### Accessing Live Tracking

1. **Login** to your TranspoPilot AI account
2. Navigate to **Live Tracking** from the main navigation
3. View all vehicles with their current locations on the interactive map
4. Click on any vehicle marker to see detailed information

### Using the GPS Simulator

#### Starting Automatic Simulation:
1. Click the **"Start Simulation"** button (green)
2. GPS locations will update automatically every 5 seconds
3. Watch vehicles move realistically across the map
4. Click **"Stop Simulation"** (red) to pause updates

#### Manual Updates:
1. Click the **"Update Once"** button (purple)
2. All active vehicle locations will update immediately
3. Use this for step-by-step demonstrations

#### Refreshing Data:
- Click the **"Refresh"** button to reload all vehicle data from the database

### Driver Tracking Features

1. Navigate to **Driver Tracking** from the main navigation
2. Click **"Show Map"** to display driver locations on an interactive map
3. Use the simulation controls (same as Live Tracking)
4. Click on any driver card to:
   - View their location on the map
   - See detailed information
   - Check their current status

### Real-Time Updates

The system uses Supabase Realtime for instant updates:
- New location data appears automatically
- No manual refresh needed
- Updates visible to all users simultaneously
- Connection status monitoring

## Technical Details

### Map Technology
- **Library**: Leaflet + React-Leaflet
- **Tile Provider**: OpenStreetMap
- **Custom Icons**: SVG-based vehicle and driver markers
- **Color Coding**:
  - Green: Active/Driving
  - Gray: Inactive/Off Duty
  - Yellow/Amber: Break/Idle
  - Red: Selected

### Database Tables

#### vehicle_locations
```sql
- id (uuid)
- vehicle_id (uuid, FK to vehicles)
- latitude (numeric)
- longitude (numeric)
- speed (numeric, mph)
- heading (numeric, degrees 0-360)
- altitude (numeric, feet)
- odometer (numeric, miles)
- timestamp (timestamptz)
```

#### driver_locations
```sql
- id (uuid)
- driver_id (uuid, FK to drivers)
- latitude (numeric)
- longitude (numeric)
- status (text: 'active', 'break', 'off_duty', 'driving')
- timestamp (timestamptz)
```

### Edge Functions

#### 1. GPS Simulator (`gps-simulator`)
**Endpoint**: `{SUPABASE_URL}/functions/v1/gps-simulator`

**Actions**:
- `?action=simulate` - Update all active vehicles
- `?action=single&vehicle_id={id}` - Update specific vehicle

**Features**:
- Generates realistic GPS coordinates
- Simulates natural movement patterns
- Auto-assigns driver status based on vehicle speed
- Handles both vehicles and drivers simultaneously

#### 2. GPS Ingest API (`gps-ingest`)
**Endpoint**: `{SUPABASE_URL}/functions/v1/gps-ingest`

**Types**:
- `?type=vehicle` - Single vehicle location
- `?type=driver` - Single driver location
- `?type=batch` - Multiple locations (vehicles and/or drivers)

**Example Request (Vehicle)**:
```json
POST /functions/v1/gps-ingest?type=vehicle
{
  "vehicle_id": "uuid-here",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "speed": 55.5,
  "heading": 180,
  "altitude": 850,
  "odometer": 125000,
  "timestamp": "2024-11-25T10:30:00Z"
}
```

**Example Request (Batch)**:
```json
POST /functions/v1/gps-ingest?type=batch
{
  "vehicles": [
    {
      "vehicle_id": "uuid-1",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "speed": 55
    }
  ],
  "drivers": [
    {
      "driver_id": "uuid-2",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "status": "driving"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Vehicle location ingested successfully",
  "data": { ... }
}
```

### Validation Rules
- Latitude: -90 to 90
- Longitude: -180 to 180
- Vehicle/Driver must exist in database
- Speed: 0 or positive
- Heading: 0 to 360 degrees
- Status: 'active', 'break', 'off_duty', 'driving'

## Integration with External Systems

### ELD/Telematics Providers

To integrate with external GPS providers:

1. **Get your API endpoint**:
   ```
   POST https://{your-supabase-url}.supabase.co/functions/v1/gps-ingest
   ```

2. **Add headers**:
   ```
   Authorization: Bearer {your-supabase-anon-key}
   Content-Type: application/json
   ```

3. **Configure webhooks** in your ELD provider to send data to the endpoint

4. **Map data fields** from your provider's format to our format

### Mobile App Integration

Example JavaScript code for a mobile app:

```javascript
async function sendLocation(vehicleId, position) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/gps-ingest?type=vehicle`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed * 2.237, // Convert m/s to mph
        heading: position.coords.heading,
        altitude: position.coords.altitude * 3.281, // Convert m to feet
        timestamp: new Date().toISOString(),
      }),
    }
  );

  return await response.json();
}

// Usage with Geolocation API
navigator.geolocation.watchPosition(
  (position) => sendLocation(currentVehicleId, position),
  (error) => console.error('Location error:', error),
  { enableHighAccuracy: true, maximumAge: 10000 }
);
```

## Performance Considerations

### Optimization Tips
1. **Update Frequency**: Recommend 30-60 second intervals for production
2. **Batch Updates**: Use batch API for multiple vehicles
3. **Map Clustering**: Implemented for large fleets (100+ vehicles)
4. **Database Indexes**: Already optimized on vehicle_id and timestamp
5. **Data Retention**: Consider archiving old location data (30+ days)

### Current Limitations
- Simulation is for demo purposes only
- Real GPS hardware integration requires separate setup
- Map tiles load from OpenStreetMap (free tier)
- WebSocket connections limited by Supabase plan

## Troubleshooting

### No Vehicles Showing
1. Ensure vehicles have `status = 'active'` in database
2. Click "Start Simulation" or "Update Once"
3. Check browser console for errors
4. Verify Supabase connection

### Map Not Loading
1. Check internet connection (tiles load externally)
2. Clear browser cache
3. Verify Leaflet CSS is loading
4. Check for JavaScript errors in console

### Simulation Not Working
1. Verify Edge Functions are deployed
2. Check Supabase project is active
3. Ensure environment variables are set
4. Look for API errors in console

### Real-Time Updates Not Working
1. Check Supabase Realtime is enabled on project
2. Verify RLS policies allow SELECT access
3. Check network connectivity
4. Look for subscription errors in console

## Security Notes

- All GPS data is protected by Row Level Security (RLS)
- API endpoints validate vehicle/driver existence
- Coordinates are validated before insertion
- Authentication required for all operations
- Service role key required for Edge Functions

## Future Enhancements (Phase 2)

- [ ] Historical playback with timeline scrubber
- [ ] Geofencing with entry/exit alerts
- [ ] Route history visualization
- [ ] Heatmap for frequently traveled areas
- [ ] Trip start/end detection
- [ ] Offline mode with sync queue
- [ ] Driver mobile app
- [ ] Push notifications for alerts
- [ ] Advanced analytics dashboard
- [ ] Integration with route optimization

## Support

For issues or questions:
- Check the console for error messages
- Review database RLS policies
- Verify Edge Function deployment
- Contact support with specific error details

## API Reference Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/functions/v1/gps-simulator?action=simulate` | GET | Simulate all vehicles | Yes |
| `/functions/v1/gps-simulator?action=single` | GET | Simulate one vehicle | Yes |
| `/functions/v1/gps-ingest?type=vehicle` | POST | Ingest vehicle location | Yes |
| `/functions/v1/gps-ingest?type=driver` | POST | Ingest driver location | Yes |
| `/functions/v1/gps-ingest?type=batch` | POST | Batch ingest | Yes |

All endpoints require Bearer token authentication with Supabase credentials.

---

**Last Updated**: November 2024
**Version**: 1.0.0
**Status**: Production Ready for Beta Testing
