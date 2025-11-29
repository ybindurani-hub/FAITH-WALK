
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData } from '../utils/audioUtils';
import { getApiKey } from '../services/gemini';
import { saveToCache } from '../services/cache';

interface AudioCompanionProps { language: string; isActiveView?: boolean; }

const AudioCompanion: React.FC<AudioCompanionProps> = ({ language, isActiveView = true }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  
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

  // Transcript Accumulator
  const transcriptRef = useRef<{ user: string; model: string }>({ user: '', model: '' });

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    return () => { stopSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      analyserRef.current.smoothingTimeConstant = 0.6;
      outputNodeRef.current = outputContextRef.current.createGain();
      outputNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(outputContextRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true 
        } 
      });
      streamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          // Enable Transcriptions for History
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are BiblioGuide, a professional, warm, and wise Christian Pastor AI.
          User Language: ${language}.
          BE CONCISE: Keep answers short (1-3 sentences).
          BE WARM: Speak with empathy.
          NO FLUFF: Jump straight to the answer.
          If non-English, reply in that language.`,
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            setStatus('connected');
            setIsActive(true);
            setupAudioInput(stream);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Audio
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputContextRef.current) {
                const ctx = outputContextRef.current;
                const currentTime = ctx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                const audioBuffer = await decodeAudioData(base64Audio, ctx);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current!);
                source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
             }

             // Handle Transcription
             if (message.serverContent?.inputTranscription?.text) {
                transcriptRef.current.user += message.serverContent.inputTranscription.text;
             }
             if (message.serverContent?.outputTranscription?.text) {
                transcriptRef.current.model += message.serverContent.outputTranscription.text;
             }

             // Handle Turn Completion -> Save to History
             if (message.serverContent?.turnComplete) {
                if (transcriptRef.current.user.trim() || transcriptRef.current.model.trim()) {
                    saveToCache('LIVE', transcriptRef.current.user, transcriptRef.current.model, language);
                }
                // Reset accumulators
                transcriptRef.current = { user: '', model: '' };
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => src.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                // Save whatever we have so far
                if (transcriptRef.current.user.trim() || transcriptRef.current.model.trim()) {
                    saveToCache('LIVE', transcriptRef.current.user, transcriptRef.current.model + " (Interrupted)", language);
                    transcriptRef.current = { user: '', model: '' };
                }
             }
          },
          onclose: () => {
            setStatus('disconnected');
            setIsActive(false);
          },
          onerror: (err) => {
            console.error(err);
            setStatus('error');
            setErrorMessage("Connection interrupted.");
            stopSession();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      await sessionPromise;

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      const msg = e.message?.toLowerCase() || "";
      if (msg.includes('expired')) setErrorMessage("API Key Expired. Please renew.");
      else if (msg.includes('valid')) setErrorMessage("API Key Invalid.");
      else setErrorMessage("Connection Failed.");
      stopSession();
    }
  };

  const setupAudioInput = (stream: MediaStream) => {
    if (!inputContextRef.current) return;
    const ctx = inputContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        if (!inputContextRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const currentRate = inputContextRef.current.sampleRate;
        const targetRate = 16000;
        let finalData = inputData;
        
        if (currentRate !== targetRate) {
          const ratio = currentRate / targetRate;
          const newLength = Math.floor(inputData.length / ratio);
          const resampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
             const offset = Math.floor(i * ratio);
             resampled[i] = inputData[offset];
          }
          finalData = resampled;
        }

        const pcmBlob = createPcmBlob(finalData);
        sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        }).catch(() => {});
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    inputSourceRef.current = source;
    processorRef.current = processor;
  };

  const stopSession = () => {
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (inputSourceRef.current) { inputSourceRef.current.disconnect(); inputSourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (inputContextRef.current) { inputContextRef.current.close(); inputContextRef.current = null; }

    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    if (outputContextRef.current) { outputContextRef.current.close(); outputContextRef.current = null; }

    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;

    setIsActive(false);
    setStatus('disconnected');
  };

  useEffect(() => {
    const draw = () => {
        if (!canvasRef.current || !analyserRef.current || !isActive || !isActiveView) { return; }
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 60;
        
        let sum = 0;
        for(let i=0; i<bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        const pulse = 1 + (average / 256) * 0.5;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * pulse, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        const bars = 64;
        const step = Math.PI * 2 / bars;

        ctx.beginPath();
        for (let i = 0; i < bars; i++) {
            const value = dataArray[i * 2] || 0;
            const barHeight = (value / 255) * 80 * pulse;
            const angle = i * step;
            
            const x1 = centerX + Math.cos(angle) * (radius * pulse);
            const y1 = centerY + Math.sin(angle) * (radius * pulse);
            const x2 = centerX + Math.cos(angle) * (radius * pulse + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius * pulse + barHeight);
            
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.strokeStyle = '#a5b4fc';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        animationFrameRef.current = requestAnimationFrame(draw);
    };
    
    if (isActive && isActiveView) { draw(); } 
    else { cancelAnimationFrame(animationFrameRef.current); }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isActive, isActiveView]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden text-white rounded-xl my-2 mx-2">
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-500/10 to-transparent"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 px-6 py-6 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-sm shrink-0">
           <div>
               <h2 className="text-xl font-serif font-bold text-white tracking-wide">Live Counselor</h2>
               <p className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">{status === 'connected' ? 'Online' : 'Standby'}</p>
           </div>
           <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10 min-h-0">
            <div className="relative mb-8">
                <canvas ref={canvasRef} width={400} height={400} className="rounded-full max-w-[280px] max-h-[280px]" />
                {!isActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm">
                            <svg className="w-8 h-8 text-indigo-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </div>
                    </div>
                )}
            </div>
            <p className={`text-lg font-serif italic text-center max-w-sm transition-all duration-500 px-4 ${isActive ? 'text-indigo-100 opacity-100' : 'text-slate-500 opacity-0 translate-y-4'}`}>
               "I am here to listen. Speak your heart."
            </p>
        </div>

        <div className="p-8 flex flex-col items-center justify-center relative z-10 bg-gradient-to-t from-black/80 to-transparent shrink-0">
            {errorMessage && (
                <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-500/30 text-red-200 text-sm rounded-lg backdrop-blur-md animate-in slide-in-from-bottom-2">
                    {errorMessage}
                </div>
            )}
            
            <button
                onClick={isActive ? stopSession : startSession}
                disabled={status === 'connecting'}
                className={`group relative flex items-center justify-center gap-3 px-10 py-5 rounded-full font-bold tracking-wider transition-all duration-300 shadow-2xl ${
                    isActive 
                        ? 'bg-red-500/20 text-red-200 border border-red-500/50 hover:bg-red-500/30' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 shadow-indigo-500/30'
                } ${status === 'connecting' ? 'opacity-70 cursor-wait' : ''}`}
            >
                {status === 'connecting' ? (
                   <> <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span> CONNECTING... </>
                ) : isActive ? (
                   <> <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span> END SESSION </>
                ) : (
                   <> <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> START CONVERSATION </>
                )}
            </button>
            <p className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Gemini 2.5 Native Audio</p>
        </div>
    </div>
  );
};
export default AudioCompanion;
