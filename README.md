# 계성 스마트 · Keisung App (MVP v0.4.1)

학교생활 통합 PWA의 **개발용 MVP**입니다. 학교의 공식 서비스·공식 학생증이 아닙니다. 학교의 사전 승인과 개인정보·보안 점검 없이 실제 학생 계정을 운영하지 마세요.

## 완성된 MVP 범위

- 자체 발급 ID / 비밀번호 로그인, 첫 로그인 비밀번호 변경, 내 정보 및 비밀번호 변경
- 학생·교사·관리자·시스템 관리자 역할 구분
- 계정 발급, 비활성/재활성, 비밀번호 초기화, 관리자 감사 로그
- 공지사항 조회(전체/대상별), 교사·관리자 작성/수정/삭제, 고정·공개 상태
- 급식·학사일정 NEIS 공식 OpenAPI 서버 조회
- 별도 우산 대여 시스템 HTTPS URL 연동
- 모바일 반응형 대시보드, PWA manifest, 상태 확인 API

학생증과 교직원증은 각각 **개발 테스트용 1회용 QR**을 제공하며, 공식 신분증은 아닙니다. 기본적으로 비활성화됩니다. 교직원증 설정: [docs/STAFF-ID.md](docs/STAFF-ID.md).

## 처음 설치

```bash
git clone https://github.com/Lee-sangyul/keisung-app.git
cd keisung-app
npm install
cp .env.example .env.local
npm run dev
```

Supabase 프로젝트와 연동하려면 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 설정합니다. 마지막 키는 서버 전용입니다. 절대 저장소에 올리거나 `NEXT_PUBLIC_`을 붙이지 마세요.

Supabase SQL Editor에서 `supabase/schema.sql` → `supabase/mvp.sql` 순서로 실행합니다. **기존 관리자 계정은 삭제하거나 다시 만들지 않습니다.** 관리자 계정이 없는 새 프로젝트만 기존 README의 bootstrap 절차를 참고하세요.

관리자 로그인 뒤 `/admin`에서 계정을 발급하고 `/announcements`에서 공지를 관리합니다. 대시보드 → 내 정보에서 본인 비밀번호를 변경할 수 있습니다.

학교 정보는 `NEIS_API_KEY`, `NEIS_ATPT_CODE`, `NEIS_SCHOOL_CODE`를 지정합니다. 우산 대여는 `NEXT_PUBLIC_UMBRELLA_URL`에 **실제 HTTPS 배포 URL**을 입력합니다. 값이 없거나 API 오류가 발생하면 임의 데이터를 보여주지 않습니다.

## 기존 v0.2에서 업데이트

```bash
git pull
npm install
```

Supabase SQL Editor에서 `supabase/mvp.sql` 실행 후 `npm run dev`로 재시작하세요. 기존 `profiles` 테이블과 사용자 계정은 유지됩니다.

## 보안 및 운영상 제한

- 앱은 관리자 발급 계정만 사용합니다. 공개 회원가입은 Supabase Auth 설정에서도 꺼야 합니다.
- API는 서버에서 토큰·프로필·역할·계정 중지 여부를 확인합니다. 클라이언트 권한은 UI 용도입니다.
- 민감한 비밀번호와 service role 키는 DB 로그·GitHub에 저장하면 안 됩니다.
- 감사 로그는 관리자 계정 발급/상태 변경/초기화에 적용되며, 공지 작성의 별도 감사 이벤트는 이번 MVP 범위 밖입니다.
- 실제 학교 운영 전 **인증 요청 제한, MFA, 개인정보 동의/보존정책, 모니터링, 백업, 침투 테스트, HTTPS 배포, 역할별 접근 테스트**가 필요합니다.
- 로컬 빌드와 실계정 통합 테스트는 이 커밋에서 보장되지 않습니다. 운영 전에 반드시 직접 검증하세요.
