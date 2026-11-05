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


## 관리자 전용 포털 (v0.5)

- `admin` / `superadmin`은 로그인 직후 `/admin`으로 이동합니다. 학생·교사는 `/dashboard`를 사용합니다.
- 최초 임시 비밀번호 변경이 필요하면 역할에 관계없이 `/dashboard`에서 먼저 변경합니다.
- 관리자 홈: `/admin` (계정 현황/운영 메뉴/최근 작업)
- 계정 발급·비활성화·초기화: `/admin/accounts` (기존 관리자 기능 이동)
- 학생증·교직원증 검증 바로가기: `/admin/verify`
- 모바일에서도 관리자 전용 하단 메뉴가 표시되며 로그아웃은 `내 정보`에서 가능합니다.
- 인증 데이터는 기존 Supabase 인스턴스를 공유하되, 관리자 API는 서버에서 역할을 다시 검증합니다. **별도 배포 서버나 별도 DB로 분리된 것은 아닙니다.**

## 학생 CSV 일괄 등록 (v0.6 · 관리자 전용)

- 관리자 포털 → 계정 관리 → 학생 일괄 등록 (`/admin/accounts/bulk`).
- 명단의 CSV 헤더: `아이디,이름,학년,반,번호` (또는 영문 `username,display_name,grade,class_number,student_number`). 파일 최대 300KB/1,000행.
- 브라우저에서 열 검증·행 내 중복 검증 및 20행 미리보기를 수행하고, **확인 버튼을 누르기 전에는 서버에 데이터를 보내지 않습니다.**
- 서버에서는 관리자 세션·권한을 다시 검사하며, 20명씩 순차 처리합니다. 기존 ID 및 동일 학년·반·번호는 등록하지 않습니다.
- 생성된 학생은 최초 로그인 시 비밀번호 변경 필수. 신규 비밀번호는 성공한 계정에 한해 **한 번 다운로드하는 CSV**로 제공됩니다.
- 등록 실패 계정은 별도 오류 CSV로 내려받을 수 있습니다. 부분 성공을 취소하거나 자동 롤백하지 않으며, 재실행 전 반드시 기존 계정을 검색하세요.
- 추가 기능: `/admin/accounts`에서 이름·ID 및 역할/학년/반 조건으로 **서버 검색**할 수 있습니다. 화면에는 최대 200개 결과가 표시됩니다.
- 개발용 기능이므로 승인받지 않은 실제 학생 정보를 입력하지 마세요. 비밀번호 CSV는 안전한 경로로 개별 전달한 뒤 삭제해야 합니다.

