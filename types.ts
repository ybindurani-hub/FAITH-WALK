
import { Modality } from "@google/genai";

export enum View {
  BIBLE_SEARCH = 'BIBLE_SEARCH',
  MISSIONARY = 'MISSIONARY',
  SERMON = 'SERMON',
  AUDIO_COMPANION = 'AUDIO_COMPANION',
  HISTORY = 'HISTORY',
}

export interface BibleResult {
  reference: string;
  text: string;
  explanation: string;
}

export interface Sermon {
  title: string;
  content: string; // Markdown
}

export interface BioResult {
  name: string;
  bio: string;
  locations: Array<{ title: string; uri: string }>;
}

// Audio Types
export interface AudioState {
  isConnected: boolean;
  isSpeaking: boolean;
  volume: number;
}
