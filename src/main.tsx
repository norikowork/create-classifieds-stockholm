import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import auth from '@/lib/shared/kliv-auth';

// テスト用: window.auth を公開（完全削除テスト用）
// 注意: 本番環境では無効にすることを推奨
if (typeof window !== 'undefined') {
  (window as any).auth = auth;
}

createRoot(document.getElementById("root")!).render(<App />);
