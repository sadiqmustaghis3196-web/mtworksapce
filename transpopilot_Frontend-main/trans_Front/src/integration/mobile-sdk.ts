// TranspoPilot AI Mobile SDK for React Native / Flutter Integration

export interface MobileSDKConfig {
  apiKey: string;
  companyId: string;
  environment: 'sandbox' | 'production';
  enableLocationTracking: boolean;
  enablePushNotifications: boolean;
}

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

export interface DriverApp {
  driverId: string;
  vehicleId: string;
  currentRoute?: string;
  status: 'on-duty' | 'off-duty' | 'driving' | 'break';
}

// React Native Integration Example
export const ReactNativeIntegration = `
// Install: npm install @transpopilot/react-native-sdk

import { TranspoPilotSDK } from '@transpopilot/react-native-sdk';
import { requestLocationPermission } from 'react-native-permissions';

const App = () => {
  useEffect(() => {
    // Initialize SDK
    TranspoPilotSDK.initialize({
      apiKey: 'your-api-key',
      companyId: 'your-company-id',
      environment: 'production',
      enableLocationTracking: true,
      enablePushNotifications: true,
    });

    // Request permissions
    requestLocationPermission();
  }, []);

  const startTrip = async (routeId: string) => {
    try {
      await TranspoPilotSDK.startTrip({
        routeId,
        driverId: 'driver-123',
        vehicleId: 'vehicle-456',
      });
    } catch (error) {
      console.error('Failed to start trip:', error);
    }
  };

  const updateDriverStatus = async (status: string) => {
    await TranspoPilotSDK.updateDriverStatus(status);
  };

  return (
    <View>
      <Button title="Start Trip" onPress={() => startTrip('route-123')} />
      <Button title="Go On Duty" onPress={() => updateDriverStatus('on-duty')} />
    </View>
  );
};
`;

// Flutter Integration Example
export const FlutterIntegration = `
# Add to pubspec.yaml
dependencies:
  transpopilot_sdk: ^1.0.0

// Initialize in main.dart
import 'package:transpopilot_sdk/transpopilot_sdk.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await TranspoPilotSDK.initialize(
    apiKey: 'your-api-key',
    companyId: 'your-company-id',
    environment: Environment.production,
    enableLocationTracking: true,
  );
  
  runApp(MyApp());
}

// Driver app functionality
class DriverScreen extends StatefulWidget {
  @override
  _DriverScreenState createState() => _DriverScreenState();
}

class _DriverScreenState extends State<DriverScreen> {
  String driverStatus = 'off-duty';
  
  void startTrip(String routeId) async {
    try {
      await TranspoPilotSDK.startTrip(
        routeId: routeId,
        driverId: 'driver-123',
        vehicleId: 'vehicle-456',
      );
    } catch (e) {
      print('Error starting trip: \$e');
    }
  }
  
  void updateStatus(String status) async {
    await TranspoPilotSDK.updateDriverStatus(status);
    setState(() {
      driverStatus = status;
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          ElevatedButton(
            onPressed: () => startTrip('route-123'),
            child: Text('Start Trip'),
          ),
          ElevatedButton(
            onPressed: () => updateStatus('on-duty'),
            child: Text('Go On Duty'),
          ),
        ],
      ),
    );
  }
}
`;

// Web Integration Example
export const WebIntegration = `
// Install: npm install @transpopilot/web-sdk

import { TranspoPilotWeb } from '@transpopilot/web-sdk';

// Initialize for fleet management dashboard
const transpoPilot = new TranspoPilotWeb({
  apiKey: 'your-api-key',
  companyId: 'your-company-id',
  environment: 'production',
});

// Real-time vehicle tracking
const trackVehicles = async () => {
  const vehicles = await transpoPilot.getVehicles();
  
  vehicles.forEach(vehicle => {
    // Update map markers
    updateVehicleMarker(vehicle.id, vehicle.location);
  });
};

// Driver management
const manageDrivers = async () => {
  const drivers = await transpoPilot.getDrivers();
  const alerts = await transpoPilot.getComplianceAlerts();
  
  // Update dashboard
  updateDriverList(drivers);
  showComplianceAlerts(alerts);
};

// Route optimization
const optimizeRoute = async (routeData) => {
  const optimized = await transpoPilot.optimizeRoute(routeData);
  
  return {
    fuelSavings: optimized.fuelSavings,
    timeSavings: optimized.timeSavings,
    newRoute: optimized.optimizedRoute,
  };
};
`;

export class MobileSDK {
  private config: MobileSDKConfig;
  private locationWatcher?: number;

  constructor(config: MobileSDKConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize SDK with configuration
    console.log('TranspoPilot Mobile SDK initialized');
  }

  async startLocationTracking(driverId: string, vehicleId: string): Promise<void> {
    if (!this.config.enableLocationTracking) return;

    // Start GPS tracking
    this.locationWatcher = setInterval(async () => {
      const location = await this.getCurrentLocation();
      await this.sendLocationUpdate(driverId, vehicleId, location);
    }, 30000); // Update every 30 seconds
  }

  async stopLocationTracking(): Promise<void> {
    if (this.locationWatcher) {
      clearInterval(this.locationWatcher);
      this.locationWatcher = undefined;
    }
  }

  private async getCurrentLocation(): Promise<LocationUpdate> {
    // Mock implementation - replace with actual GPS
    return {
      lat: 40.7128,
      lng: -74.0060,
      accuracy: 10,
      timestamp: new Date().toISOString(),
      speed: 65,
      heading: 180,
    };
  }

  private async sendLocationUpdate(
    driverId: string, 
    vehicleId: string, 
    location: LocationUpdate
  ): Promise<void> {
    const baseUrl = this.config.environment === 'production' 
      ? 'https://api.transpopilot.ai/v1' 
      : 'https://sandbox-api.transpopilot.ai/v1';

    await fetch(`${baseUrl}/vehicles/${vehicleId}/location`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Company-ID': this.config.companyId,
      },
      body: JSON.stringify({
        driverId,
        location,
      }),
    });
  }

  async startTrip(tripData: {
    routeId: string;
    driverId: string;
    vehicleId: string;
  }): Promise<void> {
    await this.startLocationTracking(tripData.driverId, tripData.vehicleId);
    
    // Send trip start event
    console.log('Trip started:', tripData);
  }

  async endTrip(): Promise<void> {
    await this.stopLocationTracking();
    console.log('Trip ended');
  }

  async updateDriverStatus(status: DriverApp['status']): Promise<void> {
    // Send status update to API
    console.log('Driver status updated:', status);
  }

  async recordFuelPurchase(fuelData: {
    vehicleId: string;
    driverId: string;
    gallons: number;
    cost: number;
    location: string;
  }): Promise<void> {
    // Record fuel purchase
    console.log('Fuel purchase recorded:', fuelData);
  }
}