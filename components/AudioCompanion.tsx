import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, downsampleBuffer } from '../utils/audioUtils';
import { getApiKey } from '../services/gemini';
import { saveToCache } from '../services/cache';

interface AudioCompanionProps { language: string; isActiveView?: boolean; }

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type SpeakerState = 'listening' | 'processing' | 'speaking';

const AudioCompanion: React.FC<AudioCompanionProps> = ({ language, isActiveView = true }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [speakerState, setSpeakerState] = useState<SpeakerState>('listening');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Settings
  const [volume, setVolume] = useState(0.8);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Updates for real-time control
  useEffect(() => {
    if (outputNodeRef.current) {
      outputNodeRef.current.gain.setTargetAtTime(volume, outputContextRef.current?.currentTime || 0, 0.1);
    }
  }, [volume]);

  useEffect(() => {
    // Note: Live playback rate changes can cause buffer gaps, handled carefully here
    sourcesRef.current.forEach(source => {
      try { source.playbackRate.value = playbackSpeed; } catch (e) {}
    });
  }, [playbackSpeed]);

  const transcriptRef = useRef<{ user: string; model: string }>({ user: '', model: '' });

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    return () => { stopSession(); };
  }, []);

  const startSession = async () => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API Key is missing.");

      setStatus('connecting');
      setErrorMessage('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone not supported.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      if (inputContextRef.current.state === 'suspended') await inputContextRef.current.resume();

      outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      if (outputContextRef.current.state === 'suspended') await outputContextRef.current.resume();
      
      analyserRef.current = outputContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.5;
      outputNodeRef.current = outputContextRef.current.createGain();
      outputNodeRef.current.gain.value = volume;
      outputNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(outputContextRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } 
      });
      streamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: `You are FaithWalk, a professional spiritual counselor.
          User Language: ${language}.
          CORE BEHAVIORS:
          1. Adaptive Depth: Provide LONG, DETAILED responses with Biblical scripture and Jewish history when asked.
          2. Natural: Speak as if on a warm phone call.
          3. Tone: Empathic, wise, counselor-like.`,
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            setStatus('connected');
            setIsActive(true);
            setSpeakerState('listening');
            setupAudioInput(stream);
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputContextRef.current) {
                setSpeakerState('speaking');
                const ctx = outputContextRef.current;
                const currentTime = ctx.currentTime;
                
                if (nextStartTimeRef.current < currentTime) nextStartTimeRef.current = currentTime;
                
                try {
                  const audioBuffer = await decodeAudioData(base64Audio, ctx);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.playbackRate.value = playbackSpeed;
                  source.connect(outputNodeRef.current!);
                  source.addEventListener('ended', () => { 
                      if (ctx.currentTime >= nextStartTimeRef.current - 0.2) setSpeakerState('listening');
                      sourcesRef.current.delete(source);
                  });
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += (audioBuffer.duration / playbackSpeed);
                  sourcesRef.current.add(source);
                } catch (err) { console.error("Audio Error", err); }
             }

             if (message.serverContent?.inputTranscription?.text) transcriptRef.current.user += message.serverContent.inputTranscription.text;
             if (message.serverContent?.outputTranscription?.text) transcriptRef.current.model += message.serverContent.outputTranscription.text;

             if (message.serverContent?.turnComplete) {
                if (transcriptRef.current.user.trim() || transcriptRef.current.model.trim()) {
                    saveToCache('LIVE', transcriptRef.current.user, transcriptRef.current.model, language);
                }
                transcriptRef.current = { user: '', model: '' };
             }

             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
                sourcesRef.current.clear();
                if (outputContextRef.current) nextStartTimeRef.current = outputContextRef.current.currentTime;
                setSpeakerState('listening');
             }
          },
          onclose: () => { setStatus('disconnected'); setIsActive(false); },
          onerror: (err) => { setStatus('error'); setErrorMessage("Connection error."); stopSession(); }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      await sessionPromise;
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(e.message || "Failed to start.");
      stopSession();
    }
  };

  const setupAudioInput = (stream: MediaStream) => {
    if (!inputContextRef.current) return;
    const ctx = inputContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.5; 
    source.connect(gainNode);

    inputAnalyserRef.current = ctx.createAnalyser();
    inputAnalyserRef.current.fftSize = 256;
    gainNode.connect(inputAnalyserRef.current);

    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let pcmData = inputData;
        if (ctx.sampleRate !== 16000) pcmData = downsampleBuffer(inputData, ctx.sampleRate, 16000);
        const pcmBlob = createPcmBlob(pcmData);
        sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        }).catch(() => {});
    };

    gainNode.connect(processor);
    processor.connect(ctx.destination);
    inputSourceRef.current = source;
    processorRef.current = processor;
  };

  const stopSession = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (inputContextRef.current) inputContextRef.current.close().catch(() => {});
    sourcesRef.current.forEach(s => { try{ s.stop(); }catch(e){} });
    sourcesRef.current.clear();
    if (outputContextRef.current) outputContextRef.current.close().catch(() => {});
    sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
    setIsActive(false);
    setStatus('disconnected');
  };

  useEffect(() => {
    const draw = () => {
        if (!canvasRef.current || !isActive || !isActiveView) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        let targetAnalyser = analyserRef.current;
        let isUserSpeaking = false;
        if (inputAnalyserRef.current) {
            const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
            inputAnalyserRef.current.getByteFrequencyData(data);
            let sum = 0;
            for(let i=0; i<data.length; i++) sum += data[i];
            if (sum / data.length > 10) isUserSpeaking = true;
        }

        if (isUserSpeaking && speakerState !== 'speaking') targetAnalyser = inputAnalyserRef.current;
        let frequencyData = new Uint8Array(0);
        if (targetAnalyser) {
            frequencyData = new Uint8Array(targetAnalyser.frequencyBinCount);
            targetAnalyser.getByteFrequencyData(frequencyData);
        }

        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) sum += frequencyData[i];
        const average = sum / (frequencyData.length || 1);
        const pulse = 1 + (average / 255) * 0.4;

        const baseRadius = 70;
        let gradient;
        if (speakerState === 'speaking') {
            gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5 * pulse);
            gradient.addColorStop(0, '#FFFBEB'); gradient.addColorStop(0.4, '#F59E0B'); gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else if (isUserSpeaking) {
            gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5 * pulse);
            gradient.addColorStop(0, '#E0E7FF'); gradient.addColorStop(0.4, '#6366F1'); gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        } else {
            gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.2 * pulse);
            gradient.addColorStop(0, '#FFFFFF'); gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)'); gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(centerX, centerY, baseRadius * pulse, 0, Math.PI * 2); ctx.fill();
        animationFrameRef.current = requestAnimationFrame(draw);
    };
    if (isActive && isActiveView) draw();
    else cancelAnimationFrame(animationFrameRef.current);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isActive, isActiveView, speakerState]);

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden text-white rounded-xl shadow-2xl border border-slate-800">
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] transition-all duration-1000 ${speakerState === 'speaking' ? 'bg-amber-600/10' : 'bg-indigo-600/10'}`}></div>
        </div>

        <div className="relative z-10 p-6 flex flex-col md:flex-row justify-between items-center bg-gradient-to-b from-black/60 to-transparent gap-4">
           <div className="flex items-center gap-3">
               <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-700'}`}></div>
               <span className="text-sm font-bold tracking-widest uppercase text-slate-400">FaithWalk Voice Counselor</span>
           </div>
           
           {status === 'connected' && (
             <div className="flex items-center gap-6 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
               <div className="flex items-center gap-2">
                 <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828 2.828a9 9 0 002.828 2.828" /></svg>
                 <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 md:w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold text-slate-400 uppercase">Speed</span>
                 <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="bg-transparent text-xs font-bold text-white focus:outline-none">
                   <option value="0.8">0.8x</option><option value="1.0">1.0x</option><option value="1.2">1.2x</option><option value="1.5">1.5x</option>
                 </select>
               </div>
             </div>
           )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="relative w-full flex justify-center items-center h-64 md:h-80">
                <canvas ref={canvasRef} width={400} height={400} className="w-full h-full max-w-[400px] max-h-[400px]" />
                {!isActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-32 h-32 rounded-full border border-white/5 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-inner">
                            <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </div>
                    </div>
                )}
            </div>
            <div className="h-10">
              {speakerState === 'speaking' && <p className="text-amber-400 font-serif italic text-lg animate-pulse">Counselor is speaking...</p>}
              {speakerState === 'listening' && isActive && <p className="text-indigo-400 font-serif italic text-lg opacity-60">Listening carefully...</p>}
            </div>
        </div>

        <div className="p-10 flex justify-center relative z-10 bg-gradient-to-t from-black/80 to-transparent">
             {errorMessage && (
                <div className="absolute top-0 left-0 right-0 text-center">
                    <span className="bg-red-500/90 text-white text-xs px-6 py-2 rounded-full shadow-2xl border border-red-400/50">{errorMessage}</span>
                </div>
            )}
            
            {!isActive ? (
                <button
                    onClick={startSession}
                    disabled={status === 'connecting'}
                    className="group relative bg-white text-slate-950 px-10 py-5 rounded-full font-black text-xl shadow-[0_10px_50px_rgba(255,255,255,0.1)] hover:shadow-[0_10px_70px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {status === 'connecting' ? (
                       <>
                         <svg className="animate-spin h-6 w-6 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         Establishing Call...
                       </>
                    ) : (
                       <> 
                         <div className="w-4 h-4 bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
                         Begin Consultation 
                       </>
                    )}
                </button>
            ) : (
                <button
                    onClick={stopSession}
                    className="group relative bg-red-600 text-white px-10 py-5 rounded-full font-black text-xl shadow-[0_10px_50px_rgba(220,38,38,0.2)] hover:bg-red-700 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-4"
                >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    End Session
                </button>
            )}
        </div>
    </div>
  );
};
export default AudioCompanion;