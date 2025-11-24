import React, { useState, useEffect } from 'react';
import { View } from './types';
import BibleSearch from './components/BibleSearch';
import MissionaryBio from './components/MissionaryBio';
import SermonBuilder from './components/SermonBuilder';
import AudioCompanion from './components/AudioCompanion';

// 100+ Languages sorted
const LANGUAGES = [
  { code: 'af-ZA', name: 'Afrikaans' }, { code: 'sq-AL', name: 'Albanian' }, { code: 'am-ET', name: 'Amharic' }, { code: 'ar-SA', name: 'Arabic' },
  { code: 'hy-AM', name: 'Armenian' }, { code: 'as-IN', name: 'Assamese' }, { code: 'az-AZ', name: 'Azerbaijani' }, { code: 'eu-ES', name: 'Basque' },
  { code: 'be-BY', name: 'Belarusian' }, { code: 'bn-IN', name: 'Bengali' }, { code: 'bs-BA', name: 'Bosnian' }, { code: 'bg-BG', name: 'Bulgarian' },
  { code: 'ca-ES', name: 'Catalan' }, { code: 'ceb-PH', name: 'Cebuano' }, { code: 'zh-CN', name: 'Chinese (Simp)' }, { code: 'zh-TW', name: 'Chinese (Trad)' },
  { code: 'hr-HR', name: 'Croatian' }, { code: 'cs-CZ', name: 'Czech' }, { code: 'da-DK', name: 'Danish' }, { code: 'nl-NL', name: 'Dutch' },
  { code: 'en-US', name: 'English' }, { code: 'et-EE', name: 'Estonian' }, { code: 'tl-PH', name: 'Filipino' }, { code: 'fi-FI', name: 'Finnish' },
  { code: 'fr-FR', name: 'French' }, { code: 'gl-ES', name: 'Galician' }, { code: 'ka-GE', name: 'Georgian' }, { code: 'de-DE', name: 'German' },
  { code: 'el-GR', name: 'Greek' }, { code: 'gu-IN', name: 'Gujarati' }, { code: 'ht-HT', name: 'Haitian Creole' }, { code: 'ha-NG', name: 'Hausa' },
  { code: 'he-IL', name: 'Hebrew' }, { code: 'hi-IN', name: 'Hindi' }, { code: 'hmn-CN', name: 'Hmong' }, { code: 'hu-HU', name: 'Hungarian' },
  { code: 'is-IS', name: 'Icelandic' }, { code: 'ig-NG', name: 'Igbo' }, { code: 'id-ID', name: 'Indonesian' }, { code: 'ga-IE', name: 'Irish' },
  { code: 'it-IT', name: 'Italian' }, { code: 'ja-JP', name: 'Japanese' }, { code: 'jw-ID', name: 'Javanese' }, { code: 'kn-IN', name: 'Kannada' },
  { code: 'kk-KZ', name: 'Kazakh' }, { code: 'km-KH', name: 'Khmer' }, { code: 'ko-KR', name: 'Korean' }, { code: 'ku-TR', name: 'Kurdish' },
  { code: 'ky-KG', name: 'Kyrgyz' }, { code: 'lo-LA', name: 'Lao' }, { code: 'la-VA', name: 'Latin' }, { code: 'lv-LV', name: 'Latvian' },
  { code: 'lt-LT', name: 'Lithuanian' }, { code: 'lb-LU', name: 'Luxembourgish' }, { code: 'mk-MK', name: 'Macedonian' }, { code: 'mg-MG', name: 'Malagasy' },
  { code: 'ms-MY', name: 'Malay' }, { code: 'ml-IN', name: 'Malayalam' }, { code: 'mt-MT', name: 'Maltese' }, { code: 'mi-NZ', name: 'Maori' },
  { code: 'mr-IN', name: 'Marathi' }, { code: 'mn-MN', name: 'Mongolian' }, { code: 'my-MM', name: 'Myanmar' }, { code: 'ne-NP', name: 'Nepali' },
  { code: 'no-NO', name: 'Norwegian' }, { code: 'ny-MW', name: 'Nyanja' }, { code: 'or-IN', name: 'Odia' }, { code: 'ps-AF', name: 'Pashto' },
  { code: 'fa-IR', name: 'Persian' }, { code: 'pl-PL', name: 'Polish' }, { code: 'pt-BR', name: 'Portuguese' }, { code: 'pa-IN', name: 'Punjabi' },
  { code: 'ro-RO', name: 'Romanian' }, { code: 'ru-RU', name: 'Russian' }, { code: 'sm-WS', name: 'Samoan' }, { code: 'sr-RS', name: 'Serbian' },
  { code: 'st-LS', name: 'Sesotho' }, { code: 'sn-ZW', name: 'Shona' }, { code: 'sd-PK', name: 'Sindhi' }, { code: 'si-LK', name: 'Sinhala' },
  { code: 'sk-SK', name: 'Slovak' }, { code: 'sl-SI', name: 'Slovenian' }, { code: 'so-SO', name: 'Somali' }, { code: 'es-ES', name: 'Spanish' },
  { code: 'su-ID', name: 'Sundanese' }, { code: 'sw-KE', name: 'Swahili' }, { code: 'sv-SE', name: 'Swedish' }, { code: 'tg-TJ', name: 'Tajik' },
  { code: 'ta-IN', name: 'Tamil' }, { code: 'te-IN', name: 'Telugu' }, { code: 'th-TH', name: 'Thai' }, { code: 'tr-TR', name: 'Turkish' },
  { code: 'uk-UA', name: 'Ukrainian' }, { code: 'ur-PK', name: 'Urdu' }, { code: 'uz-UZ', name: 'Uzbek' }, { code: 'vi-VN', name: 'Vietnamese' },
  { code: 'cy-GB', name: 'Welsh' }, { code: 'xh-ZA', name: 'Xhosa' }, { code: 'yi-DE', name: 'Yiddish' }, { code: 'yo-NG', name: 'Yoruba' },
  { code: 'zu-ZA', name: 'Zulu' },
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.BIBLE_SEARCH);
  const [language, setLanguage] = useState<string>('en-US');
  const [darkMode, setDarkMode] = useState(false);

  // Apply Dark Mode to the HTML document element (Global fix)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const NavButton = ({ view, label, icon }: { view: View; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex flex-col items-center justify-center w-full py-3 transition-all duration-300 ${
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
    <div className="h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans overflow-hidden transition-colors duration-300">
        
      {/* Top Header */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm shrink-0 transition-colors">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-lg font-serif font-bold tracking-tight text-slate-800 dark:text-indigo-100 hidden sm:block">FaithWalk AI</h1>
        </div>

        <div className="flex items-center gap-2">
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
                className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 pl-3 pr-8 rounded-lg text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[100px] sm:max-w-[140px] shadow-sm hover:border-indigo-300 transition-colors"
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

      <main className="flex-1 overflow-hidden relative w-full min-h-0">
        <div className={`w-full h-full ${currentView === View.BIBLE_SEARCH ? 'block' : 'hidden'}`}>
          <BibleSearch language={language} />
        </div>
        <div className={`w-full h-full ${currentView === View.MISSIONARY ? 'block' : 'hidden'}`}>
            <MissionaryBio language={language} />
        </div>
        <div className={`w-full h-full ${currentView === View.SERMON ? 'block' : 'hidden'}`}>
            <SermonBuilder language={language} />
        </div>
        <div className={`w-full h-full ${currentView === View.AUDIO_COMPANION ? 'block' : 'hidden'}`}>
            <AudioCompanion language={language} />
        </div>
      </main>

      <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe z-40 shrink-0 transition-colors">
        <div className="flex justify-between max-w-2xl mx-auto px-2">
          <NavButton 
            view={View.BIBLE_SEARCH} 
            label="Scripture" 
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} 
          />
          <NavButton 
            view={View.MISSIONARY} 
            label="Missions" 
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
          />
          <NavButton 
            view={View.SERMON} 
            label="Sermons" 
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>} 
          />
          <NavButton 
            view={View.AUDIO_COMPANION} 
            label="Live" 
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>} 
          />
        </div>
      </nav>
    </div>
  );
};

export default App;