
import React, { useState } from 'react';
import { Vehicle, Profile, UserRole, AccessLevel, SubscriptionPlan } from '../types';
import { ICONS } from '../constants';
import ConfirmationModal from './ConfirmationModal';

interface Props {
  vehicles: Vehicle[];
  profile: Profile;
  subscriptionPlan: SubscriptionPlan;
  onAdd: (v: any) => void;
  onSelect: (v: Vehicle) => void;
  onDelete: (id: string) => void;
}

const VehicleList: React.FC<Props> = ({ vehicles, profile, subscriptionPlan, onAdd, onSelect, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newVehicle, setNewVehicle] = useState({ vehicle_number: '', make: '', model: '', year: 2024, type: 'Truck' });

  const isReadOnly = profile.access_level === AccessLevel.READ_ONLY;
  const isAtLimit = subscriptionPlan === SubscriptionPlan.FREE && vehicles.length >= 5;

  const filtered = vehicles.filter(v => v.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSave = () => {
    if (isReadOnly || isAtLimit || !newVehicle.vehicle_number) return;
    onAdd(newVehicle);
    setIsAdding(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-black uppercase tracking-tight">Fleet Inventory</h1>
          <p className="text-xs text-slate-500 font-medium">Monitoring {vehicles.length} active units.</p>
        </div>
        {!isReadOnly && (
          <button 
            onClick={() => isAtLimit ? alert("Upgrade to Pro for unlimited vehicles") : setIsAdding(true)} 
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95"
          >
            {isAtLimit ? 'Limit Reached' : 'Register Vehicle'}
          </button>
        )}
      </header>

      <div className="relative">
        <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
          placeholder="Filter by registration..." 
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none font-bold shadow-soft"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(v => (
          <div key={v.id} onClick={() => onSelect(v)} className="ui-card p-6 rounded-[2rem] shadow-soft hover:shadow-elevated cursor-pointer transition-all border-l-4 border-l-primary-500">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-primary-600"><ICONS.Truck className="w-6 h-6" /></div>
              {!isReadOnly && <button onClick={e => { e.stopPropagation(); onDelete(v.id); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><ICONS.Trash className="w-4 h-4" /></button>}
            </div>
            <h3 className="text-xl font-display font-black uppercase tracking-tight text-slate-900 dark:text-white">{v.vehicle_number}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{v.make} {v.model} • {v.year}</p>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-display font-black mb-8 uppercase">Register Unit</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Registration No.</label>
                <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold uppercase" value={newVehicle.vehicle_number} onChange={e => setNewVehicle({...newVehicle, vehicle_number: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase">Save Asset</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleList;
