export type Tab = 'chat' | 'image' | 'video' | 'voice' | 'search';

export interface TextPart {
    text: string;
}

export interface InlineDataPart {
    inlineData: {
        mimeType: string;
        data: string; // base64 encoded string, without the data URI prefix
    };
}
export type ChatPart = TextPart | InlineDataPart;
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  parts: ChatPart[];
}

export interface ChatSummary {
  id: string;
  title: string;
  lastUpdated: Date;
}

export interface TranscriptTurn {
    user: string;
    model: string;
}
  
export interface VoiceChatSummary {
    id:string;
    title: string;
    lastUpdated: Date;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        uri: string;
        text: string;
        author: string;
      }[];
    }
  };
}

export interface SearchHistoryItem {
    id: string;
    query: string;
    timestamp: number;
}

// UI Customization Types
export type Theme = 'light' | 'dark';
export type AccentColor = 'indigo' | 'sky' | 'emerald' | 'rose' | 'amber';
export type AppFont = 'sans' | 'serif' | 'mono';
export type VoiceChoice = 'Zephyr' | 'Kore'; // Zephyr=Male, Kore=Female

export interface Settings {
  theme: Theme;
  font: AppFont;
  accentColor: AccentColor;
  voice: VoiceChoice;
}
