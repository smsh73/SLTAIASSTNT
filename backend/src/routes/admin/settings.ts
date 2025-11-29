import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../../middleware/auth.js';
import { getPrismaClient } from '../../utils/database.js';
import { createLogger } from '../../utils/logger.js';

const router = Router();
const prisma = getPrismaClient();

const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description: string }> = {
  CODE_EXECUTION_MODE: {
    value: 'local',
    category: 'code_execution',
    description: '코드 실행 모드 (local: 현재 컨테이너에서 보안 검증 후 실행, docker: 별도 Docker 컨테이너에서 격리 실행)',
  },
  CODE_EXECUTION_ENABLED: {
    value: 'false',
    category: 'code_execution',
    description: '코드 실행 기능 활성화 여부 (관리자만 변경 가능, 보안 위험이 있으므로 주의)',
  },
  CODE_EXECUTION_TIMEOUT: {
    value: '30000',
    category: 'code_execution',
    description: '코드 실행 타임아웃 (밀리초)',
  },
  STORAGE_MODE: {
    value: 'local',
    category: 'storage',
    description: '파일 저장 모드 (local: 서버 로컬 저장, s3: AWS S3 저장)',
  },
  MAX_FILE_SIZE: {
    value: '52428800',
    category: 'storage',
    description: '최대 파일 크기 (바이트, 기본값: 50MB)',
  },
  AI_DEFAULT_PROVIDER: {
    value: 'auto',
    category: 'ai',
    description: '기본 AI 프로바이더 (auto, openai, claude, gemini, perplexity, luxia)',
  },
  AI_MIX_OF_AGENTS_ENABLED: {
    value: 'true',
    category: 'ai',
    description: 'Mix of Agents 모드 활성화 여부',
  },
};

router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const logger = createLogger({
    screenName: 'Admin',
    callerFunction: 'getSettings',
    screenUrl: '/api/admin/settings',
  });

  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const settingsMap: Record<string, any> = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = settings.find((s) => s.key === key);
      settingsMap[key] = {
        value: existing?.value || defaultValue.value,
        category: defaultValue.category,
        description: defaultValue.description,
        updatedAt: existing?.updatedAt || null,
      };
    }

    for (const setting of settings) {
      if (!settingsMap[setting.key]) {
        settingsMap[setting.key] = {
          value: setting.value,
          category: setting.category,
          description: setting.description,
          updatedAt: setting.updatedAt,
        };
      }
    }

    logger.success('Settings retrieved', {
      count: Object.keys(settingsMap).length,
      logType: 'success',
    });

    res.json({ settings: settingsMap });
  } catch (error) {
    logger.error('Failed to retrieve settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

router.get('/:key', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const logger = createLogger({
    screenName: 'Admin',
    callerFunction: 'getSetting',
    screenUrl: '/api/admin/settings/:key',
  });

  try {
    const { key } = req.params;

    const setting = await prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      const defaultSetting = DEFAULT_SETTINGS[key];
      if (defaultSetting) {
        res.json({
          key,
          value: defaultSetting.value,
          category: defaultSetting.category,
          description: defaultSetting.description,
          isDefault: true,
        });
        return;
      }
      res.status(404).json({ error: 'Setting not found' });
      return;
    }

    logger.success('Setting retrieved', {
      key,
      logType: 'success',
    });

    res.json({
      key: setting.key,
      value: setting.value,
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt,
      isDefault: false,
    });
  } catch (error) {
    logger.error('Failed to retrieve setting', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    res.status(500).json({ error: 'Failed to retrieve setting' });
  }
});

router.put('/:key', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const logger = createLogger({
    screenName: 'Admin',
    callerFunction: 'updateSetting',
    screenUrl: '/api/admin/settings/:key',
  });

  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      res.status(400).json({ error: 'Value is required' });
      return;
    }

    const defaultSetting = DEFAULT_SETTINGS[key];
    const category = defaultSetting?.category || 'custom';
    const desc = description || defaultSetting?.description || '';

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value: String(value),
        description: desc,
      },
      create: {
        key,
        value: String(value),
        category,
        description: desc,
      },
    });

    logger.success('Setting updated', {
      key,
      value: String(value),
      logType: 'success',
    });

    res.json({
      key: setting.key,
      value: setting.value,
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt,
    });
  } catch (error) {
    logger.error('Failed to update setting', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

router.post('/bulk', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const logger = createLogger({
    screenName: 'Admin',
    callerFunction: 'bulkUpdateSettings',
    screenUrl: '/api/admin/settings/bulk',
  });

  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings object is required' });
      return;
    }

    const results: any[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const defaultSetting = DEFAULT_SETTINGS[key];
      const category = defaultSetting?.category || 'custom';
      const description = defaultSetting?.description || '';

      const setting = await prisma.systemSettings.upsert({
        where: { key },
        update: {
          value: String(value),
        },
        create: {
          key,
          value: String(value),
          category,
          description,
        },
      });

      results.push({
        key: setting.key,
        value: setting.value,
        category: setting.category,
      });
    }

    logger.success('Settings bulk updated', {
      count: results.length,
      logType: 'success',
    });

    res.json({ updated: results });
  } catch (error) {
    logger.error('Failed to bulk update settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.delete('/:key', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const logger = createLogger({
    screenName: 'Admin',
    callerFunction: 'deleteSetting',
    screenUrl: '/api/admin/settings/:key',
  });

  try {
    const { key } = req.params;

    if (DEFAULT_SETTINGS[key]) {
      res.status(400).json({ error: 'Cannot delete default settings, use PUT to reset to default value' });
      return;
    }

    await prisma.systemSettings.delete({
      where: { key },
    });

    logger.success('Setting deleted', {
      key,
      logType: 'success',
    });

    res.json({ message: 'Setting deleted' });
  } catch (error) {
    logger.error('Failed to delete setting', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

export async function getSetting(key: string): Promise<string> {
  try {
    const prismaClient = getPrismaClient();
    const setting = await prismaClient.systemSettings.findUnique({
      where: { key },
    });

    if (setting) {
      return setting.value;
    }

    const defaultSetting = DEFAULT_SETTINGS[key];
    return defaultSetting?.value || '';
  } catch (error) {
    const defaultSetting = DEFAULT_SETTINGS[key];
    return defaultSetting?.value || '';
  }
}

export async function getSettingBoolean(key: string): Promise<boolean> {
  const value = await getSetting(key);
  return value.toLowerCase() === 'true';
}

export async function getSettingNumber(key: string): Promise<number> {
  const value = await getSetting(key);
  return parseInt(value, 10) || 0;
}

export default router;
