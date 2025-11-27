
import React, { useEffect, useState } from 'react';
import { getHistory, clearHistory, HistoryItem, HISTORY_EVENT } from '../services/cache';

const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const refreshHistory = () => {
    setHistory(getHistory());
  };

  useEffect(() => {
    refreshHistory();
    window.addEventListener(HISTORY_EVENT, refreshHistory);
    // Also listen to storage events (cross-tab sync)
    window.addEventListener('storage', refreshHistory);
    
    return () => {
      window.removeEventListener(HISTORY_EVENT, refreshHistory);
      window.removeEventListener('storage', refreshHistory);
    };
  }, []);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString() + ' ' + new Date(ts).toLocaleTimeString();
  };

  const getIcon = (tool: string) => {
    switch(tool) {
      case 'BIBLE': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
      case 'BIO': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
      case 'SERMON': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
      default: return null;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Result copied to clipboard!");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
            <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">History</h2>
            <button onClick={refreshHistory} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Refresh">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
        </div>
        {history.length > 0 && (
          <button onClick={() => { clearHistory(); }} className="text-sm text-red-500 hover:text-red-600 font-semibold px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors">
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-24 min-h-0">
        {history.length === 0 ? (
          <div className="text-center text-slate-400 mt-20">
            <div className="mb-4 flex justify-center opacity-30">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p>No history yet.</p>
            <p className="text-sm">Queries you make will appear here automatically.</p>
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wide">
                {getIcon(item.tool)}
                <span>{item.tool === 'BIO' ? 'Biography' : item.tool === 'BIBLE' ? 'Scripture' : 'Sermon'}</span>
                <span className="text-slate-400 font-normal ml-auto">{formatDate(item.timestamp)}</span>
              </div>
              <p className="font-serif font-bold text-slate-800 dark:text-slate-200 mb-2 truncate">{item.query.replace(/::.*/, '')}</p>
              <div className="text-slate-500 dark:text-slate-400 text-sm line-clamp-3 mb-3 font-serif">
                {typeof item.result === 'string' ? item.result : item.result.text}
              </div>
              <button 
                onClick={() => copyToClipboard(typeof item.result === 'string' ? item.result : item.result.text)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg w-full text-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                Copy Full Answer
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryView;
