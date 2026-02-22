import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';
import type { GeneratedFile, CommitGroup, GuardianViolation, GuardianReviewResult } from './types';

const DEFAULT_CHARTER = `# Repo Charter

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

interface StaticRule {
  rule: string;
  pattern: RegExp;
  severity: 'error' | 'warning';
  description: string;
  suggestion: string;
}

const STATIC_RULES: StaticRule[] = [
  {
    rule: 'no-any-type',
    pattern: /:\s*any[\s;,)]/g,
    severity: 'error',
    description: 'any 타입 사용 금지 (CHARTER 위반)',
    suggestion: 'unknown 또는 명시적 타입을 사용하세요',
  },
  {
    rule: 'no-hardcoded-secrets',
    pattern: /(api_key|apikey|secret|password|token)\s*=\s*["'][^"']{8,}["']/gi,
    severity: 'error',
    description: '하드코딩된 시크릿/API 키 감지',
    suggestion: '환경변수를 사용하세요',
  },
  {
    rule: 'no-console-log',
    pattern: /console\.log\(/g,
    severity: 'warning',
    description: 'console.log 사용 감지 (프로덕션 코드 금지)',
    suggestion: '적절한 logger를 사용하거나 제거하세요',
  },
  {
    rule: 'no-sync-io',
    pattern: /readFileSync|writeFileSync|existsSync/g,
    severity: 'warning',
    description: '동기 파일 I/O 사용 감지',
    suggestion: '비동기 fs.promises API를 사용하세요',
  },
];

const CONVENTIONAL_COMMIT_PATTERN = /^(feat|fix|refactor|test|docs|chore|style|perf)(\(.+\))?: .+/;

export class GuardianAgent {
  private octokit: Octokit;
  private openai: OpenAI;
  private owner: string;
  private repo: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.owner = process.env.GITHUB_OWNER!;
    this.repo = process.env.GITHUB_REPO!;
  }

  async loadCharter(): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'docs/vibe/CHARTER.md',
      });
      if (Array.isArray(data) || data.type !== 'file') return DEFAULT_CHARTER;
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch {
      return DEFAULT_CHARTER;
    }
  }

  runStaticChecks(files: GeneratedFile[], commitGroups?: CommitGroup[]): GuardianViolation[] {
    const violations: GuardianViolation[] = [];

    for (const file of files) {
      for (const rule of STATIC_RULES) {
        const matches = file.content.match(rule.pattern);
        if (matches && matches.length > 0) {
          violations.push({
            severity: rule.severity,
            layer: 'static',
            rule: rule.rule,
            file: file.path,
            description: rule.description,
            suggestion: rule.suggestion,
          });
        }
      }
    }

    // Conventional Commits 검사
    if (commitGroups) {
      for (const group of commitGroups) {
        if (!CONVENTIONAL_COMMIT_PATTERN.test(group.message)) {
          violations.push({
            severity: 'error',
            layer: 'static',
            rule: 'conventional-commits',
            file: 'COMMIT_MSG',
            description: `Conventional Commits 형식 미준수: "${group.message}"`,
            suggestion: 'feat(scope): description 형식을 사용하세요',
          });
        }
      }
    }

    return violations;
  }

  async runLLMChecks(files: GeneratedFile[], charter: string): Promise<GuardianViolation[]> {
    if (files.length === 0) return [];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: `당신은 엄격한 코드 리뷰어입니다.
다음 CHARTER 규칙 중 정적 분석으로 잡을 수 없는 의미적 위반 사항만 검사하세요:
- 폴더 구조 규칙 준수 여부
- 비동기 처리 패턴 준수 여부 (중첩 콜백 등)
- 단일 책임 원칙 위반 여부

CHARTER:
${charter}

반드시 순수 JSON 배열만 반환. violations 없으면 빈 배열 [].
각 항목 형식: { "severity": "error"|"warning", "rule": "규칙명", "file": "파일경로", "description": "설명", "suggestion": "개선 제안" }`,
        },
        {
          role: 'user',
          content: JSON.stringify(files.map((f) => ({ path: f.path, content: f.content }))),
        },
      ],
    });

    const text = response.choices[0].message.content ?? '[]';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as Array<{
        severity: 'error' | 'warning';
        rule: string;
        file: string;
        description: string;
        suggestion?: string;
      }>;
      return parsed.map((v) => ({ ...v, layer: 'llm' as const }));
    } catch {
      return [];
    }
  }

  async reviewPR(
    _prNumber: number,
    files: GeneratedFile[],
    commitGroups: CommitGroup[]
  ): Promise<GuardianReviewResult> {
    const charter = await this.loadCharter();

    // 계층 1: 정적 검사
    const staticViolations = this.runStaticChecks(files, commitGroups);
    const staticErrorFiles = new Set(
      staticViolations.filter((v) => v.severity === 'error').map((v) => v.file)
    );

    // 계층 2: 정적 에러가 없는 파일만 LLM 검사
    const cleanFiles = files.filter((f) => !staticErrorFiles.has(f.path));
    const llmViolations = await this.runLLMChecks(cleanFiles, charter);

    const allViolations = [...staticViolations, ...llmViolations];
    const passed = allViolations.filter((v) => v.severity === 'error').length === 0;

    const staticRuleCount = 4;
    const llmRuleCount = 3;

    return {
      passed,
      violations: allViolations,
      staticChecksPassed: staticRuleCount - staticViolations.filter((v) => v.severity === 'error').length,
      llmChecksPassed: llmRuleCount - llmViolations.filter((v) => v.severity === 'error').length,
      summary: passed
        ? '모든 CHARTER 규칙을 준수합니다.'
        : `${allViolations.length}건의 위반 사항이 발견되었습니다.`,
    };
  }

  async postReviewComment(prNumber: number, result: GuardianReviewResult): Promise<void> {
    const { passed, violations, staticChecksPassed, llmChecksPassed } = result;

    const staticViolations = violations.filter((v) => v.layer === 'static');
    const llmViolations = violations.filter((v) => v.layer === 'llm');

    const violationTable =
      violations.length > 0
        ? `
### 🚨 위반 사항 목록
| 심각도 | 계층 | 규칙 | 파일 | 설명 | 제안 |
|--------|------|------|------|------|------|
${violations
  .map(
    (v) =>
      `| ${v.severity === 'error' ? '🔴 error' : '🟡 warning'} | ${v.layer} | \`${v.rule}\` | \`${v.file}\` | ${v.description} | ${v.suggestion ?? '-'} |`
  )
  .join('\n')}
`
        : '위반 사항이 없습니다. 🎉';

    const body = `## 🛡️ Guardian Agent 리뷰 결과

${passed ? '### ✅ 모든 검사 통과' : '### ❌ 위반 사항 발견'}

### 📊 검사 요약
| 계층 | 종류 | 결과 |
|------|------|------|
| 계층 1 | 정적 분석 (규칙 기반) | ${staticViolations.length}건 위반 |
| 계층 2 | 의미 분석 (AI 기반) | ${llmViolations.length}건 위반 |
| **합계** | | **${violations.length}건 위반** |

${violationTable}

### 💡 안내
- \`error\` 위반이 있으면 머지가 차단됩니다
- \`warning\`은 권고사항입니다
- 오탐이라고 판단되면 PR 코멘트에 \`/vibe-ignore: <이유>\`를 남겨주세요

---
> 🤖 Guardian Agent 자동 리뷰 | 정적분석 통과: ${staticChecksPassed}개 규칙 | AI분석 통과: ${llmChecksPassed}개 규칙`;

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });
  }
}
