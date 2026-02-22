# ⚡ Vibe Orchestrator

바이브 코딩(LLM에게 자연어로 개발을 위임)의 협업 문제를 해결하는 오케스트레이터 레이어입니다.
자연어 요청을 받아 GitHub Issue → Branch → Commit → PR → Guardian Review 플로우를 자동으로 실행합니다.
세션 로그와 Guardian Agent를 통해 의도 휘발, 컨벤션 위반, 책임 소재 불명 문제를 방지합니다.

## 사전 요구사항

- Node.js 18+
- GitHub 계정 및 레포지토리
- OpenAI API 키 ([https://platform.openai.com](https://platform.openai.com))    

## GitHub Personal Access Token 발급

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" 클릭
3. `repo` 권한 전체 체크 (모든 하위 항목 포함)
4. 생성된 토큰 복사 (다시 볼 수 없음)

## 설치 및 실행

```bash
git clone <repo-url>
cd vibe-orchestrator
npm install
cp .env.local.example .env.local
# .env.local 파일을 열어 API 키와 GitHub 정보 입력
npx tsx scripts/setup-demo-repo.ts
npm run dev
# http://localhost:3000 에서 확인
```

## 데모 시나리오

입력창에 다음 예시를 그대로 입력해보세요:

1. `"사용자 인증 유틸리티 추가해줘 (이메일 검증, 비밀번호 해시)"`
2. `"파일 업로드 핸들러 만들어줘 (크기 제한, 확장자 검사)"`
3. `"간단한 캐시 유틸리티 구현해줘 (TTL 지원)"`

## 주요 자동 생성 결과물

요청 입력 후 자동으로 생성되는 순서:

1. **GitHub Issue** — 구조화된 이슈 템플릿으로 자동 생성
2. **Feature Branch** — `vibe/user/{issue}/{slug}` 형식
3. **Atomic Commits** — Conventional Commits 형식, 의미 단위로 분할
4. **Session Log** — `docs/vibe/sessions/` 에 작업 의도/결정 기록
5. **Pull Request** — 요약, 영향 범위, 세션 로그 링크 포함
6. **Guardian Review** — 정적분석 + AI 분석 2계층 코드 리뷰

## 기술 스택

- **프레임워크:** Next.js 14 (App Router, TypeScript strict mode)
- **스타일링:** Tailwind CSS + shadcn/ui
- **AI:** OpenAI SDK (`openai`)
- **GitHub 연동:** Octokit.js
- **실시간 업데이트:** Server-Sent Events (SSE)

## CHARTER 관리

`/charter` 페이지에서 레포 정보를 바탕으로 팀 컨벤션 문서(CHARTER.md)를 자동 생성할 수 있습니다.
생성된 CHARTER는 Guardian Agent가 코드 리뷰 시 기준으로 사용합니다.
