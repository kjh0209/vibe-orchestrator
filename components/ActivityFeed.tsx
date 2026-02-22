'use client';

import { useEffect, useRef } from 'react';
import type { SSEEvent } from '@/lib/orchestrator/types';
import ActivityCard from './ActivityCard';

interface EventWithTimestamp {
  event: SSEEvent;
  timestamp: Date;
  id: string;
}

interface ActivityFeedProps {
  events: EventWithTimestamp[];
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">GitHub Activity Feed</h2>
        <p className="text-xs text-gray-500 mt-0.5">실시간으로 GitHub 이벤트가 표시됩니다</p>
      </div>

      {/* 이벤트 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">📡</div>
            <p className="text-gray-500 text-sm">아직 활동이 없습니다</p>
            <p className="text-gray-600 text-xs mt-1">좌측에서 요청을 입력하면 여기에 실시간으로 표시됩니다</p>
          </div>
        ) : (
          <>
            {events.map(({ event, timestamp, id }) => (
              <ActivityCard key={id} event={event} timestamp={timestamp} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
