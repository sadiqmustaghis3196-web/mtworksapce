import React, { useState, useEffect } from 'react';
import { X, Fuel, Calendar, MapPin, DollarSign, Image as ImageIcon, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserOrganizationId } from '../api/organization';
import { vehicleAPI, Vehicle } from '../api/vehicles';
import { createFuelRecord, uploadFuelReceipt, extractFuelReceipt } from '../api/fuel';

interface FuelEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FuelEntryModal: React.FC<FuelEntryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [dateWarning, setDateWarning] = useState('');
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    gallons: '',
    cost_per_gallon: '',
    total_cost: '',
    station_name: '',
    location: '',
    fuel_type: 'Diesel',
    odometer_reading: '',
    transaction_date: new Date().toISOString().split('T')[0],
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

  const calculateTotal = (gallons: string, costPerGallon: string) => {
    const g = parseFloat(gallons);
    const c = parseFloat(costPerGallon);
    if (!isNaN(g) && !isNaN(c)) {
      setFormData(prev => ({ ...prev, total_cost: (g * c).toFixed(2) }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'gallons') {
      calculateTotal(value, formData.cost_per_gallon);
    } else if (name === 'cost_per_gallon') {
      calculateTotal(formData.gallons, value);
    } else if (name === 'transaction_date') {
      checkDateWarning(value);
    }
  };

  const checkDateWarning = (dateStr: string) => {
    if (!dateStr) return;
    const date = new Date(dateStr);
    const now = new Date();
    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
    if (daysDiff > 90 || daysDiff < -1) {
      setDateWarning('Date is older than 90 days or in the future. Please verify the date.');
    } else {
      setDateWarning('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setReceiptFile(file);
      setIsExtracting(true);
      setAiSuccessMsg('');
      try {
        const extraction = await extractFuelReceipt(file);
        if (extraction) {
          setFormData(prev => {
            const updated = { ...prev };
            if (extraction.transaction_date) updated.transaction_date = extraction.transaction_date;
            if (extraction.gallons) updated.gallons = extraction.gallons.toString();
            if (extraction.cost_per_gallon) updated.cost_per_gallon = extraction.cost_per_gallon.toString();
            if (extraction.total_cost) updated.total_cost = extraction.total_cost.toString();
            if (extraction.station_name) updated.station_name = extraction.station_name;
            return updated;
          });
          
          
          let aiMsg = 'We found this from your receipt — please confirm';
          if (extraction.confidence_score && extraction.confidence_score < 0.7) {
            aiMsg = 'We found this from your receipt — please verify these values carefully.';
          }
          
          if (extraction.gallons && extraction.cost_per_gallon && extraction.total_cost) {
            const g = parseFloat(extraction.gallons);
            const c = parseFloat(extraction.cost_per_gallon);
            const t = parseFloat(extraction.total_cost);
            if (!isNaN(g) && !isNaN(c) && !isNaN(t) && t > 0) {
              const expectedTotal = g * c;
              if (Math.abs(expectedTotal - t) / t > 0.03) {
                aiMsg = "These values don't add up — please verify";
              }
            }
          }
          setAiSuccessMsg(aiMsg);
          if (extraction.transaction_date) checkDateWarning(extraction.transaction_date);
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
      const orgId = await getUserOrganizationId();
      if (!orgId) throw new Error('No organization ID');

      const newRecord = await createFuelRecord({
        vehicle_id: formData.vehicle_id,
        gallons: parseFloat(formData.gallons) || 0,
        cost_per_gallon: parseFloat(formData.cost_per_gallon) || 0,
        total_cost: parseFloat(formData.total_cost) || 0,
        station_name: formData.station_name,
        location: formData.location,
        fuel_type: formData.fuel_type,
        odometer_reading: parseFloat(formData.odometer_reading) || 0,
        transaction_date: new Date(formData.transaction_date).toISOString(),
        notes: formData.notes,
        data_source: 'manual',
        verification_status: 'pending'
      });

      if (receiptFile) {
        await uploadFuelReceipt(newRecord.id, receiptFile);
      }

      // Check if date is outside typical 90-day range
      const savedDate = new Date(formData.transaction_date);
      const now = new Date();
      const daysDiff = (now.getTime() - savedDate.getTime()) / (1000 * 3600 * 24);
      if (daysDiff > 90) {
        alert(`Saved. This entry is dated ${formData.transaction_date}, outside the current date range — change the range to see it.`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save fuel entry', error);
      alert('Failed to save fuel entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Fuel className="h-5 w-5 text-blue-400" />
            Log Fuel Entry
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {aiSuccessMsg && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3 text-blue-400 animate-fadeIn">
              <Sparkles className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{aiSuccessMsg}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Transaction Date</label>
                {dateWarning && <p className="text-xs text-amber-500 mb-1">{dateWarning}</p>}
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="date"
                    name="transaction_date"
                    value={formData.transaction_date}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Gallons */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Gallons / Liters</label>
                <div className="relative">
                  <Fuel className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    name="gallons"
                    value={formData.gallons}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Price per gallon */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Price per Gallon</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    name="cost_per_gallon"
                    value={formData.cost_per_gallon}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Total Cost */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Total Cost</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                  <input
                    type="number"
                    step="0.01"
                    name="total_cost"
                    value={formData.total_cost}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-900 border-2 border-blue-500/20 rounded-xl pl-10 pr-4 py-2.5 text-white font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Odometer */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Odometer Reading</label>
                <input
                  type="number"
                  name="odometer_reading"
                  value={formData.odometer_reading}
                  onChange={handleInputChange}
                  placeholder="e.g. 150000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Fuel Type */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Fuel Type</label>
                <select
                  name="fuel_type"
                  value={formData.fuel_type}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Diesel">Diesel</option>
                  <option value="Gasoline">Gasoline</option>
                  <option value="DEF">DEF</option>
                  <option value="Electric">Electric / Charging</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Station */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Merchant / Station</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    name="station_name"
                    value={formData.station_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Pilot Flying J"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="City, State or Address"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Receipt File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Scan or Upload Receipt</label>
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
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any additional details..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
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
                disabled={loading || isExtracting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading || isExtracting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isExtracting ? 'Extracting...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Save Fuel Entry
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

export default FuelEntryModal;
