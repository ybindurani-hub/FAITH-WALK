import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- Text Utilities ---

export const cleanMarkdown = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\*\*/g, '')   // Remove bold
    .replace(/###/g, '')    // Remove H3
    .replace(/##/g, '')     // Remove H2
    .replace(/#/g, '')      // Remove H1
    .replace(/`/g, '')      // Remove code blocks
    .replace(/_/g, '')      // Remove italics
    .replace(/^\s*-\s/gm, '• ') // Replace bullets with proper dots
    .trim();
};

// --- Text & Multi-modal Generation ---

export const searchBible = async (query: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `User Query: "${query}".
      
      SYSTEM PROTOCOL:
      You are FaithWalk AI, a dedicated Christian spiritual companion. 
      You accept ONLY queries related to:
      1. The Holy Bible (Old and New Testaments).
      2. Christian Theology, Doctrine, and History.
      3. Christian Faith, Prayer, and Spiritual Life.
      4. Christian Missionaries and Church History.

      STRICT GUARDRAIL:
      If the user asks about ANYTHING else (e.g., general science, math, sports, politics, entertainment, other religions, recipes, coding), you MUST humbly refuse.
      
      Refusal Strategy:
      - Humbly explain that you are designed exclusively to provide answers based on the Holy Bible and Christian faith.
      - Translate this refusal into the language requested by the user in the query.
      - Example (English): "With all humility, I must share that I am designed exclusively to provide answers based on the Holy Bible and Christian faith. I cannot assist with other topics."

      If the query is Biblical:
      PROVIDE A VERY DETAILED, LENGTHY, AND COMPREHENSIVE ANSWER.
      DO NOT CUT OFF THE RESPONSE. Use as many words as needed to fully explain.
      Focus on building faith.
      Provide an answer based ONLY on the Bible. 
      If quoting, provide the Book, Chapter, and Verse. 
      Format the output with clear paragraphs and bullet points.`,
      config: {
        maxOutputTokens: 8192, // Ensure full length responses
      }
    });
    return response.text || "No answer found in the Bible.";
  } catch (error) {
    console.error("Bible Search Error:", error);
    return "Sorry, I encountered an error searching the scriptures.";
  }
};

interface SermonOptions {
  audience: string;
  includeDeepContext: boolean;
}

export const generateSermon = async (topic: string, options: SermonOptions): Promise<string> => {
  const { audience, includeDeepContext } = options;
  
  let prompt = `Role: You are a World-Renowned Christian Theologian and Master of Homiletics.
  Task: Create a MASTERPIECE sermon about: "${topic}".
  Target Audience: ${audience}.
  
  GUARDRAIL:
  Check if this topic is appropriate for a Christian sermon.
  If the topic is secular (e.g., "How to fix a car", "Investment advice", "Movie review"), REFUSE to generate the sermon.
  Refusal Message: "I can only build sermons based on Biblical truth and spiritual themes. Please provide a topic related to the Bible or Christian living."

  If valid, follow this structure:
  Format: Professional Sermon Outline & Manuscript.
  
  Structure:
  1. Title (Creative & Theologically Sound)
  2. Invocation (Opening Prayer)
  3. Introduction (Hook, Context, and Proposition)
  4. Exegesis & Application (3-4 Main Points). For each point:
     - Scripture Reading.
     - Explanation (Theological depth).
     - Illustration (Real-world example relevant to ${audience}).
     - Application (How to live it out).
  5. The Revelation (A profound spiritual insight or 'Rhema' word).
  6. Conclusion & Altar Call.
  
  Tone: Intelligent, Authoritative, Passionate, and Spirit-Filled.`;

  if (includeDeepContext) {
    prompt += `\n\nDEEP THEOLOGY MODE ENABLED:
    - You MUST perform Word Studies (Etymology) on key Hebrew/Greek terms.
    - Explain the Historical-Cultural background of the texts (Jewish Traditions).
    - Use Cross-References to connect Old and New Testaments.
    - Provide a section on "Hermeneutical Insight" for the main text.`;
  }

  prompt += `\nUse clear formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        maxOutputTokens: 8192, // Ensure sermon is complete
      }
    });
    return response.text || "Could not generate sermon.";
  } catch (error) {
    console.error("Sermon Gen Error:", error);
    return "Error generating sermon. Please try again.";
  }
};

