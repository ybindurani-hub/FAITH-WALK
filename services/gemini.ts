import { GoogleGenAI, Modality } from "@google/genai";
import { saveToCache, checkCache } from './cache';

// Safe API Key retrieval: LocalStorage (Legacy support) -> Vite -> React App -> Standard Node
export const getApiKey = () => {
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

  const lowerMsg = message.toLowerCase();
  
  // Handle Specific Key Issues
  if (lowerMsg.includes('leaked') || lowerMsg.includes('revoked')) {
    return "KEY_LEAKED";
  }
  if (lowerMsg.includes('expired')) {
    return "KEY_EXPIRED";
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
  // 1. Check Cache
  const cached = checkCache('BIBLE', query);
  if (cached) return cached;

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
    const text = response.text || "No answer found.";
    
    // 2. Save to Cache
    if (text !== "No answer found.") saveToCache('BIBLE', query, text, 'en');
    
    return text;
  } catch (error: any) {
    const msg = parseGenAIError(error);
    if (msg === 'INVALID_KEY') return "INVALID_KEY";
    if (msg === 'KEY_LEAKED') return "KEY_LEAKED";
    if (msg === 'KEY_EXPIRED') return "KEY_EXPIRED";
    return `Error: ${msg}`;
  }
};

interface SermonOptions {
  audience: string;
  includeDeepContext: boolean;
}

export const generateSermon = async (topic: string, options: SermonOptions): Promise<string> => {
  // 1. Check Cache (Use topic + options as key ideally, but simple topic for now is okay for basic cache)
  const cacheKey = `${topic}::${options.audience}::${options.includeDeepContext}`;
  const cached = checkCache('SERMON', cacheKey);
  if (cached) return cached;

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
    const text = response.text || "Could not generate sermon.";
    
    // 2. Save Cache
    saveToCache('SERMON', cacheKey, text, 'en');
    
    return text;
  } catch (error: any) {
    const msg = parseGenAIError(error);
    if (msg === 'INVALID_KEY') return "INVALID_KEY";
    if (msg === 'KEY_LEAKED') return "KEY_LEAKED";
    if (msg === 'KEY_EXPIRED') return "KEY_EXPIRED";
    return `Error: ${msg}`;
  }
};

export const getMissionaryBioWithMaps = async (name: string) => {
  // 1. Check Cache
  const cached = checkCache('BIO', name);
  if (cached) return cached;

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

    const result = { text, locations };
    
    // 2. Save Cache
    if (text !== "No biography found.") saveToCache('BIO', name, result, 'en');

    return result;
  } catch (error: any) {
    const msg = parseGenAIError(error);
    if (msg === 'INVALID_KEY') return { text: "INVALID_KEY", locations: [] };
    if (msg === 'KEY_LEAKED') return { text: "KEY_LEAKED", locations: [] };
    if (msg === 'KEY_EXPIRED') return { text: "KEY_EXPIRED", locations: [] };
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
    if (msg === 'KEY_EXPIRED') throw new Error("KEY_EXPIRED");
    throw new Error(msg);
  }
};
