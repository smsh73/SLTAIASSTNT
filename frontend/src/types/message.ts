export interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  provider?: string;
  providerName?: string;
  phase?: string;
}
