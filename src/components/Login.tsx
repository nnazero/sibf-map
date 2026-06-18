import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import styles from './Login.module.css'; // 🔥 CSS Module 임포트

interface LoginProps {
  onLoginSuccess: (nickname: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError('');

    try {
      const userRef = doc(db, 'users', nickname.trim());
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const localUser = sessionStorage.getItem('nickname');
        if (localUser !== nickname.trim()) {
          setError('⚠️ 이미 다른 기기에서 사용 중인 닉네임입니다.');
          setLoading(false);
          return;
        }
        onLoginSuccess(nickname.trim());
      } else {
        await setDoc(userRef, {
          name: nickname.trim(),
          currentBooth: '출입구',
          coordinates: { x: 0, y: 0 },
          updatedAt: new Date().toISOString()
        });

        sessionStorage.setItem('nickname', nickname.trim());
        onLoginSuccess(nickname.trim());
      }
    } catch (err) {
      console.error(err);
      setError('네트워크 오류가 발생했습니다. 오프라인 상태일 수 있습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📚 도서전 비밀 배치도</h2>
      <p className={styles.subtitle}>친구와 공유할 닉네임을 입력하세요.</p>
      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 입력 (예: 영희)"
          disabled={loading}
          className={styles.input}
        />
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? '확인 중...' : '입장하기'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}