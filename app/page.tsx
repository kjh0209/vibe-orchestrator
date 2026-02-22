'use client';

import { useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import ActivityFeed from '@/components/ActivityFeed';
import type { SSEEvent } from '@/lib/orchestrator/types';
import Link from 'next/link';

interface EventWithTimestamp {
  event: SSEEvent;
  timestamp: Date;
  id: string;
}

export default function Home() {
  const [events, setEvents] = useState<EventWithTimestamp[]>([]);

  const handleEvent = (event: SSEEvent) => {
    setEvents((prev) => [
      ...prev,
      {
        event,
        timestamp: new Date(),
        id: `${Date.now()}-${Math.random()}`,
      },
    ]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-white">⚡ Vibe Orchestrator</span>
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">Demo</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/charter"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            CHARTER 관리
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            {process.env.NEXT_PUBLIC_GITHUB_REPO ?? 'vibe-orchestrator-demo'}
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠: 좌우 분할 */}
      <main className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r border-gray-800 overflow-hidden">
          <ChatPanel onEvent={handleEvent} />
        </div>
        <div className="w-1/2 overflow-hidden">
          <ActivityFeed events={events} />
        </div>
      </main>
    </div>
  );
}
