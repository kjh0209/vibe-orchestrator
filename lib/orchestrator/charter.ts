import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';

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

export class Charter {
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

  async load(): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'docs/vibe/CHARTER.md',
      });
      if (Array.isArray(data) || data.type !== 'file') return DEFAULT_CHARTER;
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return content;
    } catch {
      return DEFAULT_CHARTER;
    }
  }

  async generate(repoInfo: { name: string; description: string; topics: string[] }): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: `당신은 소프트웨어 팀의 기술 리드입니다.
GitHub 레포 정보를 받아 팀 컨벤션 문서(CHARTER.md)를 작성합니다.
실용적이고 구체적인 규칙을 작성하세요. 추상적인 원칙보다 "이 패턴 금지" 같은 명확한 규칙이 더 좋습니다.
마크다운 형식으로 반환하세요.`,
        },
        {
          role: 'user',
          content: `다음 레포 정보를 바탕으로 CHARTER.md를 작성해주세요:\n\n레포 이름: ${repoInfo.name}\n설명: ${repoInfo.description}\n토픽: ${repoInfo.topics.join(', ')}`,
        },
      ],
    });

    return response.choices[0].message.content ?? '';
  }

  async save(content: string): Promise<string> {
    const path = 'docs/vibe/CHARTER.md';
    const encodedContent = Buffer.from(content).toString('base64');

    try {
      const { data: existing } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });
      const sha = Array.isArray(existing) ? undefined : existing.sha;

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message: 'docs: update CHARTER.md via Vibe Orchestrator',
        content: encodedContent,
        sha,
      });
    } catch {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message: 'docs: create CHARTER.md via Vibe Orchestrator',
        content: encodedContent,
      });
    }

    return `https://github.com/${this.owner}/${this.repo}/blob/main/${path}`;
  }
}
