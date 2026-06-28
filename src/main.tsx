import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// authオブジェクトをwindowに追加（ブラウザコンソールでの実行用）
import auth from '@/lib/shared/kliv-auth';
if (typeof window !== 'undefined') {
  (window as any).auth = auth;
}

createRoot(document.getElementById("root")!).render(<App />);
