import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import { db } from './firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import styles from './App.module.css'; // 🔥 CSS Module 임포트

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const savedNickname = sessionStorage.getItem('nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  const handleLoginSuccess = (name: string) => {
    setNickname(name);
  };

  const handleResetData = async () => {
    if (!nickname) return;
    
    if (confirm('닉네임을 삭제하고 모든 데이터를 초기화하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'users', nickname));
        sessionStorage.clear();
        setNickname(null);
        alert('초기화가 완료되었습니다.');
      } catch (err) {
        console.error(err);
        alert('초기화 중 오류가 발생했습니다.');
      }
    }
  };

  if (!nickname) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <span className={styles.nickname}>👤 닉네임: <strong>{nickname}</strong></span>
        <button onClick={handleResetData} className={styles.resetButton}>
          데이터 초기화🗑️
        </button>
      </header>

      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <h3>🚪 출입구별 부스</h3>
          <p style={{ fontSize: '14px', color: '#666' }}>여기에 출입구 리스트가 들어설 예정입니다.</p>
        </aside>

        <main className={styles.mapArea}>
          <div className={styles.placeholderText}>
            <h2>🗺️ 도서전 실시간 지도 구역</h2>
            <p>여기에 배치도 이미지와 실시간 위치 핀이 표시됩니다.</p>
          </div>
        </main>
      </div>
    </div>
  );
}