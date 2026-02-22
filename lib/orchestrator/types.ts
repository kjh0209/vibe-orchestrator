export interface RequestAnalysis {
  title: string;
  goal: string;
  inScope: string[];
  outOfScope: string[];
  acceptanceCriteria: string[];
  affectedAreas: string[];
  risks: string[];
  slug: string;
  commitType: 'feat' | 'fix' | 'refactor' | 'docs' | 'chore';
}

export interface GeneratedFile {
  path: string;
  content: string;
  intent: string;
}

export interface CommitGroup {
  message: string;   // Conventional Commits 형식
  files: string[];   // 이 커밋에 포함할 파일 경로들
  intent: string;    // 이 커밋의 변경 의도
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
  commitGroups: CommitGroup[];
  designDecisions: string[];  // ADR 후보가 될 설계 결정들
}

export interface GuardianViolation {
  severity: 'error' | 'warning';
  layer: 'static' | 'llm';   // 어느 계층에서 탐지됐는지
  rule: string;
  file: string;
  description: string;
  suggestion?: string;
}

export interface GuardianReviewResult {
  passed: boolean;
  violations: GuardianViolation[];
  staticChecksPassed: number;
  llmChecksPassed: number;
  summary: string;
}

export interface SessionLog {
  sessionId: string;
  timestamp: string;
  agent: string;
  issueNumber: number;
  goal: string;
  designDecisions: string[];
  files: GeneratedFile[];
  commitMessages: string[];
  unresolvedItems: string[];
}

export interface SSEEvent {
  type:
    | 'analyzing'
    | 'issue_created'
    | 'branch_created'
    | 'generating_code'
    | 'commit_pushed'
    | 'session_log_saved'
    | 'pr_created'
    | 'guardian_reviewing'
    | 'guardian_done'
    | 'done'
    | 'error';
  message?: string;
  // type별 추가 필드
  issueNumber?: number;
  issueUrl?: string;
  issueTitle?: string;
  branchName?: string;
  commitMessage?: string;
  commitSha?: string;
  commitIndex?: number;
  commitTotal?: number;
  sessionLogPath?: string;
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  passed?: boolean;
  violations?: GuardianViolation[];
  violationCount?: number;
  summary?: {
    issueUrl: string;
    prUrl: string;
    commitsCount: number;
    filesChanged: number;
    guardianPassed: boolean;
  };
}
