import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';
import type {
  RequestAnalysis,
  GeneratedFile,
  CodeGenerationResult,
  SessionLog,
} from './types';

export class VibeSession {
  private octokit: Octokit;
  private openai: OpenAI;
  private owner: string;
  private repo: string;
  private defaultBranch: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.owner = process.env.GITHUB_OWNER!;
    this.repo = process.env.GITHUB_REPO!;
    this.defaultBranch = process.env.GITHUB_DEFAULT_BRANCH ?? 'main';
  }

  async analyzeRequest(userRequest: string): Promise<RequestAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: `당신은 소프트웨어 개발 작업을 분석하는 전문가입니다.
사용자의 자연어 요청을 받아 GitHub Issue 생성에 필요한 구조화된 정보로 변환합니다.
반드시 순수 JSON만 반환하세요. 마크다운 코드블록, 설명 텍스트 없이 JSON 객체만.`,
        },
        {
          role: 'user',
          content: `다음 개발 요청을 분석해주세요: "${userRequest}"

반환할 JSON 형식:
{
  "title": "이슈 제목 (간결하게)",
  "goal": "작업 목표 설명",
  "inScope": ["범위 내 항목1", "범위 내 항목2"],
  "outOfScope": ["범위 외 항목1"],
  "acceptanceCriteria": ["수용 기준1", "수용 기준2"],
  "affectedAreas": ["영향받는 영역1", "영향받는 영역2"],
  "risks": ["리스크1"],
  "slug": "feature-name-kebab-case",
  "commitType": "feat"
}`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as RequestAnalysis;
  }

  async createIssue(analysis: RequestAnalysis): Promise<{ number: number; url: string }> {
    const inScopeList = analysis.inScope.map((item) => `- ${item}`).join('\n');
    const outOfScopeList = analysis.outOfScope.map((item) => `- ${item}`).join('\n');
    const criteriaList = analysis.acceptanceCriteria.map((item) => `- [ ] ${item}`).join('\n');
    const affectedList = analysis.affectedAreas.map((item) => `- \`${item}\``).join('\n');
    const risksList = analysis.risks.map((item) => `- ${item}`).join('\n');

    const body = `## 🎯 목표 (Goal)
${analysis.goal}

## ✅ 범위 (In Scope)
${inScopeList}

## ❌ 비범위 (Out of Scope)
${outOfScopeList}

## 📋 수용 기준 (Acceptance Criteria)
${criteriaList}

## 📁 영향 범위 (Affected Areas)
${affectedList}

## ⚠️ 리스크 (Risks)
${risksList}

---
> 🤖 이 이슈는 **Vibe Orchestrator**에 의해 자동 생성되었습니다.
> 작업 에이전트: gpt-4o-mini`;

    const { data } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: analysis.title,
      body,
      labels: ['vibe-coding'],
    });

    return { number: data.number, url: data.html_url };
  }

  async createBranch(issueNumber: number, slug: string): Promise<string> {
    const branchName = `vibe/user/${issueNumber}/${slug}`;

    try {
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.defaultBranch}`,
      });

      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      return branchName;
    } catch (error) {
      if (error instanceof Error && error.message.includes('422')) {
        const timestampedBranch = `vibe/user/${issueNumber}/${slug}-${Date.now()}`;
        const { data: ref } = await this.octokit.git.getRef({
          owner: this.owner,
          repo: this.repo,
          ref: `heads/${this.defaultBranch}`,
        });
        await this.octokit.git.createRef({
          owner: this.owner,
          repo: this.repo,
          ref: `refs/heads/${timestampedBranch}`,
          sha: ref.object.sha,
        });
        return timestampedBranch;
      }
      throw error;
    }
  }

  async generateCode(
    request: string,
    charter: string,
    analysis: RequestAnalysis
  ): Promise<CodeGenerationResult> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: `당신은 시니어 TypeScript 개발자입니다.
요청에 맞는 코드를 생성하되 다음 레포 컨벤션(CHARTER)을 반드시 준수해야 합니다.

CHARTER:
${charter}

규칙:
1. 파일은 3~5개 이내로 생성 (데모용으로 간결하게)
2. 각 파일은 실제로 동작하는 TypeScript 코드여야 함
3. commitGroups는 의미 단위로 2~3개로 분할 (예: 타입 정의 / 핵심 로직 / 테스트)
4. designDecisions에는 중요한 설계 결정을 1~3개 기록
5. 반드시 순수 JSON만 반환. 마크다운 코드블록 없이.`,
        },
        {
          role: 'user',
          content: `다음 개발 요청에 맞는 코드를 생성해주세요:

요청: ${request}

분석 결과:
- 목표: ${analysis.goal}
- 영향 범위: ${analysis.affectedAreas.join(', ')}

반환할 JSON 형식:
{
  "files": [
    { "path": "src/lib/feature/types.ts", "content": "...", "intent": "타입 정의" },
    { "path": "src/lib/feature/index.ts", "content": "...", "intent": "핵심 로직" }
  ],
  "commitGroups": [
    { "message": "feat(feature): add type definitions", "files": ["src/lib/feature/types.ts"], "intent": "타입 정의 추가" },
    { "message": "feat(feature): implement core logic", "files": ["src/lib/feature/index.ts"], "intent": "핵심 로직 구현" }
  ],
  "designDecisions": ["결정1", "결정2"]
}`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? '{}';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as CodeGenerationResult;
  }

  async pushSingleCommit(
    files: GeneratedFile[],
    commitMessage: string,
    branchName: string
  ): Promise<{ message: string; sha: string }> {
    for (const file of files) {
      const encodedContent = Buffer.from(file.content).toString('base64');

      try {
        const { data: existing } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: file.path,
          ref: branchName,
        });
        const sha = Array.isArray(existing) ? undefined : existing.sha;

        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: file.path,
          message: commitMessage,
          content: encodedContent,
          branch: branchName,
          sha,
        });
      } catch {
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: file.path,
          message: commitMessage,
          content: encodedContent,
          branch: branchName,
        });
      }
    }

    const { data: ref } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branchName}`,
    });

    return { message: commitMessage, sha: ref.object.sha };
  }

  async createSessionLog(data: SessionLog, branchName: string): Promise<string> {
    const date = new Date(data.timestamp);
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const filePath = `docs/vibe/sessions/${yyyymmdd}-issue${data.issueNumber}.md`;

    const filesTable = data.files
      .map((f) => `| \`${f.path}\` | ${f.intent} |`)
      .join('\n');

    const commitsSection = data.commitMessages
      .map((msg, i) => `${i + 1}. ${msg}`)
      .join('\n');

    const decisionsSection = data.designDecisions
      .map((d, i) => `${i + 1}. ${d}`)
      .join('\n');

    const unresolvedSection =
      data.unresolvedItems.length > 0
        ? data.unresolvedItems.map((item) => `- [ ] ${item}`).join('\n')
        : '없음';

    const content = `# 작업 세션 로그

| 항목 | 내용 |
|------|------|
| **일시** | ${data.timestamp} |
| **사용 에이전트** | gpt-4o-mini |
| **관련 이슈** | #${data.issueNumber} |
| **세션 ID** | ${data.sessionId} |

## 🎯 작업 목표
${data.goal}

## 🏗️ 주요 설계 결정
${decisionsSection}

## 📁 생성된 파일
| 파일 | 설명 |
|------|------|
${filesTable}

## 💾 커밋 내역
${commitsSection}

## 📌 미해결 사항 (다음 세션으로)
${unresolvedSection}

---
> 🤖 Vibe Orchestrator 자동 생성 | [이슈 보기](https://github.com/${this.owner}/${this.repo}/issues/${data.issueNumber})
`;

    const encodedContent = Buffer.from(content).toString('base64');

    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: filePath,
      message: `docs(vibe): add session log for issue #${data.issueNumber}`,
      content: encodedContent,
      branch: branchName,
    });

    return `https://github.com/${this.owner}/${this.repo}/blob/${branchName}/${filePath}`;
  }

  async createPR(params: {
    issueNumber: number;
    branchName: string;
    sessionLogPath: string;
    analysis: RequestAnalysis;
    codeResult: CodeGenerationResult;
    commits: Array<{ message: string; sha: string }>;
  }): Promise<{ number: number; url: string }> {
    const { issueNumber, branchName, sessionLogPath, analysis, codeResult, commits } = params;

    const commitGroupsList = codeResult.commitGroups
      .map((g, i) => `${i + 1}. ${g.message} — ${g.intent}`)
      .join('\n');

    const filesTable = codeResult.files
      .map((f) => `| \`${f.path}\` | 신규 | ${f.intent} |`)
      .join('\n');

    const criteriaList = analysis.acceptanceCriteria
      .map((item) => `- [ ] ${item}`)
      .join('\n');

    const affectedList = analysis.affectedAreas
      .map((item) => `- \`${item}\``)
      .join('\n');

    const body = `## 🔗 관련 이슈
Closes #${issueNumber}

## 📝 변경 요약
${analysis.goal}

## 🔧 주요 변경 포인트
${commitGroupsList}

## 📁 변경 파일 및 의도
| 파일 | 변경 유형 | 이유 |
|------|----------|------|
${filesTable}

## 📋 수용 기준 달성 여부
${criteriaList}

## 🔍 영향 범위
${affectedList}

## 📄 세션 로그
[🔗 작업 세션 로그 보기](${sessionLogPath})

---
> 🤖 이 PR은 **Vibe Orchestrator**에 의해 자동 생성되었습니다.
> 커밋 수: ${commits.length}개 | 파일 수: ${codeResult.files.length}개`;

    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `[Vibe] ${analysis.title}`,
      body,
      head: branchName,
      base: this.defaultBranch,
    });

    return { number: data.number, url: data.html_url };
  }
}
