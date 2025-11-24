import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData } from '../utils/audioUtils';
import { getApiKey } from '../services/gemini';

interface AudioCompanionProps { language: string; }

const AudioCompanion: React.FC<AudioCompanionProps> = ({ language }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Refs for audio handling to persist across renders
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Animation ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = async () => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("API Key is missing.");
      }

      setStatus('connecting');
      setErrorMessage('');

      // Security Check for Microphone
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported. Please ensure you are using HTTPS.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize Audio Contexts
      // Try to request 16kHz, but browsers might ignore this and use hardware rate (e.g. 48kHz)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      
      // Resume if suspended (common in deployed environments due to autoplay policies)
      if (inputContextRef.current.state === 'suspended') {
        await inputContextRef.current.resume();
      }

      outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      if (outputContextRef.current.state === 'suspended') {
        await outputContextRef.current.resume();
      }
      
      // Setup Visualizer
      analyserRef.current = outputContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      outputNodeRef.current = outputContextRef.current.createGain();
      outputNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(outputContextRef.current.destination);

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are BiblioGuide, a specialized AI voice assistant acting as a humble, loving pastor and Bible teacher.
          
          User Language Code: ${language}.
          
          YOUR PERSONA:
          - Give answers like a humble pastor teaching the Bible to his church.
          - Speak with compassion, love, and clarity, under the wisdom of the Holy Spirit.
          - Do NOT say 'Christianity says' or answer like a search engine. Instead, speak personally: "The Bible teaches us..." or "Jesus says...".
          - Be encouraging, warm, and spiritually deep.
          
          LANGUAGE & VOCABULARY:
          - If the user speaks in Hindi, Tamil, Telugu, or any other language, you MUST use the specific, traditional biblical terminology (Bible words) appropriate for that language's standard Bible translation.
          - Do not use generic street language if a specific biblical term exists in that language (e.g. use "Satyavedam" or "Parishuddha Grandham" logic for Telugu context, "Vedagamam" for Tamil, etc).

          RESTRICTIONS:
          - STRICTLY REFUSE to discuss secular topics (sports, tech, politics) unrelated to faith. Politely redirect the user: "I am here to help with your spiritual walk. Do you have a question about the Bible?"`,
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
             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputContextRef.current) {
                const ctx = outputContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const audioBuffer = await decodeAudioData(base64Audio, ctx);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current!);
                
                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                });
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => src.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
            setStatus('disconnected');
            setIsActive(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setStatus('error');
            const msg = err.message?.toLowerCase() || "";
            if (msg.includes("expired")) setErrorMessage("API Key Expired.");
            else if (msg.includes("valid")) setErrorMessage("API Key Invalid.");
            else setErrorMessage("Connection error. Please try again.");
            stopSession();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      
      // Await the connection to ensure we catch immediate network/handshake errors
      await sessionPromise;

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMessage(e.message || "Failed to start audio session.");
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

        // Downsample to 16kHz if necessary
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
        }).catch(err => {
            console.error("Failed to send audio input:", err);
        });
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    
    inputSourceRef.current = source;
    processorRef.current = processor;
  };

  const stopSession = () => {
    // Stop Audio Input
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
        inputContextRef.current.close();
        inputContextRef.current = null;
    }

    // Stop Audio Output
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    if (outputContextRef.current) {
        outputContextRef.current.close();
        outputContextRef.current = null;
    }

    // Close Session
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;

    setIsActive(false);
    setStatus('disconnected');
  };

  // Visualizer Loop
  useEffect(() => {
    const draw = () => {
        if (!canvasRef.current || !analyserRef.current || !isActive) {
            animationFrameRef.current = requestAnimationFrame(draw);
            return;
        }
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple circular visualizer
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 50;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#f8fafc'; // slate-50
        ctx.fill();

        const bars = 20;
        const step = Math.PI * 2 / bars;

        for (let i = 0; i < bars; i++) {
            const value = dataArray[i * 2]; // skip some bins
            const barHeight = (value / 255) * 80;
            const angle = i * step;
            
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(99, 102, 241, ${value / 255 + 0.2})`; // Indigo color
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        
        animationFrameRef.current = requestAnimationFrame(draw);
    };
    
    if (isActive) {
        draw();
    } else {
        cancelAnimationFrame(animationFrameRef.current);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
    }
    
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isActive]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <h2 className="text-3xl serif text-slate-800 dark:text-white mb-2">Faith Voice Assistant</h2>
        <p className="text-slate-500 dark:text-slate-300 mb-10 max-w-md">Speak naturally to ask questions, seek comfort, or discuss scripture in real-time.</p>
        
        <div className="relative mb-12">
            <canvas 
                ref={canvasRef} 
                width={300} 
                height={300} 
                className="rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner"
            />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 text-indigo-500 ${isActive ? 'opacity-80' : 'opacity-20'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
             </div>
        </div>

        {errorMessage && (
            <div className="text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg mb-4 text-sm max-w-md break-words">
                {errorMessage}
            </div>
        )}

        <button
            onClick={isActive ? stopSession : startSession}
            disabled={status === 'connecting'}
            className={`px-8 py-4 rounded-full font-semibold text-lg shadow-lg transition-all transform hover:scale-105 ${
                isActive 
                    ? 'bg-red-500 text-white hover:bg-red-600 ring-4 ring-red-100 dark:ring-red-900/30' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-100 dark:ring-indigo-900/30'
            } ${status === 'connecting' ? 'opacity-70 cursor-wait' : ''}`}
        >
            {status === 'connecting' ? 'Connecting...' : isActive ? 'End Conversation' : 'Start Talking'}
        </button>
        
        <p className="mt-6 text-xs text-slate-400">Powered by Gemini 2.5 Native Audio</p>
    </div>
  );
};

export default AudioCompanion;