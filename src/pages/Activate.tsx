import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import db from '@/lib/shared/kliv-database';
import { toast } from 'sonner';

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const activateAccount = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('トークンが見つかりません。メール内のリンクを確認してください。');
        return;
      }

      try {
        // データベースからトークン情報を取得
        const tokenData = await db.query('activation_tokens', {
          token: `eq.${token}`
        });

        if (!tokenData || tokenData.length === 0) {
          setStatus('error');
          setMessage('トークンが見つかりません。再度新規登録をお願いします。');
          return;
        }

        const activationRecord = tokenData[0];
        const { email, password, name, expires_at } = activationRecord;

        // トークンの有効期限を確認
        const now = Math.floor(Date.now() / 1000);
        if (expires_at < now) {
          setStatus('error');
          setMessage('トークンの有効期限が切れています。再度新規登録をお願いします。');
          return;
        }

        // ユーザーを作成（auth.signUpを使用）
        const auth = (await import('@/lib/shared/kliv-auth')).default;
        await auth.signUp(email, password, name);

        // 使用したトークンを削除
        await db.delete('activation_tokens', {
          token: `eq.${token}`
        });

        setStatus('success');
        setMessage('アカウントが有効化されました！ログインしてください。');
        
        toast({
          title: "登録完了",
          description: "アカウントが有効化されました！ログインしてください。",
        });
        
        // 5秒後にログインページへ
        setTimeout(() => {
          navigate('/');
        }, 5000);
        
      } catch (error: any) {
        console.error('Activation error:', error);
        setStatus('error');
        setMessage(error.message || 'アカウントの有効化に失敗しました。');
      }
    };

    activateAccount();
  }, [searchParams, navigate]);

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
              <CardTitle className="text-2xl">アカウント有効化中...</CardTitle>
              <CardDescription>
                ただいま処理中です
              </CardDescription>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <CardTitle className="text-2xl">登録完了！</CardTitle>
              <CardDescription>
                {message}
              </CardDescription>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <CardTitle className="text-2xl">エラー</CardTitle>
              <CardDescription>
                {message}
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        {status !== 'loading' && (
          <CardContent>
            {status === 'success' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  3秒後にログインページへ移動します...
                </p>
                <Button onClick={handleGoHome} className="w-full">
                  今すぐログイン
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button onClick={handleGoHome} className="w-full">
                  ホームに戻る
                </Button>
                <p className="text-sm text-gray-600 text-center">
                  トークンの有効期限は24時間です。期限が切れている場合は、再度新規登録をお願いします。
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
