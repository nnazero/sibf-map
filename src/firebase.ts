import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

// 🔥 본인의 Firebase 프로젝트 설정값으로 대체해야 합니다.
// 지금은 틀을 잡기 위해 임시 세팅값으로 변수를 만들어 둡니다.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 2년 전 실패 극복 핵심: 오프라인 캐시를 활성화하여 Firestore 초기화
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});