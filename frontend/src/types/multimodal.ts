export interface MultimodalOutput {
  type: 'text' | 'image' | 'audio' | 'video';
  content: string;
  metadata?: {
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
    mimeType?: string;
    [key: string]: any;
  };
}

