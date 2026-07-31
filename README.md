# HINANA STUDIO ECO

HINANA STUDIO ECO는 HINANA STUDIO의 데스크톱 앱 구조를 기반으로 개발하는 멀티트랙 오디오 편집기입니다. GoldWave의 빠른 파형 편집과 Cubase 계열의 트랙·믹서 작업 흐름을 가볍게 결합하는 것을 목표로 합니다.

개발·제작 및 저작권: **비나래**

## 주요 기능

- WAV, MP3, M4A, AAC, OGG, FLAC, OPUS, AIFF 가져오기
- 실제 오디오 데이터 기반 파형 표시
- 파일별 트랙 자동 생성과 비파괴 클립 이동·분할·트림
- 다중 선택, 복사·붙여넣기·복제, 리플 삭제
- 재생 헤드 스크러빙, 구간 반복, 재생 속도와 메트로놈
- 마이크 녹음과 녹음 파일 프로젝트 포함
- 트랙 GAIN, PAN, MUTE, SOLO 실시간 적용
- 3밴드 EQ, 컴프레서, 딜레이, 리버브 트랙 효과 체인
- 재생 헤드 기반 볼륨·팬 자동화 지점
- 클립 볼륨, 페이드 인·아웃과 마스터 출력 조절
- 실제 출력 신호 기반 마스터 레벨 미터
- 실행 취소와 다시 실행
- 스테레오 WAV 및 128·192·256·320 kbps MP3 믹스 내보내기
- 원본 오디오를 포함하는 단일 `.heco` 프로젝트 패키지
- 자동 저장·복구, 최근 프로젝트, 미디어 재연결과 수동 백업

## 휴대 가능한 프로젝트 패키지

`.heco` 파일에는 다음 내용이 함께 저장됩니다.

- 프로젝트와 트랙·클립 편집 정보
- 사용한 원본 오디오 파일
- 앱 버전과 패키지 형식 정보

같은 원본을 여러 클립에서 사용하거나 여러 번 자른 경우 오디오 데이터는 한 번만 포함됩니다. 따라서 `.heco` 파일 하나를 다른 컴퓨터나 운영체제로 옮겨 프로젝트를 열 수 있습니다. 이전 버전에서 만든 경로 참조형 `.heco` 파일도 계속 열 수 있습니다.

## 개발 실행

Node.js 22 이상을 권장합니다.

```bash
npm ci
npm run dev
```

일반 빌드와 프로젝트 패키지 왕복 검증:

```bash
npm run build
npm run test:package
npm run test:mp3
```

## 데스크톱 배포

Windows x64:

```powershell
npm run dist:win
```

macOS Intel 및 Apple Silicon:

```bash
npm run dist:mac
```

아키텍처별 macOS 빌드:

```bash
npm run dist:mac:x64
npm run dist:mac:arm64
```

Linux x64 및 ARM64:

```bash
npm run dist:linux
```

결과물은 `release/`에 생성됩니다.

- Windows: NSIS `.exe`
- macOS: `.dmg`, `.zip`
- Linux: `.AppImage`, `.deb`

`.github/workflows/build-desktop.yml`은 태그 푸시 또는 수동 실행 시 Windows, macOS, Linux 러너에서 실제 설치 파일을 각각 생성합니다. macOS 배포 파일은 macOS 환경에서 빌드해야 하며, 공개 배포에서 경고 없이 실행하려면 Apple Developer ID 서명과 공증 설정이 추가로 필요합니다.

## 단축키

- `Space`: 재생·정지
- `S`: 선택 클립을 재생 헤드에서 분할
- `R`: 마이크 녹음 시작·종료
- `L`: 구간 반복 켜기·끄기
- `Delete`: 선택 클립 또는 트랙 삭제
- `Shift + Delete`: 선택 클립 리플 삭제
- `Esc`: 자르기 도구 또는 정보창 닫기
- `Ctrl/Cmd + Z`: 실행 취소
- `Ctrl/Cmd + Shift + Z`: 다시 실행
- `Ctrl/Cmd + C`: 선택 클립 복사
- `Ctrl/Cmd + V`: 재생 헤드에 붙여넣기
- `Ctrl/Cmd + D`: 선택 클립 복제
- `Ctrl/Cmd + I`: 오디오 가져오기
- `Ctrl/Cmd + E`: WAV 내보내기

## 라이선스와 저작권

Copyright © 2026 비나래. All rights reserved.

HINANA STUDIO ECO는 오픈 소스가 아닌 독점 소프트웨어입니다. 공식 무수정
바이너리는 합법적인 개인·상업 오디오 제작에 무료로 사용할 수 있으며,
프로그램으로 만든 오디오와 프로젝트 결과물의 권리는 사용자에게 있습니다.
소스 코드와 바이너리의 수정·재배포·리브랜딩·상업 서비스 제공 권한은 별도로
허가되지 않습니다.

전체 조건은 [LICENSE](LICENSE)를 확인하세요.
