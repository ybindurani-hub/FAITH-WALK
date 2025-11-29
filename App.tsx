import React, { useState, useEffect, Suspense, lazy } from 'react';
import { View } from './types';
import LoadingScreen from './components/LoadingScreen';
import BibleSearch from './components/BibleSearch'; // Static import for instant load

// Lazy load other components
const MissionaryBio = lazy(() => import('./components/MissionaryBio'));
const SermonBuilder = lazy(() => import('./components/SermonBuilder'));
const AudioCompanion = lazy(() => import('./components/AudioCompanion'));
const HistoryView = lazy(() => import('./components/HistoryView'));

// 100+ Languages
const LANGUAGES = [
  { code: 'en-US', name: 'English' }, { code: 'hi-IN', name: 'Hindi' }, { code: 'ta-IN', name: 'Tamil' }, { code: 'te-IN', name: 'Telugu' },
  { code: 'ml-IN', name: 'Malayalam' }, { code: 'kn-IN', name: 'Kannada' }, { code: 'mr-IN', name: 'Marathi' }, { code: 'gu-IN', name: 'Gujarati' },
  { code: 'pa-IN', name: 'Punjabi' }, { code: 'bn-IN', name: 'Bengali' }, { code: 'ur-PK', name: 'Urdu' }, { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' }, { code: 'de-DE', name: 'German' }, { code: 'it-IT', name: 'Italian' }, { code: 'pt-BR', name: 'Portuguese' },
  { code: 'ru-RU', name: 'Russian' }, { code: 'zh-CN', name: 'Chinese' }, { code: 'ja-JP', name: 'Japanese' }, { code: 'ko-KR', name: 'Korean' },
  { code: 'ar-SA', name: 'Arabic' }, { code: 'id-ID', name: 'Indonesian' }, { code: 'th-TH', name: 'Thai' }, { code: 'vi-VN', name: 'Vietnamese' }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.BIBLE_SEARCH);
  const [language, setLanguage] = useState<string>('en-US');
  const [darkMode, setDarkMode] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Track which views have been loaded to prevent lazy fetching before needed
  const [visitedViews, setVisitedViews] = useState<Set<View>>(new Set([View.BIBLE_SEARCH]));

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const changeView = (view: View) => {
    setCurrentView(view);
    setVisitedViews(prev => {
        const next = new Set(prev);
        next.add(view);
        return next;
    });
  };

  const NavButton = ({ view, label, icon, disabled = false }: { view: View; label: string; icon: React.ReactNode, disabled?: boolean }) => (
    <button
      onClick={() => !disabled && changeView(view)}
      disabled={disabled}
      className={`flex flex-col items-center justify-center w-full py-3 transition-all duration-300 ${
        disabled ? 'opacity-30 cursor-not-allowed' :
        currentView === view 
          ? 'text-indigo-600 dark:text-indigo-400 -translate-y-1' 
          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      <div className={`mb-1 ${currentView === view ? 'scale-110 drop-shadow-md' : 'scale-100'} transition-transform`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${currentView === view ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col min-h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300">
        
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-400">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-lg font-serif font-bold tracking-tight text-slate-800 dark:text-indigo-100 hidden sm:block">FaithWalk AI</h1>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-yellow-300 transition-colors">
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
          </button>

          <div className="relative">
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 pl-3 pr-8 rounded-lg text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[120px] shadow-sm"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-500/90 text-white text-center py-2 text-xs font-bold animate-pulse">
           OFFLINE MODE: Using saved history & cached assets. Live features disabled.
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col pb-40">
        <div className={`${currentView === View.BIBLE_SEARCH ? 'flex flex-1 flex-col' : 'hidden'}`}>
           <BibleSearch language={language} />
        </div>

        <Suspense fallback={<LoadingScreen />}>
          {visitedViews.has(View.MISSIONARY) && (
             <div className={`${currentView === View.MISSIONARY ? 'flex flex-1 flex-col' : 'hidden'}`}>
                <MissionaryBio language={language} />
             </div>
          )}
          {visitedViews.has(View.SERMON) && (
             <div className={`${currentView === View.SERMON ? 'flex flex-1 flex-col' : 'hidden'}`}>
                <SermonBuilder language={language} />
             </div>
          )}
          {visitedViews.has(View.AUDIO_COMPANION) && (
             <div className={`${currentView === View.AUDIO_COMPANION ? 'block h-[85vh] min-h-[500px]' : 'hidden'}`}>
                <AudioCompanion language={language} isActiveView={currentView === View.AUDIO_COMPANION && !isOffline} />
             </div>
          )}
          {visitedViews.has(View.HISTORY) && (
             <div className={`${currentView === View.HISTORY ? 'flex flex-1 flex-col' : 'hidden'}`}>
                <HistoryView />
             </div>
          )}
        </Suspense>
      </main>

      {/* Fixed Footer */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between max-w-2xl mx-auto px-2">
          <NavButton view={View.BIBLE_SEARCH} label="Scripture" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
          <NavButton view={View.MISSIONARY} label="Missions" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <NavButton view={View.SERMON} label="Sermons" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>} />
          <NavButton 
             view={View.AUDIO_COMPANION} 
             label="Live" 
             disabled={isOffline}
             icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>} 
          />
           <NavButton view={View.HISTORY} label="History" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>
      </nav>
    </div>
  );
};
export default App;