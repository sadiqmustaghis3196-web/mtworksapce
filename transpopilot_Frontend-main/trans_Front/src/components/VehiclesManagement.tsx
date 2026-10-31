import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Edit2, Trash2, Filter, X } from 'lucide-react';
import { vehicleAPI, Vehicle, CreateVehicleInput, UpdateVehicleInput } from '../api/vehicles';
import { getFriendlyErrorMessage, isConfigurationError } from '../lib/errorHandler';
import { useAuth } from '../contexts/AuthContext';

const VehiclesManagement: React.FC = () => {
  const { isDispatcher, profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateVehicleInput>({
    vehicle_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    status: 'active',
    current_mileage: 0,
    fuel_capacity: 0,
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    filterVehicles();
  }, [vehicles, searchQuery, statusFilter]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const data = await vehicleAPI.getAll();
      setVehicles(data);
      setError(null);
    } catch (err) {
      const errorMessage = getFriendlyErrorMessage(err);
      setError(errorMessage);
      console.error(err);

      if (isConfigurationError(err)) {
        window.location.href = '/diagnostics';
      }
    } finally {
      setLoading(false);
    }
  };

  const filterVehicles = () => {
    let filtered = [...vehicles];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.vehicle_number.toLowerCase().includes(query) ||
        v.make.toLowerCase().includes(query) ||
        v.model.toLowerCase().includes(query) ||
        v.vin.toLowerCase().includes(query)
      );
    }

    setFilteredVehicles(filtered);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vehicleAPI.create(formData);
      setSuccess('Vehicle added successfully!');
      setShowAddModal(false);
      resetForm();
      loadVehicles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMessage = getFriendlyErrorMessage(err);
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    try {
      const updateData: UpdateVehicleInput = { ...formData };
      await vehicleAPI.update(selectedVehicle.id, updateData);
      setSuccess('Vehicle updated successfully!');
      setShowEditModal(false);
      resetForm();
      loadVehicles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMessage = getFriendlyErrorMessage(err);
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      await vehicleAPI.delete(id);
      setSuccess('Vehicle deleted successfully!');
      loadVehicles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete vehicle');
      setTimeout(() => setError(null), 3000);
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      vehicle_number: vehicle.vehicle_number,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      status: vehicle.status,
      current_mileage: vehicle.current_mileage,
      fuel_capacity: vehicle.fuel_capacity,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      vehicle_number: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      vin: '',
      status: 'active',
      current_mileage: 0,
      fuel_capacity: 0,
    });
    setSelectedVehicle(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.status === 'active').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
    inactive: vehicles.filter(v => v.status === 'inactive').length,
  };

  return (
    <div className="min-h-screen bg-brand-bg p-6 sm:p-8 space-y-6 max-w-[1600px] mx-auto selection:bg-brand-accent/30 selection:text-brand-accent">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-brand-border shadow-xl relative overflow-hidden text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Vehicle Management</h1>
            <p className="text-slate-400 font-light leading-relaxed">Manage your fleet vehicles</p>
          </div>
          {!isDispatcher() && profile?.role !== 'user' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 bg-brand-accent text-white px-6 py-3.5 rounded-full font-bold hover:bg-brand-accent-hover transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-0.5"
            >
              <Plus className="h-5 w-5" />
              <span>Add Vehicle</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-6 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Vehicles</p>
              <p className="text-3xl font-extrabold text-white tracking-tight">{stats.total}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-6 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active</p>
              <p className="text-3xl font-extrabold tracking-tight text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-6 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Maintenance</p>
              <p className="text-3xl font-extrabold tracking-tight text-yellow-600">{stats.maintenance}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Truck className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-6 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inactive</p>
              <p className="text-3xl font-extrabold tracking-tight text-slate-300">{stats.inactive}</p>
            </div>
            <div className="p-3 rounded-full bg-gray-100">
              <Truck className="h-6 w-6 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border overflow-hidden">
        <div className="p-6 border-b border-brand-border bg-brand-bg-secondary/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by vehicle number, make, model, or VIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Loading vehicles...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-gray-500">No vehicles found</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-brand-bg-secondary border-b border-brand-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    Vehicle Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    Make & Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    VIN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    Mileage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    Status
                  </th>
                  {!isDispatcher() && profile?.role !== 'user' && (
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-brand-bg-secondary/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-extrabold text-white tracking-tight">{vehicle.vehicle_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-light text-slate-300">{vehicle.make} {vehicle.model}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-light text-slate-300">{vehicle.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-light text-slate-400">{vehicle.vin}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-light text-slate-300">{vehicle.current_mileage.toLocaleString()} mi</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                        {vehicle.status}
                      </span>
                    </td>
                    {!isDispatcher() && profile?.role !== 'user' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(vehicle)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-card backdrop-blur-2xl rounded-[2rem] border border-brand-border max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-brand-border bg-brand-bg-secondary flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                {showAddModal ? 'Add New Vehicle' : 'Edit Vehicle'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleAdd : handleEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    VIN *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Make *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Year *
                  </label>
                  <input
                    type="number"
                    required
                    min="1900"
                    max="2100"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Current Mileage
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.current_mileage}
                    onChange={(e) => setFormData({ ...formData, current_mileage: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 font-bold text-sm mb-1">
                    Fuel Capacity (gallons)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.fuel_capacity}
                    onChange={(e) => setFormData({ ...formData, fuel_capacity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-brand-bg-secondary border border-brand-border rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-white placeholder:text-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-slate-300 font-bold text-sm hover:bg-brand-bg-secondary/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-accent text-white rounded-full font-bold hover:bg-brand-accent-hover shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all hover:-translate-y-0.5"
                >
                  {showAddModal ? 'Add Vehicle' : 'Update Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehiclesManagement;
