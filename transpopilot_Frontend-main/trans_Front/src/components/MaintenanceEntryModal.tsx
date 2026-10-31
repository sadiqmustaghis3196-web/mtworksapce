import React, { useState, useEffect } from 'react';
import { X, Calendar, Wrench, DollarSign, Image as ImageIcon, CheckCircle2, User, FileText, Settings, Loader2, Sparkles } from 'lucide-react';
import { vehicleAPI, Vehicle } from '../api/vehicles';
import { createMaintenanceRecord, uploadMaintenanceReceipt, extractMaintenanceReceipt } from '../api/maintenance';

interface MaintenanceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MaintenanceEntryModal: React.FC<MaintenanceEntryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_type: 'Preventive',
    service_date: new Date().toISOString().split('T')[0],
    odometer: '',
    engine_hours: '',
    vendor: '',
    description: '',
    parts_repair_notes: '',
    labor_cost: '',
    parts_cost: '',
    total_cost: '',
    technician: '',
    next_service_due_date: '',
    next_service_due_mileage: '',
    status: 'completed',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadVehicles();
    }
  }, [isOpen]);

  const loadVehicles = async () => {
    try {
      const v = await vehicleAPI.getAll();
      setVehicles(v);
      if (v.length > 0 && !formData.vehicle_id) {
        setFormData(prev => ({ ...prev, vehicle_id: v[0].id }));
      }
    } catch (error) {
      console.error('Failed to load vehicles', error);
    }
  };

  const calculateTotal = (labor: string, parts: string) => {
    const l = parseFloat(labor) || 0;
    const p = parseFloat(parts) || 0;
    setFormData(prev => ({ ...prev, total_cost: (l + p).toFixed(2) }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'labor_cost') {
      calculateTotal(value, formData.parts_cost);
    } else if (name === 'parts_cost') {
      calculateTotal(formData.labor_cost, value);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setReceiptFile(file);
      setIsExtracting(true);
      setAiSuccessMsg('');
      try {
        const extraction = await extractMaintenanceReceipt(file);
        if (extraction) {
          setFormData(prev => {
            const updated = { ...prev };
            if (extraction.service_date) updated.service_date = extraction.service_date;
            if (extraction.vendor) updated.vendor = extraction.vendor;
            if (extraction.service_type) updated.service_type = extraction.service_type;
            if (extraction.labor_cost) updated.labor_cost = extraction.labor_cost.toString();
            if (extraction.parts_cost) updated.parts_cost = extraction.parts_cost.toString();
            if (extraction.total_cost) updated.total_cost = extraction.total_cost.toString();
            return updated;
          });
          
          let aiMsg = 'We found this from your receipt — please confirm';
          if (extraction.confidence_score && extraction.confidence_score < 0.7) {
            aiMsg = 'We found this from your receipt — please verify these values carefully.';
          }
          setAiSuccessMsg(aiMsg);
        } else {
          setAiSuccessMsg('Extraction unavailable or could not read receipt. Please type manually.');
        }
      } catch (error) {
        console.error('Extraction failed', error);
        setAiSuccessMsg('Extraction unavailable or could not read receipt. Please type manually.');
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      const newRecord = await createMaintenanceRecord({
        vehicle_id: formData.vehicle_id,
        service_type: formData.service_type,
        service_date: new Date(formData.service_date).toISOString(),
        odometer: parseFloat(formData.odometer) || undefined,
        engine_hours: parseFloat(formData.engine_hours) || undefined,
        vendor: formData.vendor,
        description: formData.description,
        parts_repair_notes: formData.parts_repair_notes,
        labor_cost: parseFloat(formData.labor_cost) || 0,
        parts_cost: parseFloat(formData.parts_cost) || 0,
        total_cost: parseFloat(formData.total_cost) || 0,
        technician: formData.technician,
        next_service_due_date: formData.next_service_due_date ? new Date(formData.next_service_due_date).toISOString() : undefined,
        next_service_due_mileage: parseFloat(formData.next_service_due_mileage) || undefined,
        status: formData.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
        notes: formData.notes,
        data_source: 'manual',
      });

      if (receiptFile) {
        await uploadMaintenanceReceipt(newRecord.id, receiptFile);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save maintenance entry', error);
      alert('Failed to save maintenance entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-400" />
            Log Maintenance Entry
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Vehicle */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Vehicle</label>
                <select
                  name="vehicle_id"
                  value={formData.vehicle_id}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select Vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicle_number} - {v.make} {v.model}</option>
                  ))}
                </select>
              </div>

              {/* Service Date */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Service Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="date"
                    name="service_date"
                    value={formData.service_date}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Service Type</label>
                <select
                  name="service_type"
                  value={formData.service_type}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Preventive">Preventive</option>
                  <option value="Repair">Repair</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Tire Service">Tire Service</option>
                  <option value="Oil Change">Oil Change</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Odometer */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Odometer</label>
                <input
                  type="number"
                  name="odometer"
                  value={formData.odometer}
                  onChange={handleInputChange}
                  placeholder="e.g. 120500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Engine Hours */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Engine Hours (Optional)</label>
                <input
                  type="number"
                  name="engine_hours"
                  value={formData.engine_hours}
                  onChange={handleInputChange}
                  placeholder="e.g. 3500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Vendor / Shop Name</label>
                <input
                  type="text"
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleInputChange}
                  placeholder="e.g. Joe's Auto Repair"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Technician */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Technician Name</label>
                <input
                  type="text"
                  name="technician"
                  value={formData.technician}
                  onChange={handleInputChange}
                  placeholder="e.g. Mike Smith"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Description & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Service Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of work done..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parts & Repair Notes</label>
                <textarea
                  name="parts_repair_notes"
                  value={formData.parts_repair_notes}
                  onChange={handleInputChange}
                  placeholder="List of parts used or specific repair details..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
            </div>

            {/* Costs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Labor Cost</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    name="labor_cost"
                    value={formData.labor_cost}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parts Cost</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    name="parts_cost"
                    value={formData.parts_cost}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-400 mb-1.5">Total Cost</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                  <input
                    type="number"
                    step="0.01"
                    name="total_cost"
                    value={formData.total_cost}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border-2 border-blue-500/20 rounded-xl pl-10 pr-4 py-2.5 text-white font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Next Service Due */}
              <div>
                <label className="block text-sm font-medium text-emerald-400 mb-1.5 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Next Service Due (Date)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="date"
                    name="next_service_due_date"
                    value={formData.next_service_due_date}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-emerald-500/20 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-emerald-400 mb-1.5 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Next Service Due (Mileage)
                </label>
                <input
                  type="number"
                  name="next_service_due_mileage"
                  value={formData.next_service_due_mileage}
                  onChange={handleInputChange}
                  placeholder="e.g. 125500"
                  className="w-full bg-slate-950 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Receipt File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                Scan or Upload Receipt 
                {isExtracting && <Loader2 size={14} className="animate-spin text-blue-400" />}
              </label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={handleFileChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20"
                />
              </div>
              {aiSuccessMsg && (
                <div className="mt-2 text-sm font-medium flex items-center gap-1.5 text-blue-400 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                  <Sparkles size={14} />
                  {aiSuccessMsg}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Save Maintenance
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceEntryModal;
