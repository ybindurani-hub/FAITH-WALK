import React, { useState, useRef } from 'react';
import { searchBible, speakText, cleanMarkdown, triggerSmartAd } from '../services/gemini';
import LoadingScreen from './LoadingScreen';

interface BibleSearchProps {
  language: string;
}

const BibleSearch: React.FC<BibleSearchProps> = ({ language }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  
  // Audio States
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    // Trigger Interstitial Ad
    triggerSmartAd();

    setLoading(true);
    setResult('');
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const text = await searchBible(query + ` (Reply in ${language})`);
      setResult(text);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    // @ts-ignore
    const recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
    };

    recognition.start();
  };

  const generateAudio = async () => {
    if (!result) return;
    if (audioUrl && audioRef.current) {
         audioRef.current.play();
         return;
    }
    
    setIsAudioLoading(true);
    try {
      const url = await speakText(result);
      setAudioUrl(url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {loading && <LoadingScreen />}
      
      <div className="p-4 max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-0">
        <h2 className="text-3xl font-serif font-bold text-slate-800 mb-6 text-center shrink-0">Scripture Search</h2>
        
        <div className="relative mb-6 shrink-0">
          <input
            type="text"
            className="w-full p-4 pr-24 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-lg transition-shadow"
            placeholder="Ask a question or find a verse..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          
          <div className="absolute right-2 top-2 bottom-2 flex gap-1">
            <button
              onClick={startListening}
              className={`p-3 rounded-xl transition-all ${listening ? 'bg-red-50 text-red-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
              title="Speak"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-48">
          {result && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
              
              {/* Audio Controls */}
              <div className="flex justify-end mb-4 border-b border-slate-50 pb-2 gap-2">
                 {/* Hidden Audio Element */}
                 {audioUrl && (
                   <audio 
                     ref={audioRef} 
                     src={audioUrl} 
                     autoPlay
                     onEnded={() => setIsPlaying(false)} 
                     onPause={() => setIsPlaying(false)}
                     onPlay={() => setIsPlaying(true)}
                   />
                 )}
                 
                 {!audioUrl ? (
                    <button 
                      onClick={generateAudio} 
                      disabled={isAudioLoading}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      {isAudioLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Generating Audio...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                          Read Aloud
                        </>
                      )}
                    </button>
                 ) : (
                    <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-1">
                      <button onClick={togglePlayback} className="p-2 text-indigo-700 hover:bg-white rounded-md transition-all shadow-sm flex items-center gap-2 px-3">
                        {isPlaying ? (
                          <>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            <span className="text-xs font-bold">PAUSE</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            <span className="text-xs font-bold">PLAY</span>
                          </>
                        )}
                      </button>
                    </div>
                 )}
              </div>

              {/* Text Display */}
              <div className="prose prose-indigo prose-lg font-serif text-slate-700 max-w-none">
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