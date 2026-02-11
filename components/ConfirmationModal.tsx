import React from 'react';
import { ICONS } from '../constants';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
}) => {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: ICONS.Trash,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50 dark:bg-red-900/20',
      btnBg: 'bg-red-600 hover:bg-red-700',
      btnShadow: 'shadow-red-500/20',
    },
    warning: {
      icon: ICONS.Alert,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 dark:bg-amber-900/20',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      btnShadow: 'shadow-amber-500/20',
    },
    info: {
      icon: ICONS.FileText,
      iconColor: 'text-primary-600',
      iconBg: 'bg-primary-50 dark:bg-primary-900/20',
      btnBg: 'bg-primary-600 hover:bg-primary-700',
      btnShadow: 'shadow-primary-500/20',
    },
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-5">
          <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center shrink-0`}>
            <config.icon className={`w-7 h-7 ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-10">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 ${config.btnBg} ${config.btnShadow}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;