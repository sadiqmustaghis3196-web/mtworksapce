export interface Vehicle {
  id: string;
  vehicleNumber: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  status: 'active' | 'maintenance' | 'inactive';
  fuelType: 'diesel' | 'gasoline' | 'electric' | 'hybrid';
  currentMileage: number;
  lastMaintenance: string;
  nextMaintenanceDue: number;
  fuelEfficiency: number; // MPG
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  assignedDriver?: string;
}

export interface Driver {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  cdlClass: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'suspended' | 'training';
  safetyScore: number;
  totalMiles: number;
  violations: number;
  lastTraining: string;
  certifications: string[];
  onboardingStatus: 'pending' | 'in-progress' | 'completed';
  avatar?: string;
}

export interface Route {
  id: string;
  name: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  estimatedTime: number;
  fuelConsumption: number;
  optimizationScore: number;
  waypoints: Array<{
    lat: number;
    lng: number;
    address: string;
    stopType: 'pickup' | 'delivery' | 'rest' | 'fuel';
  }>;
  trafficConditions: 'light' | 'moderate' | 'heavy';
  weatherImpact: 'none' | 'low' | 'moderate' | 'high';
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  location: string;
  gallons: number;
  costPerGallon: number;
  totalCost: number;
  mileage: number;
  fuelType: string;
  receipt?: string;
}

export interface SafetyIncident {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  type: 'accident' | 'violation' | 'near-miss' | 'inspection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  resolved: boolean;
  actionsTaken: string[];
  cost?: number;
}

export interface ComplianceItem {
  id: string;
  type: 'dot-inspection' | 'license-renewal' | 'medical-cert' | 'training' | 'vehicle-registration';
  entityId: string; // driver or vehicle ID
  entityType: 'driver' | 'vehicle';
  description: string;
  dueDate: string;
  completedDate?: string;
  status: 'pending' | 'due-soon' | 'overdue' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  documents: string[];
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  type: 'safety' | 'compliance' | 'skills' | 'orientation';
  duration: number; // minutes
  required: boolean;
  prerequisites: string[];
  completionRate: number;
  content: {
    videos: string[];
    documents: string[];
    quizzes: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
    }>;
  };
}

export interface AIInsight {
  id: string;
  type: 'fuel-optimization' | 'safety-alert' | 'maintenance-prediction' | 'route-suggestion';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  suggestedActions: string[];
  createdAt: string;
  entityId?: string;
  entityType?: 'driver' | 'vehicle' | 'route';
}