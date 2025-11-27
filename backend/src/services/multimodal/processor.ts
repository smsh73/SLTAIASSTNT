import { orchestrateAI } from '../ai/orchestrator.js';
import { uploadToS3 } from '../storage/s3.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Multimodal',
  callerFunction: 'MultimodalProcessor',
});

export interface MultimodalInput {
  type: 'text' | 'image' | 'audio' | 'video';
  content: string | Buffer;
  mimeType?: string;
}

export interface MultimodalOutput {
  type: 'text' | 'image' | 'audio' | 'video';
  content: string;
  metadata?: Record<string, any>;
}

export async function processMultimodalInput(
  input: MultimodalInput,
  prompt?: string
): Promise<MultimodalOutput> {
  try {
    switch (input.type) {
      case 'text':
        return await processText(input.content as string, prompt);

      case 'image':
        return await processImage(input.content as Buffer, input.mimeType, prompt);

      case 'audio':
        return await processAudio(input.content as Buffer, input.mimeType, prompt);

      case 'video':
        return await processVideo(input.content as Buffer, input.mimeType, prompt);

      default:
        throw new Error(`Unsupported input type: ${input.type}`);
    }
  } catch (error) {
    logger.error('Multimodal processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputType: input.type,
      logType: 'error',
    });
    throw error;
  }
}

async function processText(
  text: string,
  prompt?: string
): Promise<MultimodalOutput> {
  // 텍스트는 그대로 반환하거나 AI로 처리
  if (prompt) {
    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 텍스트 처리 전문가입니다.',
        },
        {
          role: 'user',
          content: `${prompt}\n\n텍스트:\n${text}`,
        },
      ],
      prompt
    );

    return {
      type: 'text',
      content: response || text,
    };
  }

  return {
    type: 'text',
    content: text,
  };
}

async function processImage(
  imageBuffer: Buffer,
  mimeType?: string,
  prompt?: string
): Promise<MultimodalOutput> {
  try {
    // 이미지를 S3에 업로드
    const imageKey = `multimodal/images/${Date.now()}.${getImageExtension(mimeType)}`;
    const imageUrl = await uploadToS3(
      imageBuffer,
      imageKey,
      mimeType || 'image/jpeg'
    );

    // 이미지 분석 (AI 사용)
    if (prompt) {
      // 이미지 URL을 포함한 프롬프트로 AI 호출
      const response = await orchestrateAI(
        [
          {
            role: 'system',
            content: '당신은 이미지 분석 전문가입니다.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n이미지 URL: ${imageUrl}`,
          },
        ],
        prompt
      );

      return {
        type: 'text',
        content: response || '이미지가 처리되었습니다.',
        metadata: {
          imageUrl,
          mimeType,
        },
      };
    }

    return {
      type: 'text',
      content: '이미지가 업로드되었습니다.',
      metadata: {
        imageUrl,
        mimeType,
      },
    };
  } catch (error) {
    logger.error('Image processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    throw error;
  }
}

async function processAudio(
  audioBuffer: Buffer,
  mimeType?: string,
  prompt?: string
): Promise<MultimodalOutput> {
  try {
    // 오디오를 S3에 업로드
    const audioKey = `multimodal/audio/${Date.now()}.${getAudioExtension(mimeType)}`;
    const audioUrl = await uploadToS3(
      audioBuffer,
      audioKey,
      mimeType || 'audio/mpeg'
    );

    // 오디오 분석 (AI 사용)
    if (prompt) {
      const response = await orchestrateAI(
        [
          {
            role: 'system',
            content: '당신은 오디오 분석 전문가입니다.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n오디오 URL: ${audioUrl}`,
          },
        ],
        prompt
      );

      return {
        type: 'text',
        content: response || '오디오가 처리되었습니다.',
        metadata: {
          audioUrl,
          mimeType,
        },
      };
    }

    return {
      type: 'text',
      content: '오디오가 업로드되었습니다.',
      metadata: {
        audioUrl,
        mimeType,
      },
    };
  } catch (error) {
    logger.error('Audio processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    throw error;
  }
}

async function processVideo(
  videoBuffer: Buffer,
  mimeType?: string,
  prompt?: string
): Promise<MultimodalOutput> {
  try {
    // 비디오를 S3에 업로드
    const videoKey = `multimodal/video/${Date.now()}.${getVideoExtension(mimeType)}`;
    const videoUrl = await uploadToS3(
      videoBuffer,
      videoKey,
      mimeType || 'video/mp4'
    );

    // 비디오 분석 (AI 사용)
    if (prompt) {
      const response = await orchestrateAI(
        [
          {
            role: 'system',
            content: '당신은 비디오 분석 전문가입니다.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n비디오 URL: ${videoUrl}`,
          },
        ],
        prompt
      );

      return {
        type: 'text',
        content: response || '비디오가 처리되었습니다.',
        metadata: {
          videoUrl,
          mimeType,
        },
      };
    }

    return {
      type: 'text',
      content: '비디오가 업로드되었습니다.',
      metadata: {
        videoUrl,
        mimeType,
      },
    };
  } catch (error) {
    logger.error('Video processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    throw error;
  }
}

function getImageExtension(mimeType?: string): string {
  if (!mimeType) return 'jpg';
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'jpg';
}

function getAudioExtension(mimeType?: string): string {
  if (!mimeType) return 'mp3';
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
  };
  return map[mimeType] || 'mp3';
}

function getVideoExtension(mimeType?: string): string {
  if (!mimeType) return 'mp4';
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
  };
  return map[mimeType] || 'mp4';
}

