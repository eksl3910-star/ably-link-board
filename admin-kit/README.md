# Admin Kit (Next.js App Router + Firestore Admin SDK)

이 폴더는 **다른 프로젝트로 그대로 복사**해서 관리자 점검 토글(maintenance mode)을 빠르게 붙일 수 있는 “킷”입니다.

## 포함 파일

- `lib/firebase-admin.ts`: Firebase Admin SDK 초기화 유틸 (서비스계정/ADC 지원)
- `app/api/admin/maintenance/route.ts`: 관리자 비밀번호 검증 후 `settings/global` 갱신 API
- `middleware.ts`: Basic Auth로 `/admin` 및 `/api/admin/*` 보호 (Edge 런타임 호환)
- `app/admin/page.tsx`: 간단한 관리자 UI (토글 버튼 + 비밀번호 입력)
- `firestore.rules`: 최소 규칙 예시 (클라이언트에서 settings 쓰기 차단)
- `.env.example`: 필요한 환경변수 목록

## 적용 방법(권장 순서)

1) 이 `admin-kit/` 안의 파일들을 **프로젝트 루트 기준 동일 경로**로 복사하세요.

- `admin-kit/lib/firebase-admin.ts` → `<your-app>/lib/firebase-admin.ts`
- `admin-kit/app/api/admin/maintenance/route.ts` → `<your-app>/app/api/admin/maintenance/route.ts`
- `admin-kit/app/admin/page.tsx` → `<your-app>/app/admin/page.tsx`
- `admin-kit/middleware.ts` → `<your-app>/middleware.ts` (기존 middleware가 있으면 내용 병합)
- `admin-kit/firestore.rules` → `<your-app>/firestore.rules` (원하는 규칙에 맞게 조정)

2) 의존성 설치

```bash
npm i firebase-admin
```

3) 환경변수 설정 (Vercel Project Settings → Environment Variables)

`.env.example`을 참고해서 아래 값을 추가하세요.

4) `/admin` 접속 확인

- `/admin` 접속 시 브라우저 Basic Auth 팝업이 떠야 합니다.
- 로그인 후, 비밀번호 입력 → “서버 전체 중단/해제” 버튼으로 토글되는지 확인하세요.

## 데이터 구조

Firestore 문서:

- `settings/global`
  - `isMaintenance: boolean`
  - `updatedAt: number`

## 주의

- 이 킷은 **클라이언트에서 Firestore settings 쓰기**를 막고, **서버(Admin SDK)** 로만 변경하게 합니다.
- 서비스 계정 키는 절대 레포에 커밋하지 말고, 환경변수로만 넣으세요.

