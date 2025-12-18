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

  // Transcript Accumulator for History (Maintained for saving sessions, but not displayed live)
  const transcriptRef = useRef<{ user: string; model: string }>({ user: '', model: '' });

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);

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
      
      // Input Context (Microphone) - Try to request 16k, but handle if browser gives default
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      if (inputContextRef.current.state === 'suspended') await inputContextRef.current.resume();

      // Output Context (Speaker) - Fixed at 24k for Model Output
      outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      if (outputContextRef.current.state === 'suspended') await outputContextRef.current.resume();
      
      // Output Analyser (for Visualizer when AI speaks)
      analyserRef.current = outputContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.5;
      outputNodeRef.current = outputContextRef.current.createGain();
      outputNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(outputContextRef.current.destination);

      // Input Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      streamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          // Removed transcription config to prevent "Network Error" or "Invalid Argument"
          // and to optimize bandwidth for audio-only mode.
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are FaithWalk, a professional, warm, and highly engaging spiritual counselor.
          User Language: ${language}.
          
          CORE BEHAVIORS:
          1. **Adaptive Length & Depth:** DO NOT restrict yourself to short answers. If the user asks for details, explanation, or a story, provide a LONG, DETAILED, and COMPREHENSIVE response. Speak at length if the topic requires deep spiritual explanation.
          2. **Rich Content:** Always integrate Biblical scripture and relevant Jewish history/cultural context to explain spiritual concepts deeply when needed.
          3. **Continuous Dialogue:** This is a phone call. Speak naturally.
          4. **Tone:** Empathetic, wise, non-judgmental.`,
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
             // 1. Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputContextRef.current) {
                setSpeakerState('speaking');
                const ctx = outputContextRef.current;
                const currentTime = ctx.currentTime;
                
                // Gapless playback logic
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                
                try {
                  const audioBuffer = await decodeAudioData(base64Audio, ctx);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputNodeRef.current!);
                  source.addEventListener('ended', () => { 
                      if (ctx.currentTime >= nextStartTimeRef.current - 0.1) {
                          setSpeakerState('listening');
                      }
                  });
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (err) {
                  console.error("Audio Decode Error", err);
                }
             }

             // 2. Accumulate Transcript for History (No UI update)
             const inputTx = message.serverContent?.inputTranscription?.text;
             if (inputTx) {
                transcriptRef.current.user += inputTx;
             }

             const outputTx = message.serverContent?.outputTranscription?.text;
             if (outputTx) {
                transcriptRef.current.model += outputTx;
             }

             // 3. Handle Turn Completion -> Save History
             if (message.serverContent?.turnComplete) {
                if (transcriptRef.current.user.trim() || transcriptRef.current.model.trim()) {
                    saveToCache('LIVE', transcriptRef.current.user, transcriptRef.current.model, language);
                }
                transcriptRef.current = { user: '', model: '' };
             }

             // 4. Handle Interruption
             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => {
                  try { src.stop(); } catch(e){}
                });
                sourcesRef.current.clear();
                // Reset nextStartTime to current time so new audio starts immediately
                if (outputContextRef.current) {
                  nextStartTimeRef.current = outputContextRef.current.currentTime;
                }
                setSpeakerState('listening');
             }
          },
          onclose: () => {
            if (status === 'connected') {
               setStatus('disconnected');
               setIsActive(false);
            }
          },
          onerror: (err) => {
            console.error("Gemini Live Error:", err);
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
      if (msg.includes('expired')) setErrorMessage("API Key Expired.");
      else if (msg.includes('valid')) setErrorMessage("API Key Invalid.");
      else if (msg.includes('permission')) setErrorMessage("Microphone Permission Denied.");
      else if (msg.includes('network')) setErrorMessage("Network Error (Check Internet/Key).");
      else if (msg.includes('invalid argument')) setErrorMessage("Invalid Config.");
      else setErrorMessage("Connection Failed.");
      stopSession();
    }
  };

  const setupAudioInput = (stream: MediaStream) => {
    if (!inputContextRef.current) return;
    const ctx = inputContextRef.current;
    
    // Create Media Source
    const source = ctx.createMediaStreamSource(stream);
    
    // Create Gain Node to boost microphone input (helps with recognition)
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.5; 
    source.connect(gainNode);

    // Create Analyser for Input (Visuals)
    inputAnalyserRef.current = ctx.createAnalyser();
    inputAnalyserRef.current.fftSize = 256;
    gainNode.connect(inputAnalyserRef.current);

    // Processor for handling raw PCM
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    
    const currentSampleRate = ctx.sampleRate;
    const targetSampleRate = 16000;

    processor.onaudioprocess = (e) => {
        if (!inputContextRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample if necessary (e.g. system is 48k/44.1k, we need 16k)
        let pcmData = inputData;
        if (currentSampleRate !== targetSampleRate) {
             pcmData = downsampleBuffer(inputData, currentSampleRate, targetSampleRate);
        }

        const pcmBlob = createPcmBlob(pcmData);
        sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        }).catch(() => {});
    };

    gainNode.connect(processor);
    processor.connect(ctx.destination); // Required for script processor to run
    
    inputSourceRef.current = source;
    processorRef.current = processor;
  };

  const stopSession = () => {
    if (processorRef.current) { 
        processorRef.current.disconnect(); 
        processorRef.current = null; 
    }
    if (inputSourceRef.current) { 
        inputSourceRef.current.disconnect(); 
        inputSourceRef.current = null; 
    }
    if (streamRef.current) { 
        streamRef.current.getTracks().forEach(t => t.stop()); 
        streamRef.current = null; 
    }
    if (inputContextRef.current) { 
        inputContextRef.current.close().catch(() => {}); 
        inputContextRef.current = null; 
    }

    sourcesRef.current.forEach(s => { try{ s.stop(); }catch(e){} });
    sourcesRef.current.clear();
    
    if (outputContextRef.current) { 
        outputContextRef.current.close().catch(() => {}); 
        outputContextRef.current = null; 
    }

    sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
    sessionPromiseRef.current = null;

    setIsActive(false);
    setStatus('disconnected');
    setSpeakerState('listening');
  };

  // --- Visualizer Logic ---
  useEffect(() => {
    const draw = () => {
        if (!canvasRef.current || !isActive || !isActiveView) { return; }
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Determine which analyser to use (Input vs Output)
        let targetAnalyser = analyserRef.current; // Default to AI output
        let isUserSpeaking = false;

        // Check Input Volume
        let inputVol = 0;
        if (inputAnalyserRef.current) {
            const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
            inputAnalyserRef.current.getByteFrequencyData(data);
            let sum = 0;
            for(let i=0; i<data.length; i++) sum += data[i];
            inputVol = sum / data.length;
            if (inputVol > 10) isUserSpeaking = true;
        }

        // If User is speaking significantly, switch visualizer to input
        if (isUserSpeaking && speakerState !== 'speaking') {
            targetAnalyser = inputAnalyserRef.current;
        }

        // Get Frequency Data
        let frequencyData = new Uint8Array(0);
        if (targetAnalyser) {
            frequencyData = new Uint8Array(targetAnalyser.frequencyBinCount);
            targetAnalyser.getByteFrequencyData(frequencyData);
        }

        // Calculate Average Volume/Pulse
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) sum += frequencyData[i];
        const average = sum / (frequencyData.length || 1);
        const pulse = 1 + (average / 255) * 0.4;

        // --- DRAW ORB ---
        const baseRadius = 70;
        
        // Dynamic Color
        let gradient;
        if (speakerState === 'speaking') {
            // AI Speaking: Golden/Amber
            gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5 * pulse);
            gradient.addColorStop(0, '#FFFBEB'); // White/Yellow center
            gradient.addColorStop(0.4, '#F59E0B'); // Amber
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else if (isUserSpeaking) {
             // User Speaking: Blue/Indigo
            gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5 * pulse);
            gradient.addColorStop(0, '#E0E7FF'); // White/Blue center
            gradient.addColorStop(0.4, '#6366F1'); // Indigo
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        } else {
             // Idle/Listening: White/Subtle
            gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.2 * pulse);
            gradient.addColorStop(0, '#FFFFFF');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * pulse, 0, Math.PI * 2);
        ctx.fill();

        // --- DRAW RINGS (Ripple Effect) ---
        if (average > 5) {
            ctx.strokeStyle = speakerState === 'speaking' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(165, 180, 252, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, baseRadius * pulse * 1.2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = speakerState === 'speaking' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(165, 180, 252, 0.1)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, baseRadius * pulse * 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        animationFrameRef.current = requestAnimationFrame(draw);
    };
    
    if (isActive && isActiveView) { 
        draw(); 
    } else { 
        cancelAnimationFrame(animationFrameRef.current); 
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isActive, isActiveView, speakerState]);

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden text-white rounded-xl shadow-2xl">
        {/* Background Ambient Effects */}
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] transition-all duration-1000 ${speakerState === 'speaking' ? 'bg-amber-600/20' : 'bg-indigo-600/20'}`}></div>
        </div>

        {/* Header */}
        <div className="relative z-10 p-6 flex justify-between items-center bg-gradient-to-b from-black/40 to-transparent">
           <div className="flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-500'}`}></div>
               <span className="text-sm font-semibold tracking-widest uppercase text-slate-300">Live Counselor</span>
           </div>
           {/* Disconnect button moved to footer */}
        </div>

        {/* Main Visualizer Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="relative w-full flex justify-center items-center h-64 md:h-80">
                <canvas ref={canvasRef} width={400} height={400} className="w-full h-full max-w-[400px] max-h-[400px]" />
                {!isActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl">
                            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Controls */}
        <div className="p-8 flex justify-center relative z-10 bg-gradient-to-t from-black/60 to-transparent">
             {errorMessage && (
                <div className="absolute top-0 left-0 right-0 text-center">
                    <span className="bg-red-500/80 text-white text-xs px-4 py-1 rounded-full shadow-lg">{errorMessage}</span>
                </div>
            )}
            
            {!isActive ? (
                <button
                    onClick={startSession}
                    disabled={status === 'connecting'}
                    className="group relative bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 transition-all duration-300 flex items-center gap-3"
                >
                    {status === 'connecting' ? (
                       <>
                         <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         Connecting...
                       </>
                    ) : (
                       <> 
                         <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                         Start Conversation 
                       </>
                    )}
                </button>
            ) : (
                <button
                    onClick={stopSession}
                    className="group relative bg-red-500/20 backdrop-blur-md border border-red-500/50 text-white px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_40px_rgba(220,38,38,0.2)] hover:bg-red-600 hover:shadow-[0_0_60px_rgba(220,38,38,0.4)] hover:scale-105 transition-all duration-300 flex items-center gap-3"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    End Session
                </button>
            )}
        </div>
    </div>
  );
};
export default AudioCompanion;