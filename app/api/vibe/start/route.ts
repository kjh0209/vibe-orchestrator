import { VibeSession } from '@/lib/orchestrator/session';
import { GuardianAgent } from '@/lib/orchestrator/guardian';
import { Charter } from '@/lib/orchestrator/charter';
import type { SSEEvent, SessionLog } from '@/lib/orchestrator/types';

export async function POST(req: Request) {
  const { userRequest } = (await req.json()) as { userRequest: string };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const session = new VibeSession();
        const guardian = new GuardianAgent();

        // 1. 요청 분석
        emit({ type: 'analyzing', message: '요청을 분석하고 있습니다...' });
        const analysis = await session.analyzeRequest(userRequest);

        // 2. 이슈 생성
        const issue = await session.createIssue(analysis);
        emit({
          type: 'issue_created',
          issueNumber: issue.number,
          issueUrl: issue.url,
          issueTitle: analysis.title,
        });

        // 3. 브랜치 생성
        const branchName = await session.createBranch(issue.number, analysis.slug);
        emit({ type: 'branch_created', branchName });

        // 4. 코드 생성
        emit({ type: 'generating_code', message: '코드를 생성하고 있습니다...' });
        const charter = await new Charter().load();
        const codeResult = await session.generateCode(userRequest, charter, analysis);

        // 5. 커밋 (각 커밋마다 이벤트)
        const commits: Array<{ message: string; sha: string }> = [];
        for (let i = 0; i < codeResult.commitGroups.length; i++) {
          const group = codeResult.commitGroups[i];
          const groupFiles = codeResult.files.filter((f) => group.files.includes(f.path));
          const result = await session.pushSingleCommit(groupFiles, group.message, branchName);
          commits.push(result);
          emit({
            type: 'commit_pushed',
            commitMessage: group.message,
            commitSha: result.sha.substring(0, 7),
            commitIndex: i + 1,
            commitTotal: codeResult.commitGroups.length,
          });
        }

        // 6. 세션 로그 저장
        const sessionLog: SessionLog = {
          sessionId: `${Date.now()}-issue${issue.number}`,
          timestamp: new Date().toISOString(),
          agent: 'gpt-4o-mini',
          issueNumber: issue.number,
          goal: analysis.goal,
          designDecisions: codeResult.designDecisions,
          files: codeResult.files,
          commitMessages: commits.map((c) => c.message),
          unresolvedItems: [],
        };
        const sessionLogPath = await session.createSessionLog(sessionLog, branchName);
        emit({ type: 'session_log_saved', sessionLogPath });

        // 7. PR 생성
        const pr = await session.createPR({
          issueNumber: issue.number,
          branchName,
          sessionLogPath,
          analysis,
          codeResult,
          commits,
        });
        emit({
          type: 'pr_created',
          prNumber: pr.number,
          prUrl: pr.url,
          prTitle: `[Vibe] ${analysis.title}`,
        });

        // 8. Guardian 리뷰
        emit({ type: 'guardian_reviewing', message: 'Guardian이 코드를 검사하고 있습니다...' });
        const reviewResult = await guardian.reviewPR(pr.number, codeResult.files, codeResult.commitGroups);
        await guardian.postReviewComment(pr.number, reviewResult);
        emit({
          type: 'guardian_done',
          passed: reviewResult.passed,
          violations: reviewResult.violations,
          violationCount: reviewResult.violations.length,
        });

        // 9. 완료
        emit({
          type: 'done',
          summary: {
            issueUrl: issue.url,
            prUrl: pr.url,
            commitsCount: commits.length,
            filesChanged: codeResult.files.length,
            guardianPassed: reviewResult.passed,
          },
        });
      } catch (error) {
        emit({
          type: 'error',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
