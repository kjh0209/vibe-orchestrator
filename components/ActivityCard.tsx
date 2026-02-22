'use client';

import { useEffect, useState } from 'react';
import type { SSEEvent } from '@/lib/orchestrator/types';

interface EventConfig {
  icon: string;
  bgColor: string;
  borderColor: string;
  label: string;
}

const EVENT_CONFIG: Record<SSEEvent['type'], EventConfig> = {
  analyzing: { icon: '🔍', bgColor: 'bg-gray-800', borderColor: 'border-gray-600', label: '분석 중' },
  issue_created: { icon: '📋', bgColor: 'bg-blue-950', borderColor: 'border-blue-700', label: 'Issue 생성됨' },
  branch_created: { icon: '🌿', bgColor: 'bg-green-950', borderColor: 'border-green-700', label: 'Branch 생성됨' },
  generating_code: { icon: '⚙️', bgColor: 'bg-gray-800', borderColor: 'border-gray-600', label: '코드 생성 중' },
  commit_pushed: { icon: '💾', bgColor: 'bg-green-950', borderColor: 'border-green-800', label: 'Commit' },
  session_log_saved: { icon: '📄', bgColor: 'bg-gray-800', borderColor: 'border-gray-600', label: '세션 로그 저장됨' },
  pr_created: { icon: '🔀', bgColor: 'bg-purple-950', borderColor: 'border-purple-700', label: 'PR 생성됨' },
  guardian_reviewing: { icon: '🛡️', bgColor: 'bg-yellow-950', borderColor: 'border-yellow-700', label: 'Guardian 검사 중' },
  guardian_done: { icon: '✅', bgColor: 'bg-green-950', borderColor: 'border-green-700', label: 'Guardian 완료' },
  done: { icon: '🎉', bgColor: 'bg-green-950', borderColor: 'border-green-700', label: '완료!' },
  error: { icon: '❌', bgColor: 'bg-red-950', borderColor: 'border-red-700', label: '오류' },
};

const LOADING_TYPES: SSEEvent['type'][] = ['analyzing', 'generating_code', 'guardian_reviewing'];

interface ActivityCardProps {
  event: SSEEvent;
  timestamp: Date;
}

export default function ActivityCard({ event, timestamp }: ActivityCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const config =
    event.type === 'guardian_done' && !event.passed
      ? { icon: '⚠️', bgColor: 'bg-red-950', borderColor: 'border-red-700', label: 'Guardian 실패' }
      : EVENT_CONFIG[event.type];

  const isLoading = LOADING_TYPES.includes(event.type);

  const timeStr = timestamp.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={`
        border rounded-lg p-3 mb-2 transition-all duration-300 ease-in-out
        ${config.bgColor} ${config.borderColor}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.icon}</span>
          <span className="text-xs font-semibold text-gray-300">{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{timeStr}</span>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      <EventContent event={event} />
    </div>
  );
}

function EventContent({ event }: { event: SSEEvent }) {
  switch (event.type) {
    case 'analyzing':
    case 'generating_code':
    case 'guardian_reviewing':
      return <p className="text-sm text-gray-400">{event.message}</p>;

    case 'issue_created':
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">
            Issue #{event.issueNumber}: {event.issueTitle}
          </span>
          {event.issueUrl && (
            <a
              href={event.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline flex-shrink-0"
            >
              보기 →
            </a>
          )}
        </div>
      );

    case 'branch_created':
      return (
        <p className="text-sm font-mono text-green-400 bg-black/20 px-2 py-1 rounded">
          {event.branchName}
        </p>
      );

    case 'commit_pushed':
      return (
        <div>
          <p className="text-sm text-gray-300 font-mono">{event.commitMessage}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 font-mono">{event.commitSha}</span>
            <span className="text-xs text-gray-500">
              ({event.commitIndex}/{event.commitTotal})
            </span>
          </div>
        </div>
      );

    case 'session_log_saved':
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">세션 로그 저장됨</span>
          {event.sessionLogPath && (
            <a
              href={event.sessionLogPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              보기 →
            </a>
          )}
        </div>
      );

    case 'pr_created':
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">PR #{event.prNumber}: {event.prTitle}</span>
          {event.prUrl && (
            <a
              href={event.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 underline flex-shrink-0"
            >
              보기 →
            </a>
          )}
        </div>
      );

    case 'guardian_done':
      return (
        <div>
          <p className={`text-sm mb-1 ${event.passed ? 'text-green-400' : 'text-red-400'}`}>
            {event.passed ? '모든 검사 통과' : `${event.violationCount}건 위반 발견`}
          </p>
          {event.violations && event.violations.length > 0 && (
            <div className="mt-1 space-y-1">
              {event.violations.slice(0, 3).map((v, i) => (
                <div key={i} className="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded">
                  <span className={v.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                    [{v.severity}]
                  </span>{' '}
                  {v.file}: {v.description}
                </div>
              ))}
              {event.violations.length > 3 && (
                <p className="text-xs text-gray-500">외 {event.violations.length - 3}건 더...</p>
              )}
            </div>
          )}
        </div>
      );

    case 'done':
      return (
        <div className="space-y-2">
          <p className="text-sm text-green-400 font-semibold">오케스트레이션 완료!</p>
          {event.summary && (
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
              <span>커밋: {event.summary.commitsCount}개</span>
              <span>파일: {event.summary.filesChanged}개</span>
              <span>Guardian: {event.summary.guardianPassed ? '✅ 통과' : '⚠️ 위반'}</span>
            </div>
          )}
          {event.summary && (
            <div className="flex gap-2 mt-2">
              <a
                href={event.summary.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
              >
                Issue 보기
              </a>
              <a
                href={event.summary.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
              >
                PR 보기
              </a>
            </div>
          )}
        </div>
      );

    case 'error':
      return <p className="text-sm text-red-400">{event.message}</p>;

    default:
      return null;
  }
}
