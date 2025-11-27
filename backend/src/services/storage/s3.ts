import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Storage',
  callerFunction: 'S3Service',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'saltlux-ai-documents';

export async function uploadToS3(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${key}`;

    logger.success('File uploaded to S3', {
      key,
      contentType,
      logType: 'success',
    });

    return url;
  } catch (error) {
    logger.error('Failed to upload to S3', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
      logType: 'error',
    });
    throw error;
  }
}

export async function getSignedUrlFromS3(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    logger.debug('Generated signed URL', {
      key,
      expiresIn,
      logType: 'success',
    });

    return url;
  } catch (error) {
    logger.error('Failed to generate signed URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
      logType: 'error',
    });
    throw error;
  }
}

export async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    logger.success('File deleted from S3', {
      key,
      logType: 'success',
    });
  } catch (error) {
    logger.error('Failed to delete from S3', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
      logType: 'error',
    });
    throw error;
  }
}

