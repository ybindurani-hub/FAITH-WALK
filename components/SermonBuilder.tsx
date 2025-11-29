import React, { useState, useRef } from 'react';
import { generateSermon, speakText, cleanMarkdown, triggerSmartAd } from '../services/gemini';
import LoadingScreen from './LoadingScreen';

interface SermonBuilderProps { language: string; }

const AUDIENCES = [
  "General Church Congregation", "Youth & Teens", "Kids / Sunday School", "New Believers",
  "Mature Believers / Leaders", "Evangelistic / Non-Believers", "Women's Ministry", "Men's Ministry"
];

const SermonBuilder: React.FC<SermonBuilderProps> = ({ language }) => {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [includeDeepContext, setIncludeDeepContext] = useState(false);
  const [sermon, setSermon] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleBuild = async () => {
    if (!topic.trim()) return;
    triggerSmartAd();
    setLoading(true);
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const result = await generateSermon(topic + ` (Write in ${language})`, { audience, includeDeepContext });
      if (result === "MISSING_KEY" || result === "INVALID_KEY") {
        setSermon("API Key Missing or Invalid. Please check your environment variables.");
      } else if (result === "KEY_LEAKED") {
        setSermon("SECURITY ALERT: Your Google API Key was disabled because it was leaked online. Please generate a new key at aistudio.google.com.");
      } else if (result === "KEY_EXPIRED") {
        setSermon("API KEY EXPIRED: Your Google API Key is no longer valid. Please generate a new key at aistudio.google.com.");
      } else {
        setSermon(result);
      }
    } catch (e: any) {
      setSermon("Error generating sermon. Please check connection.");
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
    recognition.onresult = (event: any) => { setTopic(event.results[0][0].transcript); };
    recognition.start();
  };

  const generateAudio = async () => {
    if (!sermon) return;
    if (audioUrl && audioRef.current) { audioRef.current.play(); return; }
    setIsAudioLoading(true);
    try {
      const url = await speakText(sermon);
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

      <div className="p-4 max-w-5xl mx-auto w-full flex-1 flex flex-col">
        {!sermon && (
          <div className="text-center mb-6 pt-4 shrink-0 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-3xl font-serif font-bold text-slate-800 dark:text-indigo-100 mb-2">Pulpit AI</h2>
            <p className="text-slate-500 dark:text-slate-400">Homiletics & Sermon Preparation</p>
          </div>
        )}

        {!sermon && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-6 max-w-2xl mx-auto w-full transition-colors">
            
            <label className="w-full relative group">
              <span className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Scripture or Topic</span>
              <input
                type="text"
                className="w-full p-4 pr-14 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg font-serif"
                placeholder="e.g. Romans 8, The Grace of God..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <button onClick={startListening} className={`absolute right-3 top-9 p-2 rounded-lg transition-all ${listening ? 'text-red-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Target Audience</span>
                <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-medium">
                  {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>

              <label className={`flex flex-col justify-center p-4 rounded-xl border cursor-pointer transition-all ${includeDeepContext ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200'}`}>
                <div className="flex items-center mb-1">
                    <input type="checkbox" checked={includeDeepContext} onChange={(e) => setIncludeDeepContext(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mr-3" />
                    <span className="font-bold text-indigo-900 dark:text-indigo-100">Deep Theology Mode</span>
                </div>
                <span className="text-xs text-indigo-700/70 dark:text-indigo-300/70 ml-8">Exegesis, Hebrew/Greek, History</span>
              </label>
            </div>
            
            <button onClick={handleBuild} disabled={loading || !topic} className="w-full mt-2 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 hover:-translate-y-0.5 disabled:opacity-50 transition-all">
              Generate Sermon
            </button>
          </div>
        )}

        {/* Removed internal scrolling to fix WebView height bug */}
        <div className="flex-1 pb-4">
          {sermon && (
            <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-8 relative transition-colors">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
                   <button onClick={() => setSermon('')} className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2 uppercase tracking-wider transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Start Over
                  </button>
                   <div className="flex items-center gap-3">
                       {audioUrl && <audio ref={audioRef} src={audioUrl} autoPlay onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />}
                       {!audioUrl ? (
                          <button onClick={generateAudio} disabled={isAudioLoading} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-2 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900">
                             {isAudioLoading ? "Preparing..." : "Listen to Sermon"}
                          </button>
                       ) : (
                          <button onClick={togglePlayback} className="p-2 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 rounded-md transition-all flex items-center gap-2 px-3 font-bold text-xs">
                            {isPlaying ? "PAUSE AUDIO" : "RESUME AUDIO"}
                          </button>
                       )}
                   </div>
              </div>
              <div className="prose prose-indigo dark:prose-invert prose-lg max-w-none font-serif text-slate-700 dark:text-slate-300">
                {cleanMarkdown(sermon).split('\n').map((line, i) => {
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="mb-4 leading-8">{line}</p>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SermonBuilder;