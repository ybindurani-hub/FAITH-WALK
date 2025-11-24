import React, { useState, useRef } from 'react';
import { getMissionaryBioWithMaps, speakText, cleanMarkdown, triggerSmartAd } from '../services/gemini';
import LoadingScreen from './LoadingScreen';

interface MissionaryBioProps { language: string; }

const MissionaryBio: React.FC<MissionaryBioProps> = ({ language }) => {
  const [name, setName] = useState('');
  const [bioData, setBioData] = useState<{ text: string, locations: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (!name.trim()) return;
    triggerSmartAd();
    setLoading(true);
    setBioData(null);
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const data = await getMissionaryBioWithMaps(name + ` (Reply in ${language})`);
      if (data.text === "MISSING_KEY" || data.text === "INVALID_KEY") {
        setBioData({ text: "API Key Error. Please ensure your environment is configured correctly.", locations: [] });
      } else if (data.text === "KEY_LEAKED") {
        setBioData({ text: "SECURITY ALERT: Your Google API Key was disabled because it was leaked online. Please generate a new key at aistudio.google.com and update your project.", locations: [] });
      } else if (data.text === "KEY_EXPIRED") {
        setBioData({ text: "API KEY EXPIRED: Your Google API Key is no longer valid. Please generate a new key at aistudio.google.com.", locations: [] });
      } else {
        setBioData(data);
      }
    } catch (e) {
      setBioData({ text: "Network Error. Please try again.", locations: [] });
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported.");
      return;
    }
    // @ts-ignore
    const recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      setName(event.results[0][0].transcript);
    };
    recognition.start();
  };

  const generateAudio = async () => {
    if (!bioData?.text) return;
    if (audioUrl && audioRef.current) { audioRef.current.play(); return; }
    setIsAudioLoading(true);
    try {
      const url = await speakText(bioData.text);
      setAudioUrl(url);
    } catch (e: any) {
      if (e.message === "KEY_LEAKED") alert("Cannot generate audio: API Key Leaked/Revoked.");
      else if (e.message === "KEY_EXPIRED") alert("Cannot generate audio: API Key Expired.");
      else alert(e.message === "MISSING_KEY" ? "API Key Missing." : e.message);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) { isPlaying ? audioRef.current.pause() : audioRef.current.play(); }
  };

  return (
    <div className="flex flex-col h-full relative">
      {loading && <LoadingScreen />}

      <div className="p-4 max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-0">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 rounded-2xl p-8 mb-6 border border-amber-100 dark:border-amber-900/50 shadow-sm shrink-0 transition-colors">
          <h2 className="text-3xl font-serif font-bold text-amber-900 dark:text-amber-100 mb-2">Heroes of Faith</h2>
          <p className="text-amber-800/80 dark:text-amber-200/60 text-sm mb-6">Explore the lives of God's Generals, Revivalists, and Reformers.</p>
          
          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <input
                type="text"
                className="w-full p-4 pr-12 rounded-xl border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                placeholder="e.g. Smith Wigglesworth, A.A. Allen..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button
                onClick={startListening}
                className={`absolute right-2 top-1/2 -translate-y-1/2 aspect-square flex items-center justify-center rounded-lg transition-all ${listening ? 'text-red-600 bg-red-50 animate-pulse' : 'text-amber-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            </div>
            
            <button onClick={handleGenerate} disabled={loading} className="bg-amber-700 text-white px-6 md:px-8 py-3 rounded-xl font-bold tracking-wide hover:bg-amber-800 shadow-md hover:shadow-lg transition-all">Go</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-48">
          {bioData && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {bioData.locations.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {bioData.locations.map((loc, idx) => (
                     <a key={idx} href={loc.uri} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-3 rounded-full shadow-sm hover:border-amber-300 transition-all text-sm font-bold text-slate-700 dark:text-slate-200">
                       <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                       {loc.title}
                     </a>
                  ))}
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative transition-colors">
                 <div className="flex justify-end mb-6">
                     {audioUrl && <audio ref={audioRef} src={audioUrl} autoPlay onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />}
                     {!audioUrl ? (
                         <button onClick={generateAudio} disabled={isAudioLoading} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 px-3 py-2 rounded-lg transition-colors border border-amber-100 dark:border-amber-900/50">
                           {isAudioLoading ? "Loading..." : "Listen"}
                         </button>
                     ) : (
                         <button onClick={togglePlayback} className="p-2 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-all flex items-center gap-2 px-3 border border-amber-100 dark:border-amber-800">
                            {isPlaying ? "PAUSE" : "PLAY"}
                         </button>
                     )}
                 </div>

                <div className="prose prose-amber dark:prose-invert max-w-none font-serif text-slate-800 dark:text-slate-200 leading-loose">
                  {cleanMarkdown(bioData.text).split('\n').map((line, i) => {
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="mb-4">{line}</p>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default MissionaryBio;