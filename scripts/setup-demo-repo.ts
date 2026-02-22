import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CHARTER_CONTENT = `# Repo Charter

## 기술 스택
- 언어: TypeScript (strict mode)
- 런타임: Node.js 18+

## 코딩 컨벤션
- \`any\` 타입 사용 금지 (unknown 또는 명시적 타입 사용)
- 함수/변수: camelCase, 컴포넌트/클래스: PascalCase, 상수: UPPER_SNAKE_CASE
- 파일당 하나의 export default
- 비동기 처리는 async/await 사용 (Promise 체이닝 지양)

## 폴더 구조 규칙
- 비즈니스 로직: src/lib/
- 타입 정의: 각 모듈의 types.ts
- 테스트: 구현 파일과 동일 폴더, .test.ts 확장자

## 금지 패턴
- console.log 프로덕션 코드 사용 금지 (logger 사용)
- 하드코딩된 API 키/시크릿 금지
- 동기 파일 I/O 금지 (fs.readFileSync 등)
- 중첩 콜백 금지 (async/await 사용)

## PR 규칙
- main에 직접 push 금지
- 모든 PR은 Guardian 검사 통과 필수
- 커밋 메시지는 Conventional Commits 형식 필수
`;

const VIBE_README = `# Vibe Orchestrator 관리 폴더

이 폴더는 Vibe Orchestrator가 관리하는 파일들을 저장합니다.

## 폴더 구조

- \`CHARTER.md\` — 레포 컨벤션 문서
- \`sessions/\` — 작업 세션 로그
- \`ADR/\` — 아키텍처 결정 기록
`;

const ISSUE_TEMPLATE = `---
name: Vibe Task
about: Vibe Orchestrator가 자동 생성하는 작업 이슈
title: ''
labels: vibe-coding
assignees: ''
---

## 🎯 목표 (Goal)


## ✅ 범위 (In Scope)


## ❌ 비범위 (Out of Scope)


## 📋 수용 기준 (Acceptance Criteria)
- [ ]

## 📁 영향 범위 (Affected Areas)


## ⚠️ 리스크 (Risks)
`;

const SRC_README = `# src 폴더

이 폴더는 Vibe Orchestrator 데모 레포의 소스 코드가 저장됩니다.

AI 에이전트가 생성하는 코드는 \`src/lib/\` 하위에 기능별로 저장됩니다.
`;

interface FileToCreate {
  path: string;
  content: string;
  message: string;
}

async function setupDemoRepo() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    console.error('❌ 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
    console.error('필요: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  const filesToCreate: FileToCreate[] = [
    {
      path: 'docs/vibe/README.md',
      content: VIBE_README,
      message: 'docs: add Vibe Orchestrator docs folder',
    },
    {
      path: 'docs/vibe/sessions/.gitkeep',
      content: '',
      message: 'docs: add sessions folder for vibe session logs',
    },
    {
      path: 'docs/vibe/ADR/.gitkeep',
      content: '',
      message: 'docs: add ADR folder for architecture decision records',
    },
    {
      path: 'docs/vibe/CHARTER.md',
      content: CHARTER_CONTENT,
      message: 'docs: add default CHARTER.md',
    },
    {
      path: 'src/README.md',
      content: SRC_README,
      message: 'docs: add src folder README',
    },
    {
      path: '.github/ISSUE_TEMPLATE/vibe_task.md',
      content: ISSUE_TEMPLATE,
      message: 'ci: add Vibe Task issue template',
    },
  ];

  console.log('🚀 데모 레포 초기화를 시작합니다...\n');

  let createdCount = 0;

  for (const file of filesToCreate) {
    try {
      // 기존 파일 확인
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: file.path });
        sha = Array.isArray(data) ? undefined : data.sha;
      } catch {
        // 파일 없음 - 새로 생성
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: file.message,
        content: Buffer.from(file.content).toString('base64'),
        sha,
      });

      console.log(`✅ ${file.path}`);
      createdCount++;
    } catch (error) {
      console.error(
        `❌ ${file.path}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
    }
  }

  // vibe-coding 라벨 생성
  try {
    await octokit.issues.createLabel({
      owner,
      repo,
      name: 'vibe-coding',
      color: '7B61FF',
      description: 'Vibe Orchestrator가 생성한 이슈',
    });
    console.log('✅ labels: vibe-coding 라벨 생성됨');
  } catch {
    console.log('ℹ️  labels: vibe-coding 라벨이 이미 존재합니다');
  }

  console.log(`
✅ 데모 레포 초기화 완료!
📁 생성된 파일: ${createdCount}개
🔗 레포 URL: https://github.com/${owner}/${repo}
👉 다음 단계: npm run dev
`);
}

setupDemoRepo().catch((error: unknown) => {
  console.error('초기화 실패:', error);
  process.exit(1);
});
