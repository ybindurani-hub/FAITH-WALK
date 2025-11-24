import React, { useEffect, useRef, useState } from 'react';
import { connectLiveSession } from '../services/gemini';

interface AudioCompanionProps {
  language: string;
}

const AudioCompanion: React.FC<AudioCompanionProps> = ({ language }) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualData, setVisualData] = useState<number>(0); // 0 to 255 representing volume intensity
  
  const sessionRef = useRef<{ close: () => Promise<void>, outputCtx: AudioContext } | null>(null);
  const nextStartTime = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Visualizer loop that reads actual frequency data
  useEffect(() => {
    const updateVisuals = () => {
      if (isActive && analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume level from frequencies
        let sum = 0;
        // Focus on lower to mid frequencies for better "voice" visualization
        const limit = Math.floor(dataArray.length / 2);
        for (let i = 0; i < limit; i++) {
          sum += dataArray[i];
        }
        const avg = sum / limit;
        
        // Smooth transition
        setVisualData(prev => prev * 0.8 + avg * 0.2);
      } else {
        setVisualData(0);
      }
      animationFrameRef.current = requestAnimationFrame(updateVisuals);
    };

    if (isActive) {
      updateVisuals();
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setVisualData(0);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isActive]);

  const toggleSession = async () => {
    if (isActive) {
      if (sessionRef.current) {
        await sessionRef.current.close();
        sessionRef.current = null;
      }
      sourcesRef.current.forEach(source => source.stop());
      sourcesRef.current.clear();
      nextStartTime.current = 0;
      analyserRef.current = null;
      
      setIsActive(false);
    } else {
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Your browser does not support audio input. Please use Chrome/Edge on HTTPS.");
        return;
      }

      try {
        const session = await connectLiveSession(
          (audioBuffer) => {
            if (!sessionRef.current) return;
            const ctx = sessionRef.current.outputCtx;
            
            // Set up Analyser if not exists
            if (!analyserRef.current) {
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.5;
              analyser.connect(ctx.destination);
              analyserRef.current = analyser;
            }

            nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            
            // Connect Source -> Analyser -> Destination
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
      } catch (e: any) {
        console.error(e);
        if (e.name === 'NotAllowedError') {
             setError("Microphone permission denied. Please allow access in settings.");
        } else {
             setError("Could not connect to Live Service. Check connection.");
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sourcesRef.current.forEach(s => s.stop());
      }
    };
  }, []);

  // Normalize volume for CSS
  const volumeScale = visualData / 255; 

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden text-white">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-500/30 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 py-6 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-sm shrink-0">
        <div>
           <h2 className="text-xl font-serif font-bold text-white tracking-wide">Live Counselor</h2>
           <p className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">{language.split('-')[0]} • {isActive ? "Connected" : "Ready"}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-slate-600'}`}></div>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 min-h-0">
        
        {/* The "Divine" Orb */}
        <div className="relative w-80 h-80 flex items-center justify-center shrink-0">
          
          {/* Active State: Radiating Energy */}
          {isActive ? (
             <>
               {/* Core Core - Glows Brighter with Volume */}
               <div className="absolute bg-white rounded-full blur-xl animate-pulse transition-all duration-75"
                    style={{ 
                      width: `${128 + volumeScale * 50}px`, 
                      height: `${128 + volumeScale * 50}px`,
                      opacity: 0.5 + volumeScale * 0.5 
                    }}></div>

               <div className="absolute bg-indigo-400 rounded-full blur-md transition-all duration-75"
                    style={{ 
                      width: `${112 + volumeScale * 40}px`, 
                      height: `${112 + volumeScale * 40}px`,
                      opacity: 0.8 + volumeScale * 0.2
                    }}></div>
               
               {/* Ripples - React to Volume dynamically */}
               <div className="absolute border border-indigo-300/40 rounded-full transition-all duration-100 ease-out"
                    style={{ 
                      width: `${160 + volumeScale * 150}px`, 
                      height: `${160 + volumeScale * 150}px`, 
                      opacity: Math.max(0.1, 0.8 - volumeScale)
                    }}></div>

               <div className="absolute border border-indigo-400/30 rounded-full transition-all duration-150 ease-out"
                    style={{ 
                      width: `${200 + volumeScale * 250}px`, 
                      height: `${200 + volumeScale * 250}px`, 
                      opacity: Math.max(0.05, 0.6 - volumeScale)
                    }}></div>

               <div className="absolute border border-amber-300/20 rounded-full transition-all duration-200 ease-out"
                    style={{ 
                      width: `${240 + volumeScale * 350}px`, 
                      height: `${240 + volumeScale * 350}px`, 
                      opacity: Math.max(0, 0.4 - volumeScale) 
                    }}></div>
             </>
          ) : (
            /* Inactive State: Silent Planet */
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

      {/* Control Footer */}
      <div className="p-8 pb-32 flex justify-center relative z-10 bg-gradient-to-t from-black/60 to-transparent shrink-0">
         {error && (
            <div className="absolute -top-10 text-red-200 bg-red-900/80 px-4 py-2 rounded-lg text-sm backdrop-blur-md shadow-lg border border-red-500/30">{error}</div>
         )}
         
         <button
           onClick={toggleSession}
           className={`group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold tracking-wider transition-all duration-300 shadow-xl ${
             isActive 
               ? 'bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/50' 
               : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-105'
           }`}
         >
           {isActive ? (
             <>
               <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
               END SESSION
             </>
           ) : (
             <>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               BEGIN CONVERSATION
             </>
           )}
         </button>
      </div>
    </div>
  );
};

export default AudioCompanion;