import React, { useState, useEffect } from 'react';
import { X, Save, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateRequirement } from '../services/api';

export default function ConfigPanel({
  isOpen,
  onClose,
  roomRequirements,
  selectedRoomType,
  onRequirementUpdated
}) {
  const [activeTab, setActiveTab] = useState(selectedRoomType || 'classroom');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    min_length_m: 6.0,
    min_width_m: 5.0,
    min_height_m: 3.0,
    min_area_sqm: 66.0,
    is_placeholder: true,
    disclaimer: 'Demo preset values for AICTE compliance check.'
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (selectedRoomType) {
      setActiveTab(selectedRoomType);
    }
  }, [selectedRoomType]);

  useEffect(() => {
    if (roomRequirements && roomRequirements[activeTab]) {
      setFormData(roomRequirements[activeTab]);
    }
  }, [roomRequirements, activeTab]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const numericData = {
        ...formData,
        min_length_m: parseFloat(formData.min_length_m),
        min_width_m: parseFloat(formData.min_width_m),
        min_height_m: parseFloat(formData.min_height_m),
        min_area_sqm: parseFloat(formData.min_area_sqm)
      };

      await updateRequirement(activeTab, numericData);
      setSaveSuccess(true);
      if (onRequirementUpdated) {
        onRequirementUpdated();
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save requirements:', err);
      setErrorMsg(err.message || 'Failed to update requirement standard.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base text-white font-['Outfit']">
              Configure AICTE Requirements
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-900 px-4 pt-2 gap-1 scrollbar-none">
          {roomRequirements &&
            Object.keys(roomRequirements).map((key) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                  activeTab === key
                    ? 'border-cyan-500 text-cyan-300 bg-slate-850'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {roomRequirements[key].name || key}
              </button>
            ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {saveSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Standard requirements updated successfully!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-700/60 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Room Profile Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Min Length (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                value={formData.min_length_m}
                onChange={(e) => handleChange('min_length_m', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Min Width (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                value={formData.min_width_m}
                onChange={(e) => handleChange('min_width_m', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Min Ceiling Height (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                value={formData.min_height_m}
                onChange={(e) => handleChange('min_height_m', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Min Floor Area (m²)</label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                value={formData.min_area_sqm}
                onChange={(e) => handleChange('min_area_sqm', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Requirements'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
