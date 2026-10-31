import React, { useState } from 'react';
import { X } from 'lucide-react';
import { API_BASE_URL } from '../lib/apiConfig';
import { supabase } from '../lib/supabase';

interface PreTripModalProps {
  inspectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PreTripModal: React.FC<PreTripModalProps> = ({ inspectionId, onClose, onSuccess }) => {
  const [checklist, setChecklist] = useState({
    tires: 'pass',
    lights: 'pass',
    brakes: 'pass',
    fluids: 'pass',
    mirrors: 'pass',
    safety_equipment: 'pass',
    visible_damage: 'pass',
    load_securement: 'pass'
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const res = await fetch(`${API_BASE_URL}/api/operations/pre-trip/submit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: inspectionId,
          checklist,
          notes
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to submit");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRadio = (key: string, val: string) => {
    setChecklist(prev => ({ ...prev, [key]: val }));
  };

  const items = [
    { key: 'tires', label: 'Tires' },
    { key: 'lights', label: 'Lights' },
    { key: 'brakes', label: 'Brakes' },
    { key: 'fluids', label: 'Fluids' },
    { key: 'mirrors', label: 'Mirrors' },
    { key: 'safety_equipment', label: 'Safety Equipment' },
    { key: 'visible_damage', label: 'Visible Damage' },
    { key: 'load_securement', label: 'Load Securement' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Pre-Trip Inspection</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
          <form id="pretrip-form" onSubmit={handleSubmit} className="space-y-4">
            {items.map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                <span className="font-medium text-gray-700">{item.label}</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={item.key} checked={checklist[item.key as keyof typeof checklist] === 'pass'} onChange={() => handleRadio(item.key, 'pass')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">Pass</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={item.key} checked={checklist[item.key as keyof typeof checklist] === 'fail'} onChange={() => handleRadio(item.key, 'fail')} className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">Fail</span>
                  </label>
                </div>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 caret-blue-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Optional notes..."></textarea>
            </div>
          </form>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" form="pretrip-form" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 flex items-center gap-2">
            {submitting ? 'Submitting...' : 'Submit Inspection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreTripModal;
