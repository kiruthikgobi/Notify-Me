
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
    return (localStorage.getItem('fg_view_preference') as ViewMode) || 'card';
  });
  const [isAdding, setIsAdding] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; reg: string }>({
    open: false, id: '', reg: ''
  });
  
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 41 }, (_, i) => currentYear - i);

  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    registrationNumber: '',
    make: '',
    model: '',
    year: currentYear,
    type: 'Truck'
  });

  // Updated Read-Only logic: Admins and Managers have full access. Viewers are restricted.
  const isReadOnly = userRole === UserRole.TENANT_VIEWER;
  const isAtLimit = tenantPlan === SubscriptionPlan.FREE && vehicles.length >= 5;

  useEffect(() => {
    localStorage.setItem('fg_view_preference', viewMode);
  }, [viewMode]);

  const filteredVehicles = vehicles.filter(v => {
    const searchMatch = v.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       v.make.toLowerCase().includes(searchTerm.toLowerCase());
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
    const expCount = vRecs.filter(r => r.expiryDate && new Date(r.expiryDate) < now).length;
    if (expCount > 0) return { label: 'Critical', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' };
    const soonCount = vRecs.filter(r => r.expiryDate && new Date(r.expiryDate) < soon && new Date(r.expiryDate) >= now).length;
    if (soonCount > 0) return { label: 'Renewal', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' };
    return { label: 'Healthy', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' };
  };

  const handleAdd = (draft: boolean = false) => {
    if (isReadOnly) return;
    
    if (!newVehicle.registrationNumber) return;
    
    onAdd({ 
      ...newVehicle as Vehicle, 
      registrationNumber: (newVehicle.registrationNumber || '').toUpperCase(),
      id: Date.now().toString(), 
      isDraft: draft,
      addedDate: new Date().toISOString().split('T')[0]
    }); 
    
    setIsAdding(false);
    setNewVehicle({
        registrationNumber: '',
        make: '',
        model: '',
        year: currentYear,
        type: 'Truck'
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, reg: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (isReadOnly) return;
    setDeleteModal({ open: true, id, reg });
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Fleet Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Registry of all managed automotive assets.</p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-col items-end gap-2 w-full lg:w-auto">
             <button 
                onClick={() => {
                   if (isAtLimit) onUpgradeRedirect();
                   else setIsAdding(true);
                }}
                className={`w-full lg:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
                  isAtLimit 
                  ? 'bg-red-600 text-white shadow-red-500/20 hover:bg-red-700' 
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/10'
                }`}
              >
                {isAtLimit ? <ICONS.Alert className="w-5 h-5" /> : <ICONS.Plus className="w-5 h-5" />}
                {isAtLimit ? 'Upgrade to Pro' : 'Add New Vehicle'}
              </button>
              {isAtLimit && (
                 <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded animate-pulse">
                    Limit Reached (5/5)
                 </span>
              )}
          </div>
        )}
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        <div className="relative flex-1">
          <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by registration or manufacturer..." 
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shrink-0 shadow-inner">
                {[
                    { id: 'card', icon: ICONS.Grid, label: 'Grid' },
                    { id: 'table', icon: ICONS.Table, label: 'Table' },
                    { id: 'list', icon: ICONS.List, label: 'List' }
                ].map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id as ViewMode)}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === mode.id ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <mode.icon className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">{mode.label}</span>
                    </button>
                ))}
            </div>

            {initialFilter && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl shrink-0">
                <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-widest">Filter: {initialFilter}</span>
                <button onClick={onClearFilter} className="text-primary-400 hover:text-primary-600"><ICONS.Plus className="w-4 h-4 rotate-45" /></button>
            </div>
            )}
        </div>
      </div>

      <div className="min-h-[400px]">
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {filteredVehicles.map(v => {
              const status = getComplianceStatus(v.id);
              return (
                <div 
                  key={v.id} 
                  onClick={() => onSelect(v)}
                  className={`ui-card rounded-[1.5rem] p-6 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 group relative transition-all flex flex-col h-full overflow-hidden ${v.isDraft ? 'border-dashed border-amber-400 bg-amber-50/5' : 'hover:shadow-elevated'}`}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    {!isReadOnly && (
                      <button 
                          onClick={(e) => handleDeleteClick(e, v.id, v.registrationNumber)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                          <ICONS.Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="mb-6 shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${v.isDraft ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 dark:bg-slate-800 text-primary-600 group-hover:bg-primary-600 group-hover:text-white'}`}>
                      <ICONS.Truck className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mb-6 flex-1 min-w-0">
                    <h3 className="text-xl font-display font-black text-slate-900 dark:text-white truncate mb-1 uppercase tracking-wider">
                      {v.registrationNumber}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium truncate mb-4">
                      {v.make} {v.model} • {v.year}
                    </p>
                    <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${status.color}`}>
                        {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6 mt-auto">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Class</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{v.type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registered</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{v.addedDate}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'table' && (
          <div className="ui-card rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registration</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manufacturer / Model</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVehicles.map(v => {
                    const status = getComplianceStatus(v.id);
                    return (
                      <tr 
                        key={v.id} 
                        onClick={() => onSelect(v)}
                        className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 cursor-pointer transition-colors group"
                      >
                        <td className="p-5">
                          <span className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider">{v.registrationNumber}</span>
                          {v.isDraft && <span className="ml-2 text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-md">DRAFT</span>}
                        </td>
                        <td className="p-5 text-sm font-medium text-slate-600 dark:text-slate-300">{v.make} {v.model} ({v.year})</td>
                        <td className="p-5 text-sm font-bold text-slate-500">{v.type}</td>
                        <td className="p-5">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-5 text-sm font-medium text-slate-400">{v.addedDate}</td>
                        <td className="p-5 text-right">
                          <div className="flex justify-end items-center gap-2">
                             <button className="p-2 text-slate-300 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100">
                               <ICONS.ChevronRight className="w-4 h-4" />
                             </button>
                             {!isReadOnly && (
                               <button 
                                 onClick={(e) => handleDeleteClick(e, v.id, v.registrationNumber)}
                                 className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                               >
                                 <ICONS.Trash className="w-4 h-4" />
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {filteredVehicles.map(v => {
              const status = getComplianceStatus(v.id);
              return (
                <div 
                  key={v.id} 
                  onClick={() => onSelect(v)}
                  className={`ui-card p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-all ${v.isDraft ? 'border-dashed' : ''}`}
                >
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${v.isDraft ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 dark:bg-slate-800 text-primary-600'}`}>
                      <ICONS.Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-black text-slate-900 dark:text-white uppercase tracking-wider">{v.registrationNumber}</h3>
                      <p className="text-xs text-slate-500 font-medium">{v.make} {v.model} • {v.type}</p>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-end gap-10 w-full md:w-auto">
                    <div className="hidden lg:block text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Registered On</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{v.addedDate}</p>
                    </div>
                    <div className="w-24 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {!isReadOnly && (
                      <button 
                        onClick={(e) => handleDeleteClick(e, v.id, v.registrationNumber)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredVehicles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-6">
              <ICONS.Search className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">No results found</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">Try adjusting your search or clear filters to see your fleet.</p>
          </div>
        )}
      </div>

      {isAdding && !isReadOnly && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 md:p-10 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Register New Asset</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <ICONS.Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Registration Number</label>
                <input 
                  required 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none transition-all font-bold text-lg uppercase tracking-widest" 
                  placeholder="MH-12-AS-1234" 
                  value={newVehicle.registrationNumber} 
                  onChange={e => setNewVehicle({...newVehicle, registrationNumber: e.target.value.toUpperCase()})} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Manufacturer</label>
                  <select 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-semibold transition-all"
                    value={newVehicle.make}
                    onChange={e => setNewVehicle({ ...newVehicle, make: e.target.value })}
                  >
                    <option value="">Select Manufacturer</option>
                    {vehicleMakes.map(make => (
                      <option key={make.id} value={make.name}>{make.name}</option>
                    ))}
                    {vehicleMakes.length === 0 && (
                      <option disabled>No manufacturers defined. Add some in settings.</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Model Year</label>
                  <select 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-semibold transition-all"
                    value={newVehicle.year}
                    onChange={e => setNewVehicle({...newVehicle, year: parseInt(e.target.value)})}
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Vehicle Class</label>
                  <select 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-semibold transition-all"
                    value={newVehicle.type}
                    onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})}
                  >
                    <option value="Truck">Truck</option>
                    <option value="Bus">Bus</option>
                    <option value="Car">Car</option>
                    <option value="Lorry">Lorry</option>
                  </select>
              </div>

              <div className="mt-2 text-[10px] text-slate-400 font-medium">
                * To add more manufacturers, visit the "Alert & Data Settings" tab.
              </div>
            </div>

            <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" onClick={() => handleAdd(true)} className="py-4 border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <ICONS.FileText className="w-5 h-5" />
                    Save as Draft
                </button>
                <button type="button" onClick={() => handleAdd(false)} className="py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/20 hover:bg-primary-700 active:scale-[0.98] transition-all">Complete Registration</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ ...deleteModal, open: false })}
        onConfirm={() => onDelete(deleteModal.id)}
        title="Delete Vehicle Asset?"
        message={`Are you sure you want to remove vehicle "${deleteModal.reg}" from the registry? All associated compliance records and audit history will be permanently erased.`}
        confirmText="Delete Asset"
        type="danger"
      />
    </div>
  );
};

export default VehicleList;
