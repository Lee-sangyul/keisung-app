# 계성 스마트 · Keisung App

**비공식 개발 프로젝트** · Next.js 15 / React 19 / TypeScript / Supabase / PWA

학교생활 통합 웹앱의 실행 가능한 MVP입니다. **학교의 공식 서비스 또는 공식 학생증이 아니며**, 학교 승인과 개인정보 보호 검토 전 실제 학생 데이터를 투입하거나 공개 운영하지 마세요.

## 현재 기능

- 자체 발급 ID + 비밀번호 로그인 (Google Workspace와 독립)
- 학생 / 교사 / 관리자 / 시스템 관리자 역할 구분
- 관리자가 학생·교사 계정을 발급하고 임시 비밀번호를 **1회 표시**
- 첫 로그인 비밀번호 변경, 인증 없는 회원가입 차단
- 학교생활 대시보드, 나이스 OpenAPI 급식·학사일정(서버 프록시)
- 별도 우산 대여 시스템을 URL로 연결
- PWA manifest, 모바일 반응형 UI

## 빠른 시작

```bash
npm install
cp .env.example .env.local
npm run dev
```

1. [Supabase](https://supabase.com) 프로젝트 생성 후 `supabase/schema.sql`을 SQL Editor에서 실행합니다.
2. `.env.local`의 URL, anon key, 서버 전용 service role key를 설정합니다. **service role key는 절대로 NEXT_PUBLIC_ 접두사를 붙이지 마세요.**
3. Supabase Auth에서 Email 제공자를 활성화하되 **공개 가입은 비활성화**합니다. 임시 비밀번호 전달 및 초기화는 관리자만 수행합니다.
4. 최초 시스템 관리자만 Supabase 관리자 UI에서 사용자 이메일 `admin@login.keisung-app.example`을 생성하고, SQL 파일 하단의 주석에 있는 bootstrap insert를 **실제 UUID로 바꿔 수동 실행**합니다. 즉시 비밀번호를 변경하세요.
5. 관리자 로그인 후 `/admin`에서 일반 사용자 계정을 발급합니다.

**주의:** `@login.keisung-app.example`은 내부 인증용 가상 이메일이며 실제 메일 수신이 불가능합니다. 따라서 이메일을 통한 비밀번호 찾기는 작동하지 않습니다. 잊어버린 비밀번호의 관리자 초기화, 계정 정지, 감사 로그, 레이트 리미팅, 운영 모니터링은 추후 구현이 필요합니다. 현재 MVP에서는 발급 후 비밀번호 분실 시 Supabase 관리 UI를 통한 관리자의 수동 조치가 필요합니다. 계정을 실제 배포하기 전에 이 기능과 추가 보안을 반드시 구축해야 합니다.

## 학교 정보 연동

[나이스 교육정보 개방 포털](https://open.neis.go.kr/)의 API 키와 정확한 관할 교육청 코드 및 학교 코드를 설정하면 급식(중식)과 향후 14일의 학사일정을 표시합니다. 미설정·오류 때는 **실제 데이터인 척 임의 데이터를 표시하지 않습니다.** NEIS 제공일 및 학교 등록 데이터에 따라 결과가 없을 수 있습니다.

`NEXT_PUBLIC_UMBRELLA_URL`에는 별도 [우산 대여 저장소](https://github.com/Lee-sangyul/keisung-umbrella)의 **실제 HTTPS 배포 주소**를 넣습니다. 저장소 주소 자체는 서비스 URL이 아닙니다.

## 미구현 / 운영 전에 필수

- 학교의 공식 승인 및 학생 개인정보 처리 영향 검토
- 계정 발급 감사 로그, 계정 중지, 비밀번호 관리 기능, 계정 발급 제한·2차 인증
- 관리자 역할 제한 및 계정 목록 정보 최소화, NEIS API와 시간대 점검
- 학생증: 학교 인증·승인 체계 마련 전 **공식 학생증이나 유효한 QR을 제공하지 않음**
- 알림: 사용자 동의/인증 체계 이후 추가

## 개발 명령

```bash
npm run dev
npm run build
```

라이선스는 별도 결정 전까지 지정하지 않았습니다.
