import React, { useState, useEffect } from 'react';
import { Truck, X, Save, AlertCircle } from 'lucide-react';
import { vehicleAPI, Vehicle } from '../api/vehicles';
import LoadingSpinner from './LoadingSpinner';
import { assignVehicleToDriver, unassignVehicleFromDriver } from '../api/adminApi';

interface AssignVehicleModalProps {
  driverId: string;
  driverName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AssignVehicleModal: React.FC<AssignVehicleModalProps> = ({ driverId, driverName, onClose, onSuccess }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const data = await vehicleAPI.getAll();
      setVehicles(data);

      // Find if driver already has an assigned vehicle
      const assigned = data.find((v: any) => v.driver_id === driverId);
      if (assigned) {
        setSelectedVehicleId(assigned.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const currentlyAssigned = vehicles.find((v: any) => v.driver_id === driverId);

      if (!selectedVehicleId) {
        // Unassign only
        if (currentlyAssigned) {
          await unassignVehicleFromDriver(driverId);
        }
      } else {
        // Assign selected vehicle via backend (validates org, audit logs)
        await assignVehicleToDriver(driverId, selectedVehicleId);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to assign vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assign Vehicle</h2>
            <p className="text-sm text-gray-500 mt-1">For {driverName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Vehicle
              </label>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                <div
                  onClick={() => setSelectedVehicleId('')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedVehicleId === ''
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">No Vehicle Assigned</p>
                </div>

                {vehicles.map((v: any) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedVehicleId === v.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedVehicleId === v.id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Truck className={`h-5 w-5 ${selectedVehicleId === v.id ? 'text-blue-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{v.vehicle_number}</p>
                        <p className="text-xs text-gray-500">
                          {v.make} {v.model}{v.license_plate ? ` • ${v.license_plate}` : ''}
                        </p>
                      </div>
                      {v.driver_id && v.driver_id !== driverId && (
                        <div className="ml-auto text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                          Already Assigned
                        </div>
                      )}
                      {v.driver_id === driverId && (
                        <div className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                          Current
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium
              transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {saving ? <LoadingSpinner /> : <Save className="h-5 w-5" />}
            Save Assignment
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignVehicleModal;
