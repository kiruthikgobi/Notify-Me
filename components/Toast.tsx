
import React, { useEffect } from 'react';
import { ToastMessage } from '../types';
import { ICONS } from '../constants';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-[200] space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { icon: ICONS.Check, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
    warning: { icon: ICONS.Alert, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
    error: { icon: ICONS.Alert, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
    info: { icon: ICONS.FileText, color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/20', border: 'border-primary-200 dark:border-primary-800' },
  };

  const { icon: Icon, color, bg, border } = config[toast.type];

  return (
    <div className={`pointer-events-auto flex items-start gap-4 p-4 rounded-xl border ${bg} ${border} shadow-elevated animate-in slide-in-from-right-full duration-300`}>
      <div className={`p-2 rounded-lg bg-white dark:bg-slate-900 ${color} shadow-sm shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{toast.title}</h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{toast.message}</p>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
        <ICONS.Plus className="w-4 h-4 rotate-45" />
      </button>
    </div>
  );
};

export default Toast;