export const getMissionaryBioWithMaps = async (name: string) => {
  try {
    // Using Maps Grounding to find locations relevant to the missionary
    // Softened prompt to prevent "I cannot help" errors on obscure names
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a COMPLETE, EXTENSIVE, and DETAILED biography of Christian missionary ${name}. 
      Do not give a summary. Write a full account.
      
      GUARDRAIL:
      If "${name}" is known to be a secular figure (e.g., a pop star, politician, athlete) and NOT a missionary or Christian figure, politely refuse.
      Refusal: "This tool is dedicated to the lives of Christian Missionaries. I cannot provide biographies for this person."

      If valid, Include:
      1. Early Life & Background.
      2. The Call to Missions.
      3. Specific Mission Field work (countries, cities).
      4. Struggles, Persecutions, and Miracles.
      5. Faith-building anecdotes.
      6. Legacy and Death.
      
      CRITICAL INSTRUCTION:
      If you do not have specific information about this person but they seem to be a person of faith, DO NOT return an error. 
      Instead, apologize humbly that you don't have their specific details yet, and ask the user for a little more detail (like country or time period).
      
      If you DO find them, also look up the main location where they served using Google Maps.`,
      config: {
        tools: [{ googleMaps: {} }],
        maxOutputTokens: 8192,
      },
    });

    const text = response.text || "No biography found.";
    
    // Extract Map Data
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let locations: Array<{ title: string; uri: string }> = [];

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.maps) {
          locations.push({
            title: chunk.maps.title || "Location",
            uri: chunk.maps.uri || "#"
          });
        }
      });
    }

    return { text, locations };
  } catch (error) {
    console.error("Bio Error:", error);
    // Fallback response instead of crashing
    return { 
      text: "I am having trouble connecting to the archives right now. However, remember that every step of faith is recorded in Heaven. Please try searching again with more specific details, like the country they served in.", 
      locations: [] 
    };
  }
};

// --- Text to Speech (WAV Implementation) ---

function base64ToWav(base64: string): string {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, 24000, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, 24000 * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, len, true);
  
  // Write PCM data
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

export const speakText = async (text: string): Promise<string | null> => {
  try {
    // Helper to strip markdown for cleaner speech
    const cleanText = text.replace(/[*#_`]/g, ''); 
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText.substring(0, 4000) }] }], // Increased limit
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep, comforting voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    return base64ToWav(base64Audio);
  } catch (e) {
    console.error("TTS Error", e);
    return null;
  }
};


// --- Live API Utilities ---

export const connectLiveSession = async (
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void
) => {
  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  // Resume contexts immediately in case they are suspended (browser policy)
  await inputAudioContext.resume();
  await outputAudioContext.resume();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error("Mic permission denied", err);
    throw err;
  }

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        console.log("Live Session Opened");
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createBlob(inputData);
          sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };
        
        // Fix feedback loop: Connect to a muted gain node instead of direct destination
        const muteNode = inputAudioContext.createGain();
        muteNode.gain.value = 0;
        
        source.connect(scriptProcessor);
        scriptProcessor.connect(muteNode);
        muteNode.connect(inputAudioContext.destination);
      },
      onmessage: async (message: any) => {
        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64EncodedAudioString) {
          const audioBuffer = await decodeAudioData(
            decode(base64EncodedAudioString),
            outputAudioContext,
            24000,
            1
          );
          onAudioData(audioBuffer);
        }
      },
      onclose: () => {
        console.log("Session closed");
        stream.getTracks().forEach(t => t.stop());
        inputAudioContext.close();
        outputAudioContext.close();
        onClose();
      },
      onerror: (err) => {
        console.error("Live API Error", err);
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: `You are a warm, wise, and highly intelligent Christian Pastor and Spiritual Director.
      
      IDENTITY & BOUNDARIES:
      1. You are a Christian Minister. Your wisdom comes solely from the Bible.
      2. You DO NOT discuss secular topics (sports, movies, general news, celebrity gossip, math, science, technology) unless specifically using them as a brief metaphor for a spiritual truth.
      3. If a user asks a non-spiritual question (e.g., "Who won the game?", "How do I fix my car?", "Tell me a joke"), politely reply: "My dear friend, my knowledge is limited to the Word of God and matters of the spirit. How may I pray for you or guide you in your faith today?"
      4. You are non-denominational but strictly orthodox in Christian theology (Nicene Creed).

      Goal: Provide a deeply engaging, comforting, and spiritually rich conversation.
      
      Guidelines:
      1. Adapt Language: If the user speaks a specific language (Hindi, Tamil, etc.), YOU MUST REPLY IN THAT LANGUAGE.
      2. Be Proactive: Do not just answer. Ask deep questions about their heart, faith, and life.
      3. Tone: Gentle, authoritative but humble, like a wise grandfather or mentor.
      4. Content: Use scripture naturally in conversation.
      
      Voice Persona: You are a "Walking Bible" and a "Loving Friend".`,
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


// --- Audio Helpers ---

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}