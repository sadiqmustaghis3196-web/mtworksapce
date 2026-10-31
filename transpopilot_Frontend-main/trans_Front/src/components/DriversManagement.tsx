import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Edit2, Trash2, Filter, X, 
  AlertCircle, ShieldCheck, Clock, CheckCircle2, ChevronDown, UserCircle ,Truck
} from 'lucide-react';
import { driverAPI, Driver, CreateDriverInput, UpdateDriverInput } from '../api/drivers';
import DriverInvitationManagement from './DriverInvitationManagement';
import AssignVehicleModal from './AssignVehicleModal';
import { useAuth } from '../contexts/AuthContext';

const DriversManagement: React.FC = () => {
  const { profile, isDispatcher } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignVehicleModal, setShowAssignVehicleModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'drivers' | 'invitations'>('drivers');

  const [formData, setFormData] = useState<CreateDriverInput>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    hire_date: new Date().toISOString().split('T')[0],
    status: 'training',
    safety_score: 0,
  });

  useEffect(() => {
    loadDrivers();
  }, [profile?.organization_id]);

  useEffect(() => {
    filterDrivers();
  }, [drivers, searchQuery, statusFilter]);

  const loadDrivers = async () => {
    if (profile === undefined) return;
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await driverAPI.getAll();
      setDrivers(data);
      setError(null);
    } catch (err) {
      setError('Failed to load drivers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    let filtered = [...drivers];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.first_name.toLowerCase().includes(query) ||
        d.last_name.toLowerCase().includes(query) ||
        d.email.toLowerCase().includes(query) ||
        d.license_number.toLowerCase().includes(query)
      );
    }

    setFilteredDrivers(filtered);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await driverAPI.create(formData);
      setSuccess('Driver onboarded successfully!');
      setShowAddModal(false);
      resetForm();
      loadDrivers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add driver');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;

    try {
      const updateData: UpdateDriverInput = { ...formData };
      await driverAPI.update(selectedDriver.id, updateData);
      setSuccess('Driver profile updated successfully!');
      setShowEditModal(false);
      resetForm();
      loadDrivers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update driver');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this driver from the fleet?')) return;

    try {
      await driverAPI.delete(id);
      setSuccess('Driver removed successfully!');
      loadDrivers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete driver');
      setTimeout(() => setError(null), 3000);
    }
  };

  const openEditModal = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      first_name: driver.first_name,
      last_name: driver.last_name,
      email: driver.email,
      phone: driver.phone || '',
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
      hire_date: driver.hire_date,
      status: driver.status,
      safety_score: driver.safety_score,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      license_number: '',
      license_expiry: '',
      hire_date: new Date().toISOString().split('T')[0],
      status: 'training',
      safety_score: 0,
    });
    setSelectedDriver(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
      case 'training': return 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20';
      case 'inactive': return 'bg-slate-800 text-slate-300 ring-1 ring-slate-600/20';
      default: return 'bg-slate-800 text-slate-300 ring-1 ring-slate-600/20';
    }
  };

  const isLicenseExpiringSoon = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isLicenseExpired = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry < today;
  };

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    training: drivers.filter(d => d.status === 'training').length,
    inactive: drivers.filter(d => d.status === 'inactive').length,
    expiringSoon: drivers.filter(d => isLicenseExpiringSoon(d.license_expiry)).length,
  };

  return (
    <div className="min-h-screen bg-brand-bg p-4 sm:p-8 font-sans selection:bg-blue-100 max-w-[1600px] mx-auto">
      
      {/* Toast Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 text-red-700 px-6 py-4 rounded-2xl shadow-sm flex items-center gap-3 animate-fade-in">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-700 px-6 py-4 rounded-2xl shadow-sm flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* --- Premium Header --- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-brand-card backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] shadow-xl border border-brand-border relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span className="text-blue-700 text-xs font-bold tracking-wide uppercase">Fleet Personnel</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white tracking-tight mb-2">Driver Operations</h1>
          <p className="text-brand-muted font-medium max-w-xl">Manage your fleet drivers, monitor safety scores, and keep track of compliance and license renewals.</p>
        </div>
        
        <div className="relative z-10 w-full md:w-auto flex flex-col sm:flex-row gap-3">
          {!isDispatcher() && (
            <button
              onClick={() => setViewMode(viewMode === 'drivers' ? 'invitations' : 'drivers')}
              className="w-full sm:w-auto bg-brand-bg-secondary text-brand-accent border border-brand-accent px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-600/30 transition-all shadow-lg flex items-center justify-center gap-2 group"
            >
              {viewMode === 'drivers' ? 'Manage Invitations' : 'View Fleet'}
            </button>
          )}
          
          {viewMode === 'drivers' && !isDispatcher() && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full md:w-auto bg-brand-bg-secondary text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              Add Driver Manually
            </button>
          )}
        </div>
      </div>

      {viewMode === 'invitations' ? (
        <DriverInvitationManagement />
      ) : (
        <>
          {/* --- Bento Grid Stats --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
        {[
          { label: 'Total Drivers', value: stats.total, icon: Users, color: 'blue' },
          { label: 'Active Route', value: stats.active, icon: CheckCircle2, color: 'emerald' },
          { label: 'In Training', value: stats.training, icon: Clock, color: 'indigo' },
          { label: 'Off Duty', value: stats.inactive, icon: UserCircle, color: 'slate' },
          { label: 'Expiring License', value: stats.expiringSoon, icon: AlertCircle, color: 'orange' }
        ].map((stat, i) => (
          <div key={i} className="bg-brand-card backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-xl border border-brand-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${stat.color}-50 rounded-full blur-2xl opacity-50 group-hover:scale-150 transition-transform`}></div>
            <div className="flex flex-col gap-3 relative z-10">
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}-50 flex items-center justify-center border border-${stat.color}-100`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{stat.value}</p>
                <p className="text-xs sm:text-sm font-semibold text-brand-muted uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- Main Table Container --- */}
      <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border overflow-hidden">
        
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-6 border-b border-slate-50 bg-brand-card backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-muted" />
              <input
                type="text"
                placeholder="Search drivers by name, email, or license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-brand-bg border-transparent hover:bg-slate-800 focus:bg-brand-card backdrop-blur-xl border focus:border-blue-500 rounded-xl focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-white placeholder:text-brand-muted outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-brand-muted" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-10 py-3 bg-brand-bg border-transparent hover:bg-slate-800 focus:bg-brand-card backdrop-blur-xl border focus:border-blue-500 rounded-xl font-semibold text-slate-300 outline-none appearance-none cursor-pointer transition-all"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="training">In Training</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-brand-muted pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {loading || profile === undefined ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !profile?.organization_id ? (
            <div className="p-6 flex flex-col items-center justify-center h-64 space-y-4">
              <AlertCircle className="h-12 w-12 text-yellow-500" />
              <h2 className="text-xl font-bold text-white">No Organization Assigned</h2>
              <p className="text-brand-muted">Your account is not linked to an organization. Contact your administrator.</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mb-4 border border-dashed border-brand-border">
                <Users className="h-8 w-8 text-brand-muted" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No Drivers Found</h3>
              <p className="text-brand-muted font-medium">Adjust your filters or onboard a new driver.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-bg">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-brand-border">Driver Profile</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-brand-border hidden sm:table-cell">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-brand-border">License Info</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-brand-border text-center">Safety Score</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-brand-border">Status</th>
                  {!isDispatcher() && (
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-brand-border text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-brand-bg/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-700 font-bold">
                          {driver.first_name.charAt(0)}{driver.last_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white">{driver.first_name} {driver.last_name}</div>
                          <div className="text-xs font-medium text-slate-400 sm:hidden mt-0.5">{driver.phone || driver.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm font-semibold text-white">{driver.email}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{driver.phone || 'No phone added'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-white tracking-wide">{driver.license_number}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-medium text-slate-400">Exp: {new Date(driver.license_expiry).toLocaleDateString()}</span>
                        {isLicenseExpired(driver.license_expiry) ? (
                           <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-1.5 rounded"><AlertCircle className="w-3 h-3 mr-0.5"/> EXPIRED</span>
                        ) : isLicenseExpiringSoon(driver.license_expiry) ? (
                           <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded"><AlertCircle className="w-3 h-3 mr-0.5"/> SOON</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-4 border-emerald-50 text-emerald-700 font-black text-sm">
                        {driver.safety_score.toFixed(0)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(driver.status)}`}>
                        {driver.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {!isDispatcher() && (
                        <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setSelectedDriver(driver);
                              setShowAssignVehicleModal(true);
                            }}
                            className="p-2 sm:p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors sm:mr-2 flex items-center justify-center gap-1 group/btn"
                            title="Assign Vehicle"
                          >
                            <Truck className="h-4 w-4 sm:h-5 sm:w-5 group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDriver(driver);
                              setFormData({
                                first_name: driver.first_name,
                                last_name: driver.last_name,
                                email: driver.email,
                                phone: driver.phone || '',
                                license_number: driver.license_number,
                                license_expiry: driver.license_expiry,
                                hire_date: driver.hire_date,
                                status: driver.status,
                                safety_score: driver.safety_score,
                              });
                              setShowEditModal(true);
                            }}
                            className="p-2 sm:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center justify-center group/btn"
                            title="Edit Driver"
                          >
                            <Edit2 className="h-4 w-4 sm:h-5 sm:w-5 group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => handleDelete(driver.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Driver"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- Premium Add/Edit Modal --- */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-brand-bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in">
          <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
            
            <div className="p-6 sm:p-8 border-b border-brand-border flex items-center justify-between bg-brand-bg">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white tracking-tight">
                  {showAddModal ? 'Onboard New Driver' : 'Update Driver Profile'}
                </h2>
                <p className="text-sm font-medium text-brand-muted mt-1">Enter the official credentials for tracking.</p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="p-2 text-brand-muted hover:text-brand-muted hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto">
              <form id="driverForm" onSubmit={showAddModal ? handleAdd : handleEdit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Form Inputs (Premium Styling) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">First Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="e.g. John"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Last Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="e.g. Doe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Email Address <span className="text-red-500">*</span></label>
                    <input
                      type="email" required value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="driver@company.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Phone Number</label>
                    <input
                      type="tel" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">License Number <span className="text-red-500">*</span></label>
                    <input
                      type="text" required value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold text-white tracking-widest uppercase"
                      placeholder="AB1234567"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">License Expiry Date <span className="text-red-500">*</span></label>
                    <input
                      type="date" required value={formData.license_expiry}
                      onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Hire Date <span className="text-red-500">*</span></label>
                    <input
                      type="date" required value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-300">Current Status <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        required value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:bg-brand-card backdrop-blur-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-semibold text-slate-300 appearance-none cursor-pointer"
                      >
                        <option value="active">🟢 Active (On Duty)</option>
                        <option value="training">🔵 In Training</option>
                        <option value="inactive">⚪ Inactive (Off Duty)</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-brand-muted pointer-events-none" />
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600"/> Initial Safety Score
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range" min="0" max="100" step="1"
                        value={formData.safety_score}
                        onChange={(e) => setFormData({ ...formData, safety_score: parseFloat(e.target.value) || 100.0 })}
                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="font-black text-xl text-blue-700 w-12 text-right">{formData.safety_score}</span>
                    </div>
                  </div>

                </div>
              </form>
            </div>

            <div className="p-6 border-t border-brand-border bg-brand-bg flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                className="px-6 py-3 rounded-xl font-bold text-brand-muted hover:bg-slate-200 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="driverForm"
                className="px-8 py-3 bg-brand-accent text-white rounded-full font-bold hover:bg-brand-accent-hover shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                {showAddModal ? 'Save Driver Data' : 'Update Profile'}
              </button>
            </div>

          </div>
        </div>
      )}
      </>
      )}

      {/* Global CSS for animations (can be added to your tailwind/css file later) */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
      {/* Edit Driver Modal... */}
      {/* existing edit modal code */}

      {showAssignVehicleModal && selectedDriver && (
        <AssignVehicleModal
          driverId={selectedDriver.id}
          driverName={`${selectedDriver.first_name} ${selectedDriver.last_name}`}
          onClose={() => {
            setShowAssignVehicleModal(false);
            setSelectedDriver(null);
          }}
          onSuccess={() => {
            setShowAssignVehicleModal(false);
            setSelectedDriver(null);
            loadDrivers();
            setSuccess('Vehicle assigned successfully!');
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}

    </div>
  );
};

export default DriversManagement;