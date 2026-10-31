import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Users, 
  Route, 
  Fuel, 
  Shield, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Clock // Removed TrendingUp as it wasn't used in previous context, add back if needed
} from 'lucide-react';

// FIX: Import from the new service instead of the old file
import { IntegrationService } from '../api/integrationService';

// We keep the interface to match App.tsx requirements, even if we rely on Supabase now
export interface IntegrationConfig {
  apiKey: string;
  companyId: string;
  environment: 'sandbox' | 'production';
  webhookUrl?: string;
}

interface IntegrationDashboardProps {
  config: IntegrationConfig;
}

const IntegrationDashboard: React.FC<IntegrationDashboardProps> = ({ config }) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [syncStats, setSyncStats] = useState({
    vehicles: 0,
    drivers: 0,
    routes: 0,
    lastSync: null as string | null,
  });

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      // 1. Get providers list using the new Service
      const providers = await IntegrationService.getProviders();
      
      // 2. Check if ANY provider is connected
      const activeProvider = providers.find((p: any) => p.connection_status === 'connected');

      if (activeProvider) {
        setConnectionStatus('connected');
        
        // Agar connected hai, to hum assume karte hain sync hua hai
        // (Real app mein hum 'vehicles' table count kar sakte hain)
        setSyncStats({
          vehicles: 247, // Demo count or fetch from DB
          drivers: 156,
          routes: 89,
          lastSync: activeProvider.last_sync_at || new Date().toISOString(),
        });
      } else {
        // Agar koi connected nahi hai, lekin demo mode hai to fake connect dikhao
        if (config.environment === 'sandbox') {
           await new Promise(resolve => setTimeout(resolve, 1000));
           setConnectionStatus('connected');
           setSyncStats({
            vehicles: 247,
            drivers: 156,
            routes: 89,
            lastSync: new Date().toISOString(),
          });
        } else {
           setConnectionStatus('error'); // Not connected
        }
      }

    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('error');
    }
  };

  const integrationFeatures = [
    {
      title: 'Real-time Vehicle Tracking',
      description: 'Sync vehicle locations, fuel levels, and maintenance status',
      icon: Truck,
      status: 'active',
      dataPoints: '247 vehicles',
    },
    {
      title: 'Driver Management',
      description: 'Monitor driver status, HOS compliance, and safety scores',
      icon: Users,
      status: 'active',
      dataPoints: '156 drivers',
    },
    {
      title: 'Route Optimization',
      description: 'Advanced route planning and fuel optimization',
      icon: Route,
      status: 'active',
      dataPoints: '89 active routes',
    },
    {
      title: 'Fuel Analytics',
      description: 'Track fuel consumption, costs, and efficiency metrics',
      icon: Fuel,
      status: 'active',
      dataPoints: '$45K monthly savings',
    },
    { 
      title: 'Safety Compliance',
      description: 'DOT compliance tracking and safety incident management',
      icon: Shield,
      status: 'active',
      dataPoints: '98.7% compliance rate',
    },
    {
      title: 'Insights',
      description: 'Predictive analytics and automated recommendations',
      icon: Zap,
      status: 'active',
      dataPoints: '24/7 monitoring',
    },
  ];

  const webhookEvents = [
    'vehicle.location.updated',
    'driver.status.changed',
    'route.completed',
    'fuel.purchase.recorded',
    'safety.incident.reported',
    'compliance.alert.triggered',
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Integration Status</h2>
            <p className="text-gray-600">TranspoPilot connection for {config.companyId}</p>
          </div>
          <div className="flex items-center space-x-2">
            {connectionStatus === 'connected' && (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-600 font-medium">Connected</span>
              </>
            )}
            {connectionStatus === 'connecting' && (
              <>
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-yellow-600 font-medium">Connecting...</span>
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-red-600 font-medium">Not Connected</span>
              </>
            )}
          </div>
        </div>
        
        {syncStats.lastSync && connectionStatus === 'connected' && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{syncStats.vehicles}</div>
              <div className="text-sm text-gray-500">Vehicles Synced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{syncStats.drivers}</div>
              <div className="text-sm text-gray-500">Drivers Synced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{syncStats.routes}</div>
              <div className="text-sm text-gray-500">Active Routes</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Last Sync</div>
              <div className="text-sm font-medium">{new Date(syncStats.lastSync).toLocaleTimeString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Integration Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrationFeatures.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {feature.status}
                </span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
              <div className="text-sm font-medium text-blue-600">{feature.dataPoints}</div>
            </div>
          );
        })}
      </div>

      {/* Webhook Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Webhook Events</h3>
          <p className="text-sm text-gray-600">Real-time notifications for your trucking management system</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {webhookEvents.map((event, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm font-mono text-gray-700">{event}</span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            ))}
          </div>
          {config.webhookUrl && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700">
                <strong>Webhook URL:</strong> {config.webhookUrl}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationDashboard;