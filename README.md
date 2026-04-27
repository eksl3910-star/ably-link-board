# 에이블리 링크 보드 클론

Next.js(App Router) + Tailwind CSS + Firebase(Firestore)로 만든 클론 프로젝트입니다.

## 0) 먼저 알아두기

- 이 채팅에서 제가 이미 파일을 직접 생성했기 때문에, 지금은 **[Apply] 버튼을 누를 필요가 없습니다.**
- 이제 해야 할 일은 터미널 명령어 입력과 Firebase 콘솔 설정입니다.

## 1) 터미널 열기

Cursor 아래쪽 터미널에서 현재 폴더가 `link-board-clone`인지 확인하세요.

## 2) 패키지 설치

아래 명령어를 입력하고 엔터:

```bash
npm install
```

## 3) 개발 서버 실행

아래 명령어를 입력하고 엔터:

```bash
npm run dev
```

브라우저에서:

- [http://localhost:3000](http://localhost:3000)

## 4) Firebase Firestore 켜기 (아주 중요)

1. Firebase 콘솔에서 프로젝트 `link-clone-c2dc5` 열기
2. 왼쪽 메뉴에서 **Firestore Database** 클릭
3. **데이터베이스 만들기** 클릭
4. 테스트 모드로 시작
5. 지역 선택 후 생성

## 5) Firestore Rules 적용 (개발용)

`firestore.rules` 파일 내용으로 Rules 탭에 붙여넣고 Publish 하세요.

> 현재 Rules는 빠른 개발 확인용으로 전체 허용입니다. 배포 전에는 꼭 보안 규칙을 강화해야 합니다.

## 핵심 구현 기능

- 닉네임 입력 화면 + 중복 닉네임 체크 (`users` 컬렉션)
- 메인 화면 실시간 대기 개수 (`links` 컬렉션 실시간 구독)
- 링크 등록 시 서버에서 제목/이미지 메타데이터 추출
- `다음 링크 받기` 버튼 클릭 시 대기 링크 중 랜덤 1개 제공
