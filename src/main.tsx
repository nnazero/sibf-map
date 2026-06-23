//main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// tsconfig.app.json 덕분에 여기서 이제 빨간 줄이 안 뜰 겁니다!
import { registerSW } from 'virtual:pwa-register'

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('새로운 버전이 배포되었습니다. 업데이트하시겠습니까?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('👍 도서전 앱이 오프라인 모드로 구동될 준비가 완료되었습니다!');
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)