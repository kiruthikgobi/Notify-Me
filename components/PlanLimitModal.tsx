
import React from 'react';
import { ICONS } from '../constants';

interface PlanLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const PlanLimitModal: React.FC<PlanLimitModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 text-center border border-slate-100 dark:border-slate-800">
        <div className="mx-auto w-24 h-24 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-8">
          <ICONS.Alert className="w-12 h-12 text-red-600" />
        </div>
        
        <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          Maximum Limit Reached
        </h3>
        
        <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-medium">
          You have reached the limit of 5 vehicles in the Free plan. Please subscribe to Pro to add unlimited vehicles.
        </p>
        
        <div className="space-y-3">
          <button 
            onClick={onUpgrade}
            className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs tracking-widest shadow-xl shadow-primary-500/20 transition-all active:scale-95"
          >
            Subscribe to Pro – ₹99/year
          </button>
          <button 
            onClick={onClose}
            className="w-full py-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanLimitModal;
