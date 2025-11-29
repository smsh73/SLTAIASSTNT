import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Storage',
  callerFunction: 'LocalStorageService',
});

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const BASE_URL = process.env.BASE_URL || '';

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info('Created directory', { path: dirPath, logType: 'info' });
  }
}

export async function uploadToLocalStorage(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  try {
    const fullPath = path.join(UPLOAD_DIR, key);
    const dir = path.dirname(fullPath);
    
    ensureDirectoryExists(dir);
    
    fs.writeFileSync(fullPath, file);
    
    const url = `${BASE_URL}/uploads/${key}`;
    
    logger.success('File uploaded to local storage', {
      key,
      contentType,
      size: file.length,
      logType: 'success',
    });
    
    return url;
  } catch (error) {
    logger.error('Failed to upload to local storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
      logType: 'error',
    });
    throw error;
  }
}

export async function getFileFromLocalStorage(key: string): Promise<Buffer> {
  try {
    const fullPath = path.join(UPLOAD_DIR, key);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    
    const fileBuffer = fs.readFileSync(fullPath);
    
    logger.debug('File retrieved from local storage', {
      key,
      size: fileBuffer.length,
      logType: 'success',
    });
    
    return fileBuffer;
  } catch (error) {
    logger.error('Failed to get file from local storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
      logType: 'error',
    });
    throw error;
  }
}

export async function deleteFromLocalStorage(key: string): Promise<void> {
  try {
    const fullPath = path.join(UPLOAD_DIR, key);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      
      logger.success('File deleted from local storage', {
        key,
        logType: 'success',
      });
    } else {
      logger.warning('File not found for deletion', {
        key,
        logType: 'warning',
      });
    }
  } catch (error) {
    logger.error('Failed to delete from local storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
      logType: 'error',
    });
    throw error;
  }
}

export async function getFileUrl(key: string): Promise<string> {
  const fullPath = path.join(UPLOAD_DIR, key);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${key}`);
  }
  
  return `${BASE_URL}/uploads/${key}`;
}

export function getLocalFilePath(key: string): string {
  return path.join(UPLOAD_DIR, key);
}

export async function fileExists(key: string): Promise<boolean> {
  const fullPath = path.join(UPLOAD_DIR, key);
  return fs.existsSync(fullPath);
}

export async function getFileStats(key: string): Promise<fs.Stats | null> {
  try {
    const fullPath = path.join(UPLOAD_DIR, key);
    return fs.statSync(fullPath);
  } catch {
    return null;
  }
}
