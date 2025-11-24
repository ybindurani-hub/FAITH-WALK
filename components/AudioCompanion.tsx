import React, { useEffect, useRef, useState } from 'react';
import { connectLiveSession } from '../services/gemini';

interface AudioCompanionProps { language: string; }

const AudioCompanion: React.FC<AudioCompanionProps> = ({ language }) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualData, setVisualData] = useState<number>(0); 
  // 0 = Unknown, 1 = Poor, 2 = Good, 3 = Excellent
  const [networkQuality, setNetworkQuality] = useState<number>(0); 
  const sessionRef = useRef<{ close: () => Promise<void>, outputCtx: AudioContext } | null>(null);
  const nextStartTime = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastChunkTimeRef = useRef<number>(0);

  useEffect(() => {
    const updateVisuals = () => {
      if (isActive && analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0; const limit = Math.floor(dataArray.length / 2);
        for (let i = 0; i < limit; i++) { sum += dataArray[i]; }
        setVisualData(prev => prev * 0.8 + (sum / limit) * 0.2);
      } else { setVisualData(0); }
      animationFrameRef.current = requestAnimationFrame(updateVisuals);
    };
    if (isActive) updateVisuals(); else { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); setVisualData(0); }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isActive]);

  const toggleSession = async () => {
    if (isActive) {
      if (sessionRef.current) { await sessionRef.current.close(); sessionRef.current = null; }
      sourcesRef.current.forEach(source => source.stop());
      sourcesRef.current.clear();
      nextStartTime.current = 0;
      analyserRef.current = null;
      setIsActive(false);
      setNetworkQuality(0);
    } else {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Audio not supported in this browser. Please check App Permissions.");
        return;
      }
      try {
        const session = await connectLiveSession(
          (audioBuffer) => {
            if (!sessionRef.current) return;
            const ctx = sessionRef.current.outputCtx;
            
            // Network Quality Heuristic based on chunk arrival intervals
            const now = Date.now();
            if (lastChunkTimeRef.current > 0) {
                const diff = now - lastChunkTimeRef.current;
                // If chunks arrive > 500ms apart, network is struggling
                if (diff > 500) setNetworkQuality(1); 
                else if (diff > 200) setNetworkQuality(2);
                else setNetworkQuality(3);
            }
            lastChunkTimeRef.current = now;

            if (!analyserRef.current) {
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.5;
              analyser.connect(ctx.destination);
              analyserRef.current = analyser;
            }

            // SMART JITTER BUFFER
            // If the buffer runs dry (nextStartTime < ctx.currentTime), it means lag occurred.
            // Instead of playing immediately (which causes robotic stutter), we add a small safety buffer (0.1s).
            if (nextStartTime.current < ctx.currentTime) {
                nextStartTime.current = ctx.currentTime + 0.1; 
            }

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyserRef.current);
            source.onended = () => sourcesRef.current.delete(source);
            source.start(nextStartTime.current);
            nextStartTime.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          },
          () => setIsActive(false)
        );
        sessionRef.current = session;
        setIsActive(true);
        setNetworkQuality(3); // Assume good start
        lastChunkTimeRef.current = Date.now();
      } catch (e: any) {
        if (e.message === "MIC_PERMISSION_DENIED") {
           setError("Microphone Access Denied. Please enable microphone permissions in your Device Settings.");
        } else if (e.message === "MISSING_KEY") {
           setError("API Key Missing. Please set it in Settings.");
        } else if (e.message === "KEY_LEAKED") {
            setError("Security Alert: Your API Key was disabled by Google. Please generate a new one.");
        } else if (e.message === "KEY_EXPIRED") {
            setError("API Key Expired. Please renew your key in Google AI Studio.");
        } else {
           setError(`Connection Failed: ${e.message}`);
        }
      }
    }
  };

  useEffect(() => { return () => { if (sessionRef.current) { sessionRef.current.close(); sourcesRef.current.forEach(s => s.stop()); } }; }, []);
  const volumeScale = visualData / 255; 

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden text-white">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-500/30 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 px-6 py-6 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-sm shrink-0">
        <div>
           <h2 className="text-xl font-serif font-bold text-white tracking-wide">Live Counselor</h2>
           <p className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">{language.split('-')[0]} • {isActive ? "Connected" : "Ready"}</p>
        </div>
        
        <div className="flex items-center gap-3">
             {/* Network Indicator */}
             {isActive && (
                 <div className="flex items-end gap-0.5 h-3" title="Connection Quality">
                     <div className={`w-1 rounded-sm transition-all duration-300 ${networkQuality >= 1 ? (networkQuality === 1 ? 'bg-red-500 h-1.5' : (networkQuality === 2 ? 'bg-yellow-400 h-1.5' : 'bg-green-400 h-1.5')) : 'bg-slate-700 h-1.5'}`}></div>
                     <div className={`w-1 rounded-sm transition-all duration-300 ${networkQuality >= 2 ? (networkQuality === 2 ? 'bg-yellow-400 h-2' : 'bg-green-400 h-2') : 'bg-slate-700 h-2'}`}></div>
                     <div className={`w-1 rounded-sm transition-all duration-300 ${networkQuality >= 3 ? 'bg-green-400 h-3' : 'bg-slate-700 h-3'}`}></div>
                 </div>
             )}
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-slate-600'}`}></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 min-h-0">
        <div className="relative w-80 h-80 flex items-center justify-center shrink-0">
          {isActive ? (
             <>
               <div className="absolute bg-white rounded-full blur-xl animate-pulse transition-all duration-75" style={{ width: `${128 + volumeScale * 50}px`, height: `${128 + volumeScale * 50}px`, opacity: 0.5 + volumeScale * 0.5 }}></div>
               <div className="absolute bg-indigo-400 rounded-full blur-md transition-all duration-75" style={{ width: `${112 + volumeScale * 40}px`, height: `${112 + volumeScale * 40}px`, opacity: 0.8 + volumeScale * 0.2 }}></div>
               <div className="absolute border border-indigo-300/40 rounded-full transition-all duration-100 ease-out" style={{ width: `${160 + volumeScale * 150}px`, height: `${160 + volumeScale * 150}px`, opacity: Math.max(0.1, 0.8 - volumeScale) }}></div>
             </>
          ) : (
             <>
              <div className="absolute w-40 h-40 rounded-full border border-indigo-500/30 flex items-center justify-center">
                 <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-900 to-slate-800 shadow-inner flex items-center justify-center">
                    <svg className="w-10 h-10 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                 </div>
              </div>
              <div className="absolute w-64 h-64 border border-white/5 rounded-full animate-[spin_20s_linear_infinite]"></div>
             </>
          )}
        </div>
        <p className={`mt-12 text-lg font-serif italic text-center max-w-sm transition-all duration-500 px-4 ${isActive ? 'text-indigo-100 opacity-100 translate-y-0' : 'text-slate-500 opacity-0 translate-y-4'}`}>
           {volumeScale > 0.05 ? "Speaking..." : "Listening..."}
        </p>
      </div>

      <div className="p-8 pb-32 flex justify-center relative z-10 bg-gradient-to-t from-black/60 to-transparent shrink-0">
         {error && (
            <div className="absolute -top-16 max-w-sm w-full text-center text-red-200 bg-red-900/90 px-4 py-3 rounded-lg text-sm backdrop-blur-md shadow-xl border border-red-500/50 animate-in slide-in-from-bottom-2">
              {error}
            </div>
         )}
         <button onClick={toggleSession} className={`group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold tracking-wider transition-all duration-300 shadow-xl ${isActive ? 'bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/50' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-105'}`}>
           {isActive ? ( <> <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span> END SESSION </> ) : ( <> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> START </> )}
         </button>
      </div>
    </div>
  );
};
export default AudioCompanion;