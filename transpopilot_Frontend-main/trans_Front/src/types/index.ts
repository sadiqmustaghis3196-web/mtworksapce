export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  avatar?: string;
  isBlocked: boolean;
  isFavorite: boolean;
  tags: string[];
  lastContact: string;
  callCount: number;
}

export interface CallLog {
  id: string;
  contactId?: string;
  phoneNumber: string;
  contactName?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number; // in seconds
  timestamp: string;
  isBlocked: boolean;
  spamScore: number; // 0-100
  aiAnalysis?: {
    category: 'personal' | 'business' | 'spam' | 'telemarketing' | 'robocall' | 'unknown';
    confidence: number;
    reason: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
  transcription?: string;
  location?: string;
}

export interface FilterRule {
  id: string;
  name: string;
  type: 'whitelist' | 'blacklist' | 'keyword' | 'time' | 'location' | 'ai';
  isActive: boolean;
  priority: number;
  conditions: {
    phonePattern?: string;
    keywords?: string[];
    timeRange?: {
      start: string;
      end: string;
      days: string[];
    };
    location?: string;
    spamThreshold?: number;
  };
  action: 'block' | 'allow' | 'voicemail' | 'custom_message';
  customMessage?: string;
  createdAt: string;
}

export interface AISettings {
  spamDetection: {
    enabled: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    autoBlock: boolean;
    threshold: number;
  };
  voiceAnalysis: {
    enabled: boolean;
    transcription: boolean;
    sentimentAnalysis: boolean;
    languageDetection: boolean;
  };
  smartFiltering: {
    enabled: boolean;
    learnFromBehavior: boolean;
    adaptiveBlocking: boolean;
    contextAware: boolean;
  };
}

export interface SpamReport {
  phoneNumber: string;
  reportCount: number;
  lastReported: string;
  categories: string[];
  confidence: number;
  isVerified: boolean;
}