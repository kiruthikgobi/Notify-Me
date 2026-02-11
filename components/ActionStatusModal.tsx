
import React from 'react';
import { ICONS } from '../constants';

interface ActionStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
}

const ActionStatusModal: React.FC<ActionStatusModalProps> = ({ isOpen, onClose, title, message, type = 'success' }) => {
  if (!isOpen) return null;

  const config = {
    success: { 
      icon: ICONS.Check, 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
      btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
    },
    info: { 
      icon: ICONS.FileText, 
      color: 'text-primary-500', 
      bg: 'bg-primary-50 dark:bg-primary-900/20', 
      btn: 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20' 
    },
    warning: { 
      icon: ICONS.Alert, 
      color: 'text-amber-500', 
      bg: 'bg-amber-50 dark:bg-amber-900/20', 
      btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' 
    },
  };

  const { icon: Icon, color, bg, btn } = config[type];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center border border-slate-100 dark:border-slate-800">
        <div className={`mx-auto w-20 h-20 rounded-full ${bg} flex items-center justify-center mb-6`}>
          <Icon className={`w-10 h-10 ${color}`} />
        </div>
        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">
          {message}
        </p>
        <button 
          onClick={onClose}
          className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${btn}`}
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
};

export default ActionStatusModal;
