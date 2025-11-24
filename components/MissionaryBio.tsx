import React, { useState, useRef } from 'react';
import { getMissionaryBioWithMaps, speakText, cleanMarkdown } from '../services/gemini';
import LoadingScreen from './LoadingScreen';

interface MissionaryBioProps {
  language: string;
}

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
    setLoading(true);
    setBioData(null);
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const data = await getMissionaryBioWithMaps(name + ` (Reply in ${language})`);
      setBioData(data);
    } catch (e) {
      alert("Could not fetch biography. Check network/API Key.");
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
      setName(transcript);
    };

    recognition.start();
  };

  const generateAudio = async () => {
    if (!bioData?.text) return;
    if (audioUrl && audioRef.current) {
         audioRef.current.play();
         return;
    }
    
    setIsAudioLoading(true);
    const url = await speakText(bioData.text);
    setIsAudioLoading(false);
    
    if (url) {
      setAudioUrl(url);
      setTimeout(() => {
        if(audioRef.current) audioRef.current.play();
      }, 100);
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
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 mb-6 border border-amber-100 shadow-sm shrink-0">
          <h2 className="text-3xl font-serif font-bold text-amber-900 mb-2">Heroes of Faith</h2>
          <p className="text-amber-800/80 text-sm mb-6">Discover the lives, miracles, and fields of service of God's generals.</p>
          
          <div className="flex gap-2 relative">
            <input
              type="text"
              className="flex-1 p-4 pr-14 rounded-xl border-amber-200 border shadow-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              placeholder="e.g., Hudson Taylor, Amy Carmichael..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
             <button
              onClick={startListening}
              className={`absolute right-24 top-2 bottom-2 p-2 rounded-lg transition-all ${listening ? 'text-red-600 animate-pulse' : 'text-amber-400 hover:text-amber-600'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <button 
              onClick={handleGenerate}
              disabled={loading}
              className="bg-amber-700 text-white px-8 py-3 rounded-xl font-bold tracking-wide hover:bg-amber-800 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
            >
              Go
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-48">
          {bioData && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {/* Maps Integration Section */}
              {bioData.locations.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {bioData.locations.map((loc, idx) => (
                     <a 
                       key={idx} 
                       href={loc.uri} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex-shrink-0 flex items-center gap-2 bg-white border border-slate-200 px-5 py-3 rounded-full shadow-sm hover:shadow-md hover:border-amber-300 transition-all text-sm font-bold text-slate-700"
                     >
                       <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                       {loc.title}
                     </a>
                  ))}
                </div>
              )}

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative">
                 {/* Audio Player */}
                 <div className="absolute top-8 right-8">
                     {audioUrl && (
                       <audio 
                         ref={audioRef} 
                         src={audioUrl} 
                         onEnded={() => setIsPlaying(false)} 
                         onPause={() => setIsPlaying(false)}
                         onPlay={() => setIsPlaying(true)}
                       />
                     )}
                     
                     {!audioUrl ? (
                         <button 
                           onClick={generateAudio} 
                           disabled={isAudioLoading}
                           className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 hover:bg-amber-50 px-3 py-2 rounded-lg transition-colors border border-amber-100"
                          >
                           {isAudioLoading ? (
                             <>
                               <svg className="animate-spin h-4 w-4 text-amber-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                               Wait...
                             </>
                           ) : (
                             <>
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                               Listen
                             </>
                           )}
                         </button>
                     ) : (
                         <div className="flex items-center gap-2 bg-amber-50 rounded-lg p-1 border border-amber-100">
                           <button onClick={togglePlayback} className="p-2 text-amber-800 hover:bg-white rounded-md transition-all shadow-sm flex items-center gap-2 px-3">
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

                <div className="prose prose-amber max-w-none font-serif text-slate-800 leading-loose mt-8">
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