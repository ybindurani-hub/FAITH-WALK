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
    return `Error: ${msg}`;
  }
};

export const getMissionaryBioWithMaps = async (name: string) => {
  const ai = getGenAI();
  if (!getApiKey()) return { text: "MISSING_KEY", locations: [] };

  try {
    // Updated prompt to include Revivalists, Reformers, and Pastors
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a DETAILED biography of ${name}, focusing on their work as a Christian Leader, Missionary, Revivalist, Reformer, or Pastor (e.g., Smith Wigglesworth, A.A. Allen, Duncan Campbell, Luther, etc.).
      Include: Early Life, Divine Calling, Key Ministry/Revivals, Miracles/Theology, and Legacy.
      If the name refers to a secular celebrity (actor, politician) who is NOT a Christian leader, politely refuse. 
      If it is a Christian figure, provide a full, faith-building biography.`,
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
    throw new Error(msg);
  }
};

// --- Live API ---

export const connectLiveSession = async (
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void
) => {
  const ai = getGenAI();
  if (!getApiKey()) throw new Error("MISSING_KEY");

  const constraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: true
    }
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.error("Mic Error:", err);
    throw new Error("MIC_PERMISSION_DENIED");
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
  const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
  
  try {
    if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();
    if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();
  } catch (e) { console.log("Context resume failed", e); }

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createBlob(inputData);
          sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };
        
        const muteNode = inputAudioContext.createGain();
        muteNode.gain.value = 0;
        source.connect(scriptProcessor);
        scriptProcessor.connect(muteNode);
        muteNode.connect(inputAudioContext.destination);
      },
      onmessage: async (message: any) => {
        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64EncodedAudioString) {
          try {
            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext, 24000, 1);
            onAudioData(audioBuffer);
          } catch (e) {}
        }
      },
      onclose: () => {
        stream.getTracks().forEach(t => t.stop());
        inputAudioContext.close();
        outputAudioContext.close();
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
      const session = await sessionPromise;
      session.close();
    },
    outputCtx: outputAudioContext
  };
};

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) { int16[i] = data[i] * 32768; }
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; }
  }
  return buffer;
}