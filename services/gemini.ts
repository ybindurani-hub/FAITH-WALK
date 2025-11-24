import { GoogleGenAI, Modality } from "@google/genai";

// Safe API Key retrieval: LocalStorage (Legacy support) -> Vite -> React App -> Standard Node
const getApiKey = () => {
  let key = '';
  
  // 1. Check Local Storage (Legacy/Fallback)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('user_gemini_api_key');
    if (stored) return stored;
  }

  // 2. Check Environment Variables
  try {
    // @ts-ignore
    if (import.meta?.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    // @ts-ignore
    if (process.env.REACT_APP_API_KEY) return process.env.REACT_APP_API_KEY;
    // @ts-ignore
    if (process.env.API_KEY) return process.env.API_KEY;
  } catch (e) {
    console.warn("Environment variable access failed");
  }
  return key;
};

// Re-initialize AI when key changes
export const getGenAI = () => {
  const key = getApiKey();
  return new GoogleGenAI({ apiKey: key });
};

// --- Helper: Median.co (GoNative) Ad Trigger ---
export const triggerSmartAd = () => {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.median?.admob?.interstitial) {
      try { w.median.admob.interstitial.show(); } catch (e) {}
    } else if (w.gonative?.admob?.interstitial) {
      try { w.gonative.admob.interstitial.show(); } catch (e) {}
    }
  }
};

// --- Helper: Parse Google API Errors ---
const parseGenAIError = (error: any): string => {
  let message = error.message || "Unknown error";
  if (typeof message === 'string' && (message.includes('{') || message.includes('['))) {
    try {
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorObj = JSON.parse(jsonMatch[0]);
        if (errorObj.error && errorObj.error.message) message = errorObj.error.message;
      }
    } catch (e) {}
  }

  // Handle Leaked Key specifically
  if (message.toLowerCase().includes('leaked') || message.toLowerCase().includes('revoked')) {
    return "KEY_LEAKED";
  }

  if (message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
    return "INVALID_KEY";
  }
  return message;
};

// --- Text Utilities ---
export const cleanMarkdown = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*>\s/gm, '')
    .replace(/^\s*[-+*]\s/gm, '')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

// --- Services ---

export const searchBible = async (query: string): Promise<string> => {
  const ai = getGenAI();
  if (!getApiKey()) return "MISSING_KEY";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `User Query: "${query}".
      SYSTEM: You are FaithWalk AI. Provide a Biblical answer.
      If query is non-Biblical (sports, politics, etc), humbly refuse.
      Provide a DETAILED, FAITH-BUILDING answer with Book/Chapter/Verse references.
      Format neatly.`,
      config: { maxOutputTokens: 8192 }
    });
    return response.text || "No answer found.";
  } catch (error: any) {
    const msg = parseGenAIError(error);
    if (msg === 'INVALID_KEY') return "INVALID_KEY";
    if (msg === 'KEY_LEAKED') return "KEY_LEAKED";
    return `Error: ${msg}`;
  }
};

interface SermonOptions {
  audience: string;
  includeDeepContext: boolean;
}

export const generateSermon = async (topic: string, options: SermonOptions): Promise<string> => {
  const ai = getGenAI();
  if (!getApiKey()) return "MISSING_KEY";
  
  const { audience, includeDeepContext } = options;
  
  let prompt = `Role: World-Renowned Theologian. Task: Write a Sermon on "${topic}".
  Audience: ${audience}.
  Structure: Title, Prayer, Intro, 3 Points (Scripture, Explanation, Application), Conclusion.
  Tone: Passionate, Biblical.
  GUARDRAIL: Refuse secular topics.`;

  if (includeDeepContext) {
    prompt += `\nInclude Hebrew/Greek definitions, Historical context, and Cross-references.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { maxOutputTokens: 8192 }
    });
    return response.text || "Could not generate sermon.";
  } catch (error: any) {
    const msg = parseGenAIError(error);
    if (msg === 'INVALID_KEY') return "INVALID_KEY";
    if (msg === 'KEY_LEAKED') return "KEY_LEAKED";
    return `Error: ${msg}`;
  }
};

export const getMissionaryBioWithMaps = async (name: string) => {
  const ai = getGenAI();
  if (!getApiKey()) return { text: "MISSING_KEY", locations: [] };

  try {
    // Extensive prompt for Christian Leaders
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a DETAILED, EXTENSIVE biography of ${name}.
      CONTEXT: The user is looking for Christian Leaders, Missionaries, Revivalists, Healing Evangelists, Reformers, or 'Generals of God' (e.g., Smith Wigglesworth, A.A. Allen, Duncan Campbell, William Seymour, Martin Luther, etc.).
      
      INSTRUCTIONS:
      1. If the person is a secular figure (pop star, politician) with no relation to faith, polite refuse.
      2. If the person is a Christian figure (even controversial ones like healing evangelists), provide a faith-building biography.
      
      INCLUDE:
      - Early Life & Conversion
      - The Divine Calling
      - Key Miracles, Revivals, or Theological Contributions
      - Struggles and Victories
      - Legacy and Impact on the Church
      
      Make it lengthy and inspiring.`,
      config: {
        tools: [{ googleMaps: {} }],
        maxOutputTokens: 8192,
      },
    });

    const text = response.text || "No biography found.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let locations: Array<{ title: string; uri: string }> = [];

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.maps) {
          locations.push({ title: chunk.maps.title || "Location", uri: chunk.maps.uri || "#" });
        }
      });
    }
    return { text, locations };
  } catch (error: any) {
    const msg = parseGenAIError(error);
    if (msg === 'INVALID_KEY') return { text: "INVALID_KEY", locations: [] };
    if (msg === 'KEY_LEAKED') return { text: "KEY_LEAKED", locations: [] };
    return { text: `Error: ${msg}`, locations: [] };
  }
};

// --- Audio ---

function base64ToWav(base64: string): string {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 24000 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, len, true);
  
  const bytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const speakText = async (text: string): Promise<string> => {
  const ai = getGenAI();
  if (!getApiKey()) throw new Error("MISSING_KEY");
  
  const cleanText = text.replace(/[*#_`]/g, '').replace(/\[.*?\]/g, ''); 
  const safeText = cleanText.substring(0, 4000); 

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated.");
    return base64ToWav(base64Audio);
  } catch (e: any) {
    const msg = parseGenAIError(e);
    if (msg === 'INVALID_KEY') throw new Error("INVALID_KEY");
    if (msg === 'KEY_LEAKED') throw new Error("KEY_LEAKED");
    throw new Error(msg);
  }
};

// --- Live API ---

// Audio Resampler: Converts arbitrary input rate (e.g. 48000) to 16000 for Gemini
const downsampleTo16k = (buffer: Float32Array, sampleRate: number): Int16Array => {
  if (sampleRate === 16000) {
    const res = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) res[i] = buffer[i] * 32768;
    return res;
  }
  
  const ratio = sampleRate / 16000;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Int16Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    const index1 = Math.floor(originalIndex);
    const index2 = Math.min(index1 + 1, buffer.length - 1);
    const weight = originalIndex - index1;
    // Linear interpolation
    const val = buffer[index1] * (1 - weight) + buffer[index2] * weight;
    result[i] = Math.max(-1, Math.min(1, val)) * 32768;
  }
  return result;
};

export const connectLiveSession = async (
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void
) => {
  const ai = getGenAI();
  if (!getApiKey()) throw new Error("MISSING_KEY");

  // Mobile-Optimized Constraints
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1
    }
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.error("Mic Error:", err);
    throw new Error("MIC_PERMISSION_DENIED");
  }

  // Cross-browser AudioContext
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  
  // Input: Allow OS default sample rate (most robust on mobile)
  const inputAudioContext = new AudioContextClass(); 
  
  // Output: Allow OS default sample rate
  const outputAudioContext = new AudioContextClass();

  // Resume contexts (Critical for Mobile Safari/Chrome)
  try {
    if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();
    if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();
  } catch (e) { console.log("Context resume failed", e); }

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        // Use a larger buffer size for stability on mobile
        const processor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          // Manually downsample to 16kHz
          const pcm16k = downsampleTo16k(inputData, inputAudioContext.sampleRate);
          
          // Encode to Base64
          let binary = '';
          const bytes = new Uint8Array(pcm16k.buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);

          sessionPromise.then((session) => {
             // Gemini expects 16kHz PCM
             session.sendRealtimeInput({ 
               media: { mimeType: 'audio/pcm;rate=16000', data: base64 } 
             });
          });
        };
        
        // Prevent feedback loop: Route processing to a muted destination
        const muteNode = inputAudioContext.createGain();
        muteNode.gain.value = 0;
        
        source.connect(processor);
        processor.connect(muteNode);
        muteNode.connect(inputAudioContext.destination);
      },
      onmessage: async (message: any) => {
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          try {
            // Decode 24kHz audio from Gemini into the OutputContext's sample rate (usually 48k or 44.1k)
            // The browser's decodeAudioData handles the upsampling automatically.
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext);
            onAudioData(audioBuffer);
          } catch (e) {}
        }
      },
      onclose: () => {
        try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
        try { inputAudioContext.close(); } catch(e){}
        try { outputAudioContext.close(); } catch(e){}
        onClose();
      },
      onerror: (err) => {
        console.error("Live Error:", err);
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: `You are a Christian Pastor and Spiritual Director.
      Respond only to spiritual topics. Refuse secular topics politely.
      Speak with warmth, wisdom, and Biblical insight.
      If user speaks a specific language, reply in that language.`,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });

  return {
    close: async () => {
      try {
        const session = await sessionPromise;
        session.close();
      } catch(e) {}
    },
    outputCtx: outputAudioContext
  };
};

// Utils for decoding output
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

// Mobile-friendly decoding: Let the browser handle sample rate conversion
async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    // 1. Create a "fake" WAV header for the raw PCM data so decodeAudioData accepts it
    // Gemini output is 24kHz Mono Int16
    const sampleRate = 24000;
    const numChannels = 1;
    const wavBuffer = new ArrayBuffer(44 + data.byteLength);
    const view = new DataView(wavBuffer);
    
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + data.byteLength, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true); // Bits per sample
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, data.byteLength, true);
    
    // Copy PCM data
    const bytes = new Uint8Array(wavBuffer, 44);
    bytes.set(data);

    // 2. Decode using native browser API (Highly optimized)
    return await ctx.decodeAudioData(wavBuffer);
}
