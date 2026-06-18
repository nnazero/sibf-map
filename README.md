# 📚 서울국제도서전 비밀 배치도 (SIBF-MAP)

> **오프라인 구동 및 친구 간 실시간 위치 공유가 가능한 로컬 퍼스트(Local-First) 도서전 가이드 웹 앱**

코엑스 전시실 내부처럼 사람이 극도로 몰려 **와이파이 및 5G/LTE 네트워크가 마비되는 상황**에서도 버벅거림 없이 완벽하게 작동하는 독립형 PWA(Progressive Web App) 지도 앱입니다. 

---

## ✨ 핵심 기능

1. **오프라인 렌더링 (PWA Engine)**
   - `vite-plugin-pwa`와 서비스 워커(Service Worker)를 활용하여 대용량 배치도 이미지 및 부스 정적 데이터를 브라우저 내장 메모리에 강제 캐싱합니다. 인터넷이 완전히 차단되어도 앱이 0초 만에 로딩됩니다.
2. **출입구별 부스 필터링 및 서치**
   - 도서전 데이터를 출입구(Gate) 단위로 쪼개어 정렬하고, 리스트에서 부스 선택 시 통합 지도의 해당 좌표로 부드럽게 스크롤 및 포커싱됩니다.
3. **휘발성 세션 기반 닉네임 통제 체계**
   - `sessionStorage`와 Firebase Firestore를 결합하여 중복 가입을 방지하고 동시접속을 차단합니다. 탭을 닫으면 데이터가 날아가는 휘발성 구조이며, 동일 기기 재접속 시 일관된 상태가 유지됩니다.
4. **실시간 위치 트래킹 및 데이터 초기화**
   - 지도 위 부스 터치를 통해 내 위치를 갱신하고, 네트워크가 연결되는 순간 배경에서 친구들과 실시간 위치를 동기화합니다. `데이터 초기화` 버튼 클릭 시 DB 및 로컬 스토리지를 완전히 삭제하고 방출합니다.

---

## 🛠️ 기술 스택

- **Front-end**: React 18, TypeScript, Vite 5
- **Styling**: CSS Modules (컴포넌트 단위 스타일 격리)
- **Database / Sync**: Firebase Firestore (Persistent Local Cache 활성화)
- **PWA Service Worker**: Workbox (`vite-plugin-pwa`)

---

## 📂 폴더 구조

```text
sibf-map/
├── public/                # PWA 아이콘 자산 및 배치도 원본 이미지 (map.png)
├── src/
│   ├── assets/            # CSS 공통 자산
│   ├── components/        # 로그인 및 화면 UI 독립 컴포넌트
│   │   ├── Login.tsx
│   │   └── Login.module.css
│   ├── data/              # 도서전 오프라인 데이터베이스
│   │   └── booths.json
│   ├── App.tsx            # 메인 레이아웃 및 최상위 데이터 제어 소스
│   ├── App.module.css
│   ├── firebase.ts        # Firestore 로컬 캐시 활성화 설정 파일
│   └── main.tsx           # PWA 서비스 워커 등록 스크립트
├── tsconfig.app.json      # PWA 가상 모듈 클라이언트 타입 바인딩
└── vite.config.ts         # Workbox 대용량 파일(10MB) 캐싱 전략 설정