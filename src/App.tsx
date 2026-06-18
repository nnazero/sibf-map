import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import MapArea from './components/MapArea';
import styles from './App.module.css';

interface Booth {
  id: string;
  name: string;
  gate: string;
  category: string;
  location: { x: number; y: number };
  description: string;
}

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null); // 선택된 부스 상태

  useEffect(() => {
    const savedNickname = sessionStorage.getItem('nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  const handleLoginSuccess = (name: string) => {
    setNickname(name);
  };

  const handleResetData = () => {
    if (!nickname) return;
    
    if (confirm('닉네임을 삭제하고 모든 데이터를 초기화하시겠습니까?')) {
      sessionStorage.clear();
      setNickname(null);
      setSelectedBooth(null);
      alert('초기화가 완료되었습니다.');
    }
  };

  // 사이드바에서 부스를 클릭했을 때 실행될 함수
  const handleBoothSelect = (booth: Booth) => {
    setSelectedBooth(booth);
    console.log("선택된 부스 좌표:", booth.location);
    // TODO: 나중에 지도 컴포넌트가 완성되면 이 좌표로 지도를 움직이게 됩니다.
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
        <Sidebar onBoothSelect={handleBoothSelect} />

        {/* 🔥 기존 <main> 구역을 지우고 MapArea로 대체합니다 */}
        <main style={{ flex: 1, position: 'relative' }}>
          <MapArea selectedBooth={selectedBooth} />
        </main>
      </div>
    </div>
  );
}