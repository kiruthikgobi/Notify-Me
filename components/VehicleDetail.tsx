
import React, { useState, useRef } from 'react';
import { Vehicle, ComplianceRecord, ComplianceAuditInsight, ComplianceType, UserRole, VehicleMake } from '../types';
import { ICONS } from '../constants';
import { getComplianceAudit } from '../services/geminiService';
import { exportToExcel } from '../utils/exportUtils';
import ConfirmationModal from './ConfirmationModal';

interface VehicleDetailProps {
  vehicle: Vehicle;
  vehicleMakes: VehicleMake[];
  records: ComplianceRecord[];
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onUpdateRecord: (record: ComplianceRecord) => void;
  onDeleteVehicle: (id: string) => void;
  onBack: () => void;
  userRole?: UserRole;
}

const VehicleDetail: React.FC<VehicleDetailProps> = ({ vehicle, vehicleMakes, records, onUpdateVehicle, onUpdateRecord, onDeleteVehicle, onBack, userRole }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<ComplianceAuditInsight | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [editVehicleData, setEditVehicleData] = useState<Vehicle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localEdit, setLocalEdit] = useState<ComplianceRecord | null>(null);

  const isReadOnly = userRole === UserRole.TENANT_VIEWER;

  // We iterate over all compliance types to ensure the UI always shows placeholders for missing data
  const allDocTypes = Object.values(ComplianceType) as ComplianceType[];

  const handleAudit = async () => {
    setIsAuditing(true);
    try {
      const insight = await getComplianceAudit(vehicle, records);
      setAuditResult(insight);
    } catch (e) { console.error(e); } finally { setIsAuditing(false); }
  };

  const triggerUpload = (recordId: string) => {
    if (isReadOnly) return;
    setActiveUploadId(recordId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const record = records.find(r => r.id === activeUploadId);
    
    if (file && record) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdateRecord({ 
          ...record, 
          documentName: file.name, 
          documentUrl: event.target?.result as string 
        });
        setActiveUploadId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const viewDocument = (url: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  const startEdit = (docType: ComplianceType) => {
    if (isReadOnly) return;
    const existing = records.find(r => r.type === docType);
    
    setEditingId(existing ? existing.id : `temp-${docType}`);
    setLocalEdit(existing || {
      id: `temp-${docType}`,
      vehicleId: vehicle.id,
      tenantId: vehicle.company_id,
      type: docType,
      expiryDate: '',
      lastRenewedDate: '',
      alertEnabled: true,
      alertDaysBefore: 15,
      isDraft: true
    });
  };

  const saveEdit = (isDraft: boolean) => {
    if (localEdit) {
      onUpdateRecord({ ...localEdit, isDraft });
      setEditingId(null);
      setLocalEdit(null);
    }
  };

  const startEditVehicle = () => {
    setEditVehicleData({ ...vehicle });
    setIsEditingVehicle(true);
  };

  const saveEditVehicle = () => {
    if (editVehicleData) {
      onUpdateVehicle(editVehicleData);
      setIsEditingVehicle(false);
      setEditVehicleData(null);
    }
  };

  const getStatusInfo = (expiryDate: string, isDraft: boolean = false) => {
    if (isDraft) return { color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/10', label: 'Draft / Unverified' };
    if (!expiryDate) return { color: 'text-slate-400 bg-slate-100 dark:bg-slate-800', label: 'Data Missing' };
    const expiry = new Date(expiryDate);
    const now = new Date();
    if (expiry < now) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/10', label: 'Expired' };
    const soon = new Date(); soon.setDate(now.getDate() + 30);
    if (expiry < soon) return { color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/10', label: 'Expiring Soon' };
    return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10', label: 'Active / Verified' };
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 41 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileChange} />

      <div className="flex justify-between items-center print-hidden">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-semibold transition-colors">
          <ICONS.ChevronLeft className="w-5 h-5" />
          Back to Inventory
        </button>
        {!isReadOnly && (
          <button onClick={() => setIsDeleteModalOpen(true)} className="text-red-400 hover:text-red-600 font-bold flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all text-xs">
            <ICONS.Trash className="w-4 h-4" />
            Remove Vehicle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="ui-card p-8 rounded-3xl border-l-4 border-l-primary-600">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-full uppercase tracking-widest">{vehicle.type}</span>
                  {!isReadOnly && (
                    <button onClick={startEditVehicle} className="text-[10px] font-black text-slate-400 hover:text-primary-600 uppercase tracking-widest flex items-center gap-1">
                      <ICONS.FileText className="w-3 h-3" />
                      Edit Info
                    </button>
                  )}
                </div>
                <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white mt-3 tracking-tight uppercase">
                  {vehicle.vehicle_number}
                </h2>
                <p className="text-slate-500 font-medium flex items-center gap-2 mt-1">
                  {vehicle.make} {vehicle.model} 
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  {vehicle.year}
                </p>
              </div>
              <button onClick={handleAudit} disabled={isAuditing} className="w-full md:w-auto bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-7 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-xl shadow-slate-900/10">
                {isAuditing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ICONS.Brain className="w-4 h-4" />}
                Run AI Audit
              </button>
            </div>

            {auditResult && (
              <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    auditResult.status === 'Critical' ? 'bg-red-100 text-red-600' : 
                    auditResult.status === 'Warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {auditResult.status}
                  </div>
                  <h4 className="font-bold text-sm">AI Analysis Result</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed italic">"{auditResult.summary}"</p>
                <div className="space-y-3">
                  {auditResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <ICONS.Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ui-card rounded-3xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-soft">
            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
                <span className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">Compliance Documentation</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{allDocTypes.length} Monitored Aspects</span>
            </div>
            
            {allDocTypes.map((docType: ComplianceType) => {
              const record = records.find(r => r.type === docType);
              const status = getStatusInfo(record?.expiryDate || '', record?.isDraft);
              const isAlertWindow = record?.expiryDate && !record?.isDraft && (() => {
                const expiry = new Date(record.expiryDate);
                const alertStart = new Date(expiry);
                alertStart.setDate(expiry.getDate() - record.alertDaysBefore);
                return new Date() >= alertStart;
              })();

              const isEditing = editingId === (record ? record.id : `temp-${docType}`);

              return (
                <div key={docType as string} className={`p-6 hover:bg-slate-50/30 transition-all group ${record?.isDraft ? 'bg-amber-50/10' : ''}`}>
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${status.color}`}>
                        <ICONS.FileText className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            {docType as string}
                            {record?.isDraft && <span className="bg-amber-100 text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase ml-1">Draft</span>}
                            {isAlertWindow && record?.alertEnabled && (
                              <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ml-1 animate-pulse">Alerting Daily</span>
                            )}
                        </h4>
                        
                        {isEditing && localEdit ? (
                          <div className="mt-5 space-y-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-primary-500 shadow-2xl animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Document Expiry</label>
                                <input type="date" className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-all" value={localEdit.expiryDate} onChange={e => setLocalEdit({...localEdit, expiryDate: e.target.value})} />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Last Renewed Date</label>
                                <input type="date" className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-all" value={localEdit.lastRenewedDate} onChange={e => setLocalEdit({...localEdit, lastRenewedDate: e.target.value})} />
                              </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                               <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enable Individual Gmail Alerts</label>
                                  <button 
                                    type="button"
                                    onClick={() => setLocalEdit({...localEdit, alertEnabled: !localEdit.alertEnabled})}
                                    className={`w-12 h-6 rounded-full transition-all relative ${localEdit.alertEnabled ? 'bg-primary-600' : 'bg-slate-300'}`}
                                  >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localEdit.alertEnabled ? 'right-1' : 'left-1'}`} />
                                  </button>
                               </div>
                               <div className={`transition-all ${localEdit.alertEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Start Daily Alerts (Days Before Expiry)</label>
                                  <input 
                                    type="number" 
                                    className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl font-bold text-sm" 
                                    value={localEdit.alertDaysBefore} 
                                    onChange={e => setLocalEdit({...localEdit, alertDaysBefore: parseInt(e.target.value) || 0})} 
                                  />
                               </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button onClick={() => setEditingId(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs">Cancel</button>
                              <div className="flex flex-1 gap-3">
                                <button onClick={() => saveEdit(true)} className="flex-1 py-3.5 border-2 border-amber-200 text-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest">Save Draft</button>
                                <button onClick={() => saveEdit(false)} className="flex-1 py-3.5 bg-primary-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20">Publish</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${status.color}`}>{status.label}</span>
                            <div className="flex items-center gap-5">
                              {!isReadOnly && (
                                <button onClick={() => startEdit(docType)} className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 flex items-center gap-1.5 transition-colors">
                                  <ICONS.Plus className="w-3.5 h-3.5" />
                                  {record ? 'Edit Details' : 'Add Details'}
                                </button>
                              )}
                              
                              <div className="flex items-center gap-2">
                                {!isReadOnly && record && (
                                  <button onClick={() => triggerUpload(record.id)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-600 flex items-center gap-1.5 transition-colors">
                                    <ICONS.Download className="w-3.5 h-3.5 rotate-180" />
                                    Upload
                                  </button>
                                )}
                                {record?.documentUrl && (
                                  <button onClick={() => viewDocument(record.documentUrl!)} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 px-2.5 py-1 bg-emerald-50 rounded-lg">View Doc</button>
                                )}
                              </div>
                            </div>
                            {record && (
                              <div className="w-full flex items-center gap-4 mt-1">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${record.alertEnabled ? 'text-primary-500' : 'text-slate-300'}`}>
                                  {record.alertEnabled ? `Daily Reminder Active (-${record.alertDaysBefore}d)` : 'Alerts Disabled'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="md:text-right flex flex-col justify-center shrink-0">
                      <p className={`text-xl font-display font-black leading-none ${record?.isDraft ? 'text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                          {record?.expiryDate || '-- -- ----'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1.5">Expires On</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="ui-card p-8 rounded-3xl bg-primary-600 text-white shadow-2xl shadow-primary-500/20 group">
            <h4 className="font-display font-black text-xl mb-4 tracking-tight flex items-center gap-3">
               Audit Report
               <ICONS.Check className="w-5 h-5 text-white/50" />
            </h4>
            <p className="text-sm text-white/80 mb-8 leading-relaxed">Download a secure PDF/CSV summary for regulatory inspections and internal auditing.</p>
            <button onClick={() => exportToExcel([vehicle], records, `Audit_${vehicle.vehicle_number}`)} className="w-full py-4 bg-white text-primary-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <ICONS.Download className="w-4 h-4" />
              Download Audit
            </button>
          </div>
        </div>
      </div>
      
      {isEditingVehicle && editVehicleData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-end md:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 md:p-10 w-full max-w-xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300 overflow-y-auto max-h-[95vh] safe-pb">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold">Edit Vehicle Info</h3>
              <button onClick={() => setIsEditingVehicle(false)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ICONS.Plus className="w-6 h-6 rotate-45 text-slate-400" /></button>
            </div>
            <div className="space-y-6">
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Registration Number</label><input className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-black text-xl uppercase tracking-tighter" value={editVehicleData.vehicle_number} onChange={e => setEditVehicleData({...editVehicleData, vehicle_number: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Manufacturer</label><input list="makes-list-detail" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" value={editVehicleData.make} onChange={e => setEditVehicleData({...editVehicleData, make: e.target.value})} /><datalist id="makes-list-detail">{vehicleMakes.map(m => <option key={m.id} value={m.name} />)}</datalist></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Year</label><select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" value={editVehicleData.year} onChange={e => setEditVehicleData({...editVehicleData, year: parseInt(e.target.value)})}>{yearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              </div>
            </div>
            <div className="pt-10 flex gap-4">
              <button onClick={() => setIsEditingVehicle(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
              <button onClick={saveEditVehicle} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={() => onDeleteVehicle(vehicle.id)} title="Remove Asset?" message={`Are you sure you want to permanently delete "${vehicle.vehicle_number}"? All records will be lost.`} confirmText="Delete Asset" />
    </div>
  );
};

export default VehicleDetail;
