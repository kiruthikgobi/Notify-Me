
import React, { useState } from 'react';
import { GlobalAutomationConfig, VehicleMake } from '../types';
import { ICONS } from '../constants';
import ConfirmationModal from './ConfirmationModal';

interface AutomationSettingsProps {
  config: GlobalAutomationConfig;
  vehicleMakes: VehicleMake[];
  onUpdate: (config: GlobalAutomationConfig) => void;
  onAddMake: (name: string) => Promise<void>;
  onRemoveMake: (id: string) => Promise<void>;
}

const AutomationSettings: React.FC<AutomationSettingsProps> = ({ config, vehicleMakes, onUpdate, onAddMake, onRemoveMake }) => {
  const [newEmail, setNewEmail] = useState('');
  const [newMake, setNewMake] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{open: boolean, email: string}>({
    open: false,
    email: ''
  });
  const [makeDeleteConfirm, setMakeDeleteConfirm] = useState<{open: boolean, id: string, name: string}>({
    open: false,
    id: '',
    name: ''
  });

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (trimmed && trimmed.includes('@') && !config.recipients.includes(trimmed)) {
      onUpdate({ ...config, recipients: [...config.recipients, trimmed] });
      setNewEmail('');
    }
  };

  const addMake = async () => {
    const trimmed = newMake.trim();
    if (trimmed && !vehicleMakes.find(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      await onAddMake(trimmed);
      setNewMake('');
    }
  };

  const confirmRemoveEmail = (email: string) => {
    setDeleteConfirm({ open: true, email });
  };

  const confirmRemoveMake = (id: string, name: string) => {
    setMakeDeleteConfirm({ open: true, id, name });
  };

  const removeEmail = (email: string) => {
    onUpdate({ ...config, recipients: config.recipients.filter(e => e !== email) });
    if (editingIndex !== null) setEditingIndex(null);
  };

  const startEditing = (index: number, email: string) => {
    setEditingIndex(index);
    setEditValue(email);
  };

  const saveEdit = (index: number) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed.includes('@')) {
      const newRecipients = [...config.recipients];
      newRecipients[index] = trimmed;
      onUpdate({ ...config, recipients: newRecipients });
      setEditingIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const toggleThreshold = (val: number) => {
    const thresholds = config.defaultThresholds.includes(val)
      ? config.defaultThresholds.filter(t => t !== val)
      : [...config.defaultThresholds, val].sort((a, b) => b - a);
    onUpdate({ ...config, defaultThresholds: thresholds });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Alert & Data Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage automated multi-recipient expiry updates, delivery schedules, and fleet data templates.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recipients Management */}
        <div className="ui-card p-8 rounded-2xl space-y-6 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg">
                <ICONS.Mail className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold">Update Recipients</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase tracking-widest">
              {config.recipients.length} ACTIVE
            </span>
          </div>
          
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Specify Gmail addresses that will receive automated expiry notifications. Updates are delivered simultaneously to all recipients.
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="name@gmail.com"
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-xl pl-4 pr-4 py-3 outline-none font-medium transition-all"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEmail()}
              />
              <button 
                onClick={addEmail}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 active:scale-95"
              >
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {config.recipients.map((email, idx) => (
                <div 
                  key={email} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all group ${
                    editingIndex === idx 
                      ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-900/10' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    {editingIndex === idx ? (
                      <input 
                        autoFocus
                        className="bg-transparent border-b border-primary-500 outline-none font-bold text-sm w-full text-slate-900 dark:text-white"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(idx);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{email}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 ml-4">
                    {editingIndex === idx ? (
                      <>
                        <button onClick={() => saveEdit(idx)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <ICONS.Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                          <ICONS.Plus className="w-4 h-4 rotate-45" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => startEditing(idx, email)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <ICONS.FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmRemoveEmail(email)} 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <ICONS.Trash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vehicle Makes Management */}
        <div className="ui-card p-8 rounded-2xl space-y-6 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg">
                <ICONS.Truck className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold">Vehicle Manufacturers</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase tracking-widest">
              {vehicleMakes.length} REGISTERED
            </span>
          </div>
          
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Manage the list of manufacturers available in the vehicle registration dropdown. (e.g. Tata, Mahindra, Toyota)
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Manufacturer name..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-xl pl-4 pr-4 py-3 outline-none font-medium transition-all"
                value={newMake}
                onChange={e => setNewMake(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMake()}
              />
              <button 
                onClick={addMake}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 active:scale-95"
              >
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {vehicleMakes.map((make) => (
                <div 
                  key={make.id} 
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 group transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{make.name}</span>
                  </div>
                  <button 
                    onClick={() => confirmRemoveMake(make.id, make.name)} 
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <ICONS.Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {vehicleMakes.length === 0 && (
                <div className="py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800/20 rounded-xl">
                  No custom manufacturers defined
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Intervals Management */}
        <div className="ui-card p-8 rounded-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
              <ICONS.Bell className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-display font-bold">Update Intervals</h3>
          </div>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Standard update triggers before a document expires. Customize these globally or per-document.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[30, 15, 7, 3, 1].map(days => (
              <button
                key={days}
                onClick={() => toggleThreshold(days)}
                className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between group relative overflow-hidden ${
                  config.defaultThresholds.includes(days) 
                  ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-900/10' 
                  : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className={`font-black text-lg ${config.defaultThresholds.includes(days) ? 'text-primary-600' : 'text-slate-400'}`}>
                    {days}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${config.defaultThresholds.includes(days) ? 'text-primary-500/60' : 'text-slate-400'}`}>
                    Days Left
                  </span>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  config.defaultThresholds.includes(days) ? 'bg-primary-500 border-primary-500' : 'border-slate-200'
                }`}>
                  {config.defaultThresholds.includes(days) && <ICONS.Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Service Toggle */}
        <div className="ui-card p-8 rounded-2xl overflow-hidden relative lg:col-span-2">
          <div className={`absolute top-0 left-0 w-2 h-full ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${config.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <ICONS.Check className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-display font-bold">Automation Master Engine</h4>
                <p className="text-sm text-slate-500 max-w-md font-medium">When active, FleetGuard.AI will perform background checks every minute and dispatch Gmail updates based on your rules.</p>
              </div>
            </div>
            <button 
              onClick={() => onUpdate({ ...config, enabled: !config.enabled })}
              className={`w-full md:w-auto px-12 py-4 rounded-2xl font-black text-sm tracking-widest transition-all shadow-xl active:scale-95 ${
                config.enabled 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700' 
                : 'bg-slate-800 text-white shadow-slate-500/10 hover:bg-slate-700'
              }`}
            >
              {config.enabled ? 'SERVICE RUNNING' : 'SERVICE STOPPED'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, open: false })}
        onConfirm={() => removeEmail(deleteConfirm.email)}
        title="Remove Alert Recipient?"
        message={`Are you sure you want to stop sending compliance alerts to "${deleteConfirm.email}"? This user will no longer receive automated expiry reminders.`}
        confirmText="Remove Recipient"
        type="danger"
      />

      <ConfirmationModal 
        isOpen={makeDeleteConfirm.open}
        onClose={() => setMakeDeleteConfirm({ ...makeDeleteConfirm, open: false })}
        onConfirm={() => onRemoveMake(makeDeleteConfirm.id)}
        title="Remove Manufacturer?"
        message={`Are you sure you want to remove "${makeDeleteConfirm.name}" from the list? This will not affect existing vehicles but will remove it from the dropdown options for new entries.`}
        confirmText="Remove Option"
        type="warning"
      />
    </div>
  );
};

export default AutomationSettings;
