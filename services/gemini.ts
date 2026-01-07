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

// --- ADMOB INTERSTITIAL CONFIGURATION ---
// These calls are formatted for Median.co (formerly GoNative) standard AdMob bridge.
let adCounter = 0;
const AD_SHOW_THRESHOLD = 3; 

export const triggerSmartAd = (force: boolean = false) => {
  if (typeof window === 'undefined') return;

  adCounter++;
  
  // If force is true (e.g., on navigation), we trigger immediately
  if (force || adCounter % AD_SHOW_THRESHOLD === 0) {
    const w = window as any;
    
    // Format 1: Median JS Bridge (Recommended)
    if (w.median?.admob?.interstitial?.show) {
      try {
        w.median.admob.interstitial.show();
      } catch (e) { console.error("AdMob Error:", e); }
    } 
    // Format 2: GoNative Legacy JS Bridge
    else if (w.gonative?.admob?.interstitial?.show) {
      try {
        w.gonative.admob.interstitial.show();
      } catch (e) { console.error("AdMob Error:", e); }
    }
    // Format 3: Generic bridge pattern
    else if (w.JSBridge?.showInterstitial) {
      try {
        w.JSBridge.showInterstitial();
      } catch (e) {}
    }
    else {
      console.log("AdMob: No bridge found. (Force: " + force + ")");
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
  if (lowerMsg.includes('leaked') || lowerMsg.includes('revoked')) return "KEY_LEAKED";
  if (lowerMsg.includes('expired')) return "KEY_EXPIRED";
  if (message.includes('API key not valid') || message.includes('API_KEY_INVALID')) return "INVALID_KEY";
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

// --- Core Services ---

export const searchBible = async (query: string): Promise<string> => {
  const cached = checkCache('BIBLE', query);
  if (cached) return cached;

  const ai = getGenAI();
  if (!getApiKey()) return "MISSING_KEY";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Query: "${query}".
      SYSTEM: You are FaithWalk AI. Provide a Biblical answer.
      If query is non-Biblical, humbly refuse.
      Provide a DETAILED, FAITH-BUILDING answer with Book/Chapter/Verse references.
      Format neatly.`,
      config: { maxOutputTokens: 8192 }
    });
    const text = response.text || "No answer found.";
    if (text !== "No answer found.") saveToCache('BIBLE', query, text, 'en');
    return text;
  } catch (error: any) {
    const msg = parseGenAIError(error);
    return msg.includes('KEY') ? msg : `Error: ${msg}`;
  }
};

interface SermonOptions {
  audience: string;
  includeDeepContext: boolean;
}

export const generateSermon = async (topic: string, options: SermonOptions): Promise<string> => {
  const cacheKey = `${topic}::${options.audience}::${options.includeDeepContext}`;
  const cached = checkCache('SERMON', cacheKey);
  if (cached) return cached;

  const ai = getGenAI();
  if (!getApiKey()) return "MISSING_KEY";
  
  const { audience, includeDeepContext } = options;
  let prompt = `Role: World-Renowned Theologian. Task: Write a Sermon on "${topic}".
  Audience: ${audience}.
  Structure: Title, Prayer, Intro, 3 Points (Scripture, Explanation, Application), Conclusion.
  Tone: Passionate, Biblical.`;

  if (includeDeepContext) {
    prompt += `\nInclude Hebrew/Greek definitions, Historical context, and Cross-references.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { maxOutputTokens: 8192 }
    });
    const text = response.text || "Could not generate sermon.";
    saveToCache('SERMON', cacheKey, text, 'en');
    return text;
  } catch (error: any) {
    const msg = parseGenAIError(error);
    return msg.includes('KEY') ? msg : `Error: ${msg}`;
  }
};

export const getMissionaryBioWithMaps = async (name: string) => {
  const cached = checkCache('BIO', name);
  if (cached) return cached;

  const ai = getGenAI();
  if (!getApiKey()) return { text: "MISSING_KEY", locations: [] };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a DETAILED biography of ${name}.
      CONTEXT: The user is looking for Christian Leaders, Missionaries, or 'Generals of God'.
      INCLUDE: Life Story, Conversion, Calling, Miracles, Legacy.`,
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
    if (text !== "No biography found.") saveToCache('BIO', name, result, 'en');
    return result;
  } catch (error: any) {
    const msg = parseGenAIError(error);
    return { text: msg.includes('KEY') ? msg : `Error: ${msg}`, locations: [] };
  }
};

function base64ToWav(base64: string): string {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);
  const writeString = (v: DataView, o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
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
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export const speakText = async (text: string): Promise<string> => {
  const ai = getGenAI();
  if (!getApiKey()) throw new Error("MISSING_KEY");
  const safeText = text.replace(/[*#_`]/g, '').substring(0, 4000); 
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
    throw new Error(msg);
  }
};