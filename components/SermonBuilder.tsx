import React, { useState, useRef } from 'react';
import { generateSermon, speakText, cleanMarkdown } from '../services/gemini';
import LoadingScreen from './LoadingScreen';

interface SermonBuilderProps {
  language: string;
}

const AUDIENCES = [
  "General Church Congregation",
  "Youth & Teens",
  "Kids / Sunday School",
  "New Believers",
  "Mature Believers / Leaders",
  "Evangelistic / Non-Believers",
  "Women's Ministry",
  "Men's Ministry"
];

const SermonBuilder: React.FC<SermonBuilderProps> = ({ language }) => {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [includeDeepContext, setIncludeDeepContext] = useState(false);
  const [sermon, setSermon] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleBuild = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const result = await generateSermon(
        topic + ` (Write in ${language})`, 
        { audience, includeDeepContext }
      );
      setSermon(result);
    } catch (e: any) {
      setSermon(`Error: ${e.message}`);
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
      setTopic(transcript);
    };

    recognition.start();
  };

  const generateAudio = async () => {
    if (!sermon || audioUrl) {
      if(audioUrl && audioRef.current) {
         audioRef.current.play();
         setIsPlaying(true);
      }
      return;
    }
    
    const url = await speakText(sermon);
    if (url) {
      setAudioUrl(url);
      setIsPlaying(true);
      // Auto-play handled by audio tag
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

      <div className="p-4 max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {!sermon && (
           <div className="text-center mb-8 pt-4 shrink-0">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Pulpit AI</h2>
            <p className="text-slate-500">Professional Homiletics & Sermon Preparation Tool</p>
          </div>
        )}

        {!sermon && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col gap-6 max-w-2xl mx-auto w-full">
            
            {/* Topic Input */}
            <label className="w-full relative">
              <span className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Scripture or Topic</span>
              <input
                type="text"
                className="w-full p-4 pr-14 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg"
                placeholder="e.g. Romans 8, The Grace of God..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
               <button
                onClick={startListening}
                className={`absolute right-3 top-9 p-2 rounded-lg transition-all ${listening ? 'text-red-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            </label>

            {/* Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Target Audience</span>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-medium"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>

              <label className={`flex flex-col justify-center p-4 rounded-xl border cursor-pointer transition-all ${includeDeepContext ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}>
                <div className="flex items-center mb-1">
                    <input
                        type="checkbox"
                        checked={includeDeepContext}
                        onChange={(e) => setIncludeDeepContext(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mr-3"
                    />
                    <span className="font-bold text-indigo-900">Deep Theology</span>
                </div>
                <span className="text-xs text-indigo-700/70 ml-8">Exegesis, Hebrew/Greek, History</span>
              </label>
            </div>
            
            <button
              onClick={handleBuild}
              disabled={loading || !topic}
              className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 transition-all"
            >
              Generate Sermon
            </button>
          </div>
        )}

        {sermon && (
          <div className="flex-1 overflow-y-auto bg-white p-10 rounded-3xl shadow-sm border border-slate-100 pb-48 animate-in fade-in slide-in-from-bottom-8 relative">
            <div className="flex justify-between items-center mb-6">
                 <button 
                  onClick={() => setSermon('')} 
                  className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2 uppercase tracking-wider transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Start Over
                </button>

                 {/* Audio Controls */}
                 <div className="flex items-center gap-3">
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
                        <button onClick={generateAudio} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors border border-indigo-100">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                           Listen
                         </button>
                     ) : (
                        <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-1 border border-indigo-100">
                            <button onClick={togglePlayback} className="p-2 text-indigo-700 hover:bg-white rounded-md transition-all shadow-sm">
                              {isPlaying ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                              )}
                            </button>
                        </div>
                     )}
                 </div>
            </div>
           
            <div className="prose prose-indigo prose-lg max-w-none font-serif text-slate-700">
              {cleanMarkdown(sermon).split('\n').map((line, i) => {
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="mb-4 leading-7">{line}</p>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SermonBuilder;