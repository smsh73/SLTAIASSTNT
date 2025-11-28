// Prisma 시드 파일
// 200% 완성도 버전

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 생성 시작...');

  // 관리자 사용자 생성
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@saltlux.com' },
    update: {},
    create: {
      email: 'admin@saltlux.com',
      passwordHash: adminPassword,
      name: '시스템 관리자',
      role: 'admin',
      isActive: true,
    },
  });
  console.log('✅ 관리자 사용자 생성:', admin.email);

  // 테스트 사용자 생성
  const testPassword = await hashPassword('test123');
  const testUser = await prisma.user.upsert({
    where: { email: 'test@saltlux.com' },
    update: {},
    create: {
      email: 'test@saltlux.com',
      passwordHash: testPassword,
      name: '테스트 사용자',
      role: 'user',
      isActive: true,
    },
  });
  console.log('✅ 테스트 사용자 생성:', testUser.email);

  // 기본 가드레일 규칙
  const guardrails = [
    {
      name: '금지어 필터',
      description: '부적절한 언어 사용 차단',
      pattern: '(?i)(욕설|비방|혐오)',
      action: 'block' as const,
      priority: 10,
    },
    {
      name: '개인정보 보호',
      description: '개인정보 포함 차단',
      pattern: '(?i)(주민등록번호|신용카드|계좌번호)',
      action: 'block' as const,
      priority: 9,
    },
    {
      name: '시스템 명령 차단',
      description: '시스템 명령 실행 차단',
      pattern: '(?i)(rm -rf|format|delete|drop)',
      action: 'block' as const,
      priority: 8,
    },
  ];

  for (const guardrail of guardrails) {
    await prisma.guardrail.upsert({
      where: { id: guardrail.priority },
      update: guardrail,
      create: {
        ...guardrail,
        isActive: true,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ 가드레일 규칙 생성:', guardrails.length, '개');

  // 샘플 대화 생성
  const conversation = await prisma.conversation.create({
    data: {
      userId: testUser.id,
      title: '샘플 대화',
      topic: '테스트',
      status: 'active',
    },
  });
  console.log('✅ 샘플 대화 생성:', conversation.id);

  // 샘플 메시지 생성
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        userId: testUser.id,
        role: 'user',
        content: '안녕하세요!',
      },
      {
        conversationId: conversation.id,
        userId: testUser.id,
        role: 'assistant',
        content: '안녕하세요! 무엇을 도와드릴까요?',
        provider: 'openai',
      },
    ],
  });
  console.log('✅ 샘플 메시지 생성');

  console.log('🎉 시드 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 시드 데이터 생성 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

