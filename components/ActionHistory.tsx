
import React from 'react';
import { NotificationLog, UserRole } from '../types';
import { ICONS } from '../constants';

interface ActionHistoryProps {
  logs: NotificationLog[];
  userRole?: UserRole;
}

const ActionHistory: React.FC<ActionHistoryProps> = ({ logs, userRole }) => {
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Action History</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Audit log of all automated reminders and system dispatches.</p>
      </header>

      <div className="ui-card rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                <th className="p-6">Event Time</th>
                <th className="p-6">Asset Reg</th>
                <th className="p-6">Document</th>
                <th className="p-6">Recipient</th>
                <th className="p-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    No recent activities recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="p-6 text-xs font-bold text-slate-500">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="p-6">
                      <span className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {log.vehicle_reg}
                      </span>
                    </td>
                    <td className="p-6 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {log.doc_type}
                    </td>
                    <td className="p-6 text-xs font-medium text-slate-400">
                      {log.recipient}
                    </td>
                    <td className="p-6 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        log.status === 'SENT' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800 flex items-center gap-4">
        <ICONS.Brain className="w-6 h-6 text-primary-600 shrink-0" />
        <p className="text-xs text-primary-700 dark:text-primary-400 font-medium">
          The history shows the last 100 system events. For a full archival dump, please use the <span className="font-bold">Export Audit</span> tool on the dashboard.
        </p>
      </div>
    </div>
  );
};

export default ActionHistory;
