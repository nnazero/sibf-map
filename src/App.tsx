import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar'; // 🔥 사이드바 임포트
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
        {/* 🔥 조립: 부스 선택 시 실행할 함수를 props로 넘겨줍니다 */}
        <Sidebar onBoothSelect={handleBoothSelect} />

        <main className={styles.mapArea}>
          <div className={styles.placeholderText}>
            <h2>🗺️ 도서전 실시간 지도 구역</h2>
            {selectedBooth ? (
              <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3>📍 {selectedBooth.name}</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>분류: {selectedBooth.category}</p>
                <p style={{ color: '#444', fontWeight: 'bold' }}>위치 좌표: X({selectedBooth.location.x}), Y({selectedBooth.location.y})</p>
                {selectedBooth.description && <p style={{ fontStyle: 'italic', color: '#888' }}>"{selectedBooth.description}"</p>}
              </div>
            ) : (
              <p>왼쪽 리스트에서 부스를 선택하면 좌표 정보가 여기에 표시됩니다.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}