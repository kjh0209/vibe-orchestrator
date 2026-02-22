'use client';

import { useState } from 'react';

export default function CharterPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    setContent('');
    setUrl('');

    try {
      const response = await fetch('/api/charter/generate', { method: 'POST' });
      const data = (await response.json()) as { success: boolean; content?: string; url?: string; error?: string };

      if (!data.success) {
        setError(data.error ?? '알 수 없는 오류');
        return;
      }

      setContent(data.content ?? '');
      setUrl(data.url ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-white text-sm">← 메인으로</a>
          <span className="text-xl font-bold text-white">⚡ Vibe Orchestrator</span>
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">CHARTER 관리</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">CHARTER 관리</h1>
        <p className="text-gray-400 text-sm mb-6">
          레포지토리 정보를 바탕으로 팀 컨벤션 문서(CHARTER.md)를 자동으로 생성합니다.
        </p>

        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors mb-6"
        >
          {isLoading && (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {isLoading ? 'CHARTER 생성 중...' : 'CHARTER 자동 생성'}
        </button>

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 mb-4 text-sm text-red-400">
            오류: {error}
          </div>
        )}

        {content && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">생성된 CHARTER</h2>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
                >
                  GitHub에서 보기 →
                </a>
              )}
            </div>
            <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 overflow-auto whitespace-pre-wrap max-h-[60vh]">
              {content}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
