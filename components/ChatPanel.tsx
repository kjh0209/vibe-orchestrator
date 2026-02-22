'use client';

import { useState, useRef, useEffect } from 'react';
import type { SSEEvent } from '@/lib/orchestrator/types';

const EXAMPLE_REQUESTS = [
  '사용자 인증 모듈 추가해줘 (이메일/비밀번호)',
  '결제 처리 유틸리티 함수 만들어줘',
  '파일 업로드 핸들러 구현해줘',
];

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'summary';
  content: string;
  summary?: {
    issueUrl: string;
    prUrl: string;
    commitsCount: number;
    filesChanged: number;
    guardianPassed: boolean;
  };
}

interface ChatPanelProps {
  onEvent: (event: SSEEvent) => void;
}

export default function ChatPanel({ onEvent }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }]);
  };

  const handleSubmit = async (inputText: string) => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    setInput('');
    addMessage({ role: 'user', content: inputText });

    try {
      const response = await fetch('/api/vibe/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRequest: inputText }),
      });

      if (!response.body) throw new Error('응답 스트림을 읽을 수 없습니다');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              onEvent(event);

              if (event.type === 'done' && event.summary) {
                addMessage({
                  role: 'summary',
                  content: '오케스트레이션이 완료되었습니다!',
                  summary: event.summary,
                });
                setIsLoading(false);
              }
              if (event.type === 'error') {
                addMessage({ role: 'assistant', content: `오류: ${event.message}` });
                setIsLoading(false);
              }
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: `오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      });
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">무엇을 만들고 싶나요?</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          자연어로 설명하면 GitHub 플로우가 자동으로 실행됩니다
        </p>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">⚡</div>
            <p className="text-gray-400 text-sm mb-4">예시 요청으로 시작해보세요</p>
            <div className="space-y-2 w-full max-w-sm">
              {EXAMPLE_REQUESTS.map((req) => (
                <button
                  key={req}
                  onClick={() => setInput(req)}
                  className="w-full text-left text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
                >
                  {req}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
            <span>GitHub 플로우 실행 중...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="자연어로 개발 요청을 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={3}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors self-end"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-blue-600 text-white text-sm px-3 py-2 rounded-lg rounded-tr-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'summary' && message.summary) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] bg-gray-800 text-gray-300 text-sm px-3 py-2 rounded-lg rounded-tl-sm">
          <p className="font-semibold text-green-400 mb-2">✅ {message.content}</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-400 mb-2">
            <span>커밋: {message.summary.commitsCount}개</span>
            <span>파일: {message.summary.filesChanged}개</span>
            <span>Guardian: {message.summary.guardianPassed ? '통과' : '위반'}</span>
          </div>
          <div className="flex gap-2">
            <a
              href={message.summary.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
            >
              Issue 보기
            </a>
            <a
              href={message.summary.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
            >
              PR 보기
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-gray-800 text-gray-300 text-sm px-3 py-2 rounded-lg rounded-tl-sm">
        {message.content}
      </div>
    </div>
  );
}
