import Docker from 'dockerode';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'SandboxManager',
});

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
});

const CONTAINER_IMAGE = 'saltlux-code-executor';

export async function ensureImageExists(): Promise<boolean> {
  try {
    const images = await docker.listImages();
    const exists = images.some(
      (img) =>
        img.RepoTags &&
        img.RepoTags.some((tag) => tag.includes(CONTAINER_IMAGE))
    );

    if (!exists) {
      logger.warning('Code executor image not found', {
        image: CONTAINER_IMAGE,
        logType: 'warning',
      });
      // 이미지 빌드 필요 (docker build 명령 실행)
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to check image existence', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return false;
  }
}

export async function cleanupContainers(): Promise<void> {
  try {
    const containers = await docker.listContainers({ all: true });
    const executorContainers = containers.filter((c) =>
      c.Image.includes(CONTAINER_IMAGE)
    );

    for (const containerInfo of executorContainers) {
      try {
        const container = docker.getContainer(containerInfo.Id);
        if (containerInfo.State === 'running') {
          await container.stop();
        }
        await container.remove();
      } catch (error) {
        // 컨테이너가 이미 제거되었을 수 있음
      }
    }

    logger.debug('Containers cleaned up', {
      containerCount: executorContainers.length,
      logType: 'success',
    });
  } catch (error) {
    logger.error('Failed to cleanup containers', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
  }
}

