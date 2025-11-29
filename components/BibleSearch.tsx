import React, { useState, useRef } from 'react';
import { searchBible, speakText, cleanMarkdown, triggerSmartAd } from '../services/gemini';
import LoadingScreen from './LoadingScreen';

interface BibleSearchProps { language: string; }

const BibleSearch: React.FC<BibleSearchProps> = ({ language }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    triggerSmartAd();
    setLoading(true);
    setResult('');
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const text = await searchBible(query + ` (Reply in ${language})`);
      if (text === "MISSING_KEY" || text === "INVALID_KEY") {
        setResult("API Key Issue: Please ensure your environment is configured correctly.");
      } else if (text === "KEY_LEAKED") {
        setResult("SECURITY ALERT: Your Google API Key was disabled because it was leaked online. Please generate a new key at aistudio.google.com.");
      } else if (text === "KEY_EXPIRED") {
        setResult("API KEY EXPIRED: Your Google API Key is no longer valid. Please generate a new key at aistudio.google.com.");
      } else {
        setResult(text);
      }
    } catch (e: any) { setResult("Network Error."); } finally { setLoading(false); }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert("Not supported."); return; }
    // @ts-ignore
    const recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => { setQuery(event.results[0][0].transcript); };
    recognition.start();
  };

  const generateAudio = async () => {
    if (!result) return;
    if (audioUrl && audioRef.current) { audioRef.current.play(); return; }
    setIsAudioLoading(true);
    try {
      const url = await speakText(result);
      setAudioUrl(url);
    } catch (e: any) { 
      if (e.message === "KEY_LEAKED") alert("Cannot generate audio: API Key Leaked/Revoked.");
      else if (e.message === "KEY_EXPIRED") alert("Cannot generate audio: API Key Expired.");
      else alert(e.message); 
    } finally { setIsAudioLoading(false); }
  };

  const togglePlayback = () => { if (audioRef.current) isPlaying ? audioRef.current.pause() : audioRef.current.play(); };

  return (
    <div className="flex flex-col min-h-full relative">
      {loading && <LoadingScreen />}
      
      <div className="p-4 max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <h2 className="text-3xl font-serif font-bold text-slate-800 dark:text-white mb-6 text-center">Scripture Search</h2>
        
        <div className="relative mb-6 group">
          <input
            type="text"
            className="w-full p-4 pr-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-lg transition-all"
            placeholder="Ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <div className="absolute right-2 top-2 bottom-2 flex gap-1">
            <button onClick={startListening} className={`p-3 rounded-xl transition-all ${listening ? 'bg-red-50 text-red-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <button onClick={handleSearch} disabled={loading} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </div>
        </div>

        {/* Removed internal scrolling (overflow-y-auto) to allow natural document flow */}
        <div className="flex-1 pb-4">
          {result && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 transition-colors">
              <div className="flex justify-end mb-4 border-b border-slate-50 dark:border-slate-800 pb-2 gap-2">
                 {audioUrl && <audio ref={audioRef} src={audioUrl} autoPlay onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />}
                 {!audioUrl ? (
                    <button onClick={generateAudio} disabled={isAudioLoading} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-lg transition-colors">
                      {isAudioLoading ? "Loading..." : "Read Aloud"}
                    </button>
                 ) : (
                    <button onClick={togglePlayback} className="p-2 text-indigo-700 dark:text-indigo-300 rounded-md transition-all shadow-sm flex items-center gap-2 px-3 border border-indigo-100 dark:border-indigo-900">
                      {isPlaying ? "PAUSE" : "PLAY"}
                    </button>
                 )}
              </div>
              <div className="prose prose-indigo dark:prose-invert prose-lg font-serif text-slate-700 dark:text-slate-300 max-w-none">
                {cleanMarkdown(result).split('\n').map((line, i) => {
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="mb-3 leading-relaxed">{line}</p>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default BibleSearch;