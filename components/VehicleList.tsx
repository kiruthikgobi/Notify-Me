import React, { useState, useEffect } from 'react';
import { Vehicle, ComplianceRecord, UserRole, SubscriptionPlan, VehicleMake } from '../types';
import { ICONS } from '../constants';
import ConfirmationModal from './ConfirmationModal';

interface VehicleListProps {
  vehicles: Vehicle[];
  records: ComplianceRecord[];
  vehicleMakes: VehicleMake[];
  onAdd: (vehicle: Vehicle) => void;
  onSelect: (vehicle: Vehicle) => void;
  onDelete: (id: string) => void;
  initialFilter?: string | null;
  onClearFilter?: () => void;
  userRole?: UserRole;
  tenantPlan?: SubscriptionPlan;
  onUpgradeRedirect: () => void;
}

type ViewMode = 'card' | 'table' | 'list';

const VehicleList: React.FC<VehicleListProps> = ({ vehicles, records, vehicleMakes, onAdd, onSelect, onDelete, initialFilter, onClearFilter, userRole, tenantPlan, onUpgradeRedirect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (window.innerWidth < 768) ? 'card' : ((localStorage.getItem('fg_view_pref') as ViewMode) || 'card');
  });
  const [isAdding, setIsAdding] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; reg: string }>({
    open: false, id: '', reg: ''
  });
  
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 41 }, (_, i) => currentYear - i);

  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    registrationNumber: '', make: '', model: '', year: currentYear, type: 'Truck'
  });

  const isReadOnly = userRole === UserRole.TENANT_VIEWER;
  const isAtLimit = tenantPlan === SubscriptionPlan.FREE && vehicles.length >= 5;

  const filteredVehicles = vehicles.filter(v => {
    const searchMatch = (v.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (v.make || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!searchMatch) return false;
    
    if (initialFilter === 'drafts') return v.isDraft;
    if (v.isDraft && initialFilter) return false;
    if (!initialFilter) return true;

    const vRecords = records.filter(r => r.vehicleId === v.id);
    const now = new Date();
    const soon = new Date(); soon.setDate(now.getDate() + 30);
    const hasExp = vRecords.some(r => r.expiryDate && new Date(r.expiryDate) < now);
    const hasSoon = vRecords.some(r => r.expiryDate && new Date(r.expiryDate) < soon && new Date(r.expiryDate) >= now);
    
    if (initialFilter === 'expired') return hasExp;
    if (initialFilter === 'soon') return hasSoon;
    if (initialFilter === 'healthy') return !hasExp && !hasSoon;
    return true;
  });

  const getComplianceStatus = (vid: string) => {
    const v = vehicles.find(veh => veh.id === vid);
    if (v?.isDraft) return { label: 'Draft', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' };
    const vRecs = records.filter(r => r.vehicleId === vid);
    const now = new Date();
    const soon = new Date(); soon.setDate(now.getDate() + 30);
    if (vRecs.some(r => r.expiryDate && new Date(r.expiryDate) < now)) return { label: 'Critical', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' };
    if (vRecs.some(r => r.expiryDate && new Date(r.expiryDate) < soon)) return { label: 'Renewal', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' };
    return { label: 'Healthy', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' };
  };

  const handleAdd = (draft: boolean = false) => {
    if (isReadOnly || !newVehicle.registrationNumber?.trim()) return;
    onAdd({ 
      ...newVehicle as Vehicle, 
      registrationNumber: newVehicle.registrationNumber.toUpperCase().trim(),
      isDraft: draft,
      addedDate: new Date().toISOString().split('T')[0]
    }); 
    setIsAdding(false);
    setNewVehicle({ registrationNumber: '', make: '', model: '', year: currentYear, type: 'Truck' });
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white">Fleet Inventory</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Registry of all managed automotive assets.</p>
        </div>
        {!isReadOnly && (
          <button onClick={() => isAtLimit ? onUpgradeRedirect() : setIsAdding(true)} className={`w-full md:w-auto px-6 py-4 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${isAtLimit ? 'bg-red-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
            {isAtLimit ? <ICONS.Alert className="w-5 h-5" /> : <ICONS.Plus className="w-5 h-5" />}
            {isAtLimit ? 'Upgrade to Pro' : 'Register Vehicle'}
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input type="text" placeholder="Search registration..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-4 md:py-3 outline-none focus:ring-4 focus:ring-primary-500/10 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="hidden md:flex bg-slate-200/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-inner">
            {['card', 'table', 'list'].map((mode) => (
                <button key={mode} onClick={() => { setViewMode(mode as ViewMode); localStorage.setItem('fg_view_pref', mode); }} className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === mode ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {mode === 'card' ? <ICONS.Grid className="w-4 h-4" /> : mode === 'table' ? <ICONS.Table className="w-4 h-4" /> : <ICONS.List className="w-4 h-4" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{mode}</span>
                </button>
            ))}
        </div>
      </div>

      <div className="min-h-[400px]">
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in slide-in-from-bottom-2 duration-300">
            {filteredVehicles.map(v => {
              const status = getComplianceStatus(v.id);
              return (
                <div key={v.id} onClick={() => onSelect(v)} className={`ui-card rounded-[1.5rem] p-6 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 relative transition-all flex flex-col h-full ${v.isDraft ? 'border-dashed' : 'hover:shadow-elevated'}`}>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, id: v.id, reg: v.registrationNumber }); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><ICONS.Trash className="w-4 h-4" /></button>}
                  </div>
                  <div className="mb-6"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${v.isDraft ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 dark:bg-slate-800 text-primary-600'}`}><ICONS.Truck className="w-6 h-6" /></div></div>
                  <div className="mb-6 flex-1">
                    <h3 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase truncate">{v.registrationNumber}</h3>
                    <p className="text-xs text-slate-500 font-medium mb-4">{v.make} {v.model} • {v.year}</p>
                    <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6 mt-auto">
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Class</p><p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{v.type}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Registered</p><p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{v.addedDate}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ui-card rounded-2xl overflow-hidden animate-in fade-in duration-300">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Registration</th>
                    <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manufacturer</th>
                    <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVehicles.map(v => (
                    <tr key={v.id} onClick={() => onSelect(v)} className="hover:bg-slate-50/30 cursor-pointer transition-colors group">
                      <td className="p-5 font-display font-black text-slate-900 dark:text-white uppercase">{v.registrationNumber}</td>
                      <td className="p-5 text-xs font-medium text-slate-600 dark:text-slate-300">{v.make} {v.model} ({v.year})</td>
                      <td className="p-5"><span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${getComplianceStatus(v.id).color}`}>{getComplianceStatus(v.id).label}</span></td>
                      <td className="p-5 text-right"><div className="flex justify-end gap-2"><ICONS.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600" /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredVehicles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 md:py-32 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-6"><ICONS.Search className="w-8 h-8" /></div>
            <h3 className="text-xl font-display font-bold">No results found</h3>
            <p className="text-slate-500 mt-2 max-w-xs text-sm">Adjust your search or add a new vehicle to build your fleet.</p>
          </div>
        )}
      </div>

      {isAdding && !isReadOnly && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] md:rounded-[2rem] p-6 md:p-10 w-full max-w-xl shadow-2xl animate-in slide-in-from-bottom-full md:slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold">Register Asset</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full"><ICONS.Plus className="w-6 h-6 rotate-45 text-slate-400" /></button>
            </div>
            <div className="space-y-6">
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Registration Number</label><input autoFocus className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold text-lg uppercase" placeholder="MH-12-AS-1234" value={newVehicle.registrationNumber} onChange={e => setNewVehicle({...newVehicle, registrationNumber: e.target.value})} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Make</label><input list="makes-list" className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-semibold" placeholder="Manufacturer..." value={newVehicle.make} onChange={e => setNewVehicle({ ...newVehicle, make: e.target.value })} /><datalist id="makes-list">{vehicleMakes.map(m => <option key={m.id} value={m.name} />)}</datalist></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Year</label><select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-semibold" value={newVehicle.year} onChange={e => setNewVehicle({...newVehicle, year: parseInt(e.target.value)})}>{yearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              </div>
            </div>
            <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => handleAdd(true)} className="py-4 border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm"><ICONS.FileText className="w-4 h-4" />Save Draft</button>
                <button onClick={() => handleAdd(false)} className="py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/20 text-sm">Register Fleet Asset</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ ...deleteModal, open: false })} onConfirm={() => onDelete(deleteModal.id)} title="Delete Vehicle?" message={`Are you sure you want to remove "${deleteModal.reg}"? All compliance data will be erased.`} confirmText="Delete Asset" />
    </div>
  );
};

export default VehicleList;