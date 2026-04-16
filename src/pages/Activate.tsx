import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import auth from '@/lib/shared/kliv-auth';
import { toast } from 'sonner';

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const activateAccount = async () => {
      const token = searchParams.get('token');
      
      console.log('🔍 Activation page loaded');
      console.log('🔍 Token:', token);
      
      if (!token) {
        setStatus('error');
        setMessage('トークンが見つかりません。メール内のリンクを確認してください。');
        setDebugInfo('No token parameter found in URL');
        console.error('❌ No token found');
        return;
      }

      try {
        console.log('📧 Getting activation info...');
        setDebugInfo('トークン情報を取得中...');
        
        // アクティベーション情報を取得
        const activationInfo = await auth.getActivationInfo(token);
        
        console.log('✅ Activation info received:', activationInfo);
        setDebugInfo(`ユーザー: ${activationInfo.email}, パスワード必須: ${activationInfo.requiresPassword}`);
        
        // パスワード設定が不要か確認
        if (!activationInfo.requiresPassword) {
          console.log('🚀 Activating account...');
          setDebugInfo('アカウントを有効化中...');
          
          // アカウントをアクティベート
          const user = await auth.activate(token);
          
          console.log('✅ Account activated successfully:', user);
          setDebugInfo('アカウント有効化完了！');
          
          setStatus('success');
          setMessage('アカウントが有効化されました！ログインしてください。');
          
          toast.success('登録完了', {
            description: 'アカウントが有効化されました！ログインしてください。',
          });
          
          // 5秒後にログインページへ
          setTimeout(() => {
            console.log('🏠 Redirecting to home...');
            navigate('/');
          }, 5000);
        } else {
          console.warn('⚠️ Password required for activation');
          setStatus('error');
          setMessage('このリンクは無効です。再度新規登録をお願いします。');
          setDebugInfo('パスワード設定が必要なトークンです');
          return;
        }
        
      } catch (error: any) {
        console.error('❌ Activation error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        setStatus('error');
        
        // エラーメッセージを整形
        let errorMessage = error.message || 'アカウントの有効化に失敗しました。';
        
        // わかりやすいエラーメッセージに変換
        if (errorMessage.includes('invalid_token')) {
          errorMessage = 'トークンが無効です。有効期限が切れている可能性があります。再度新規登録をお願いします。';
        } else if (errorMessage.includes('template_not_configured')) {
          errorMessage = 'メールテンプレートが設定されていません。管理者にお問い合わせください。';
        } else if (errorMessage.includes('email_rate_limit_exceeded')) {
          errorMessage = 'メール送信回数の上限を超えました。しばらくしてから再度お試しください。';
        }
        
        setMessage(errorMessage);
        setDebugInfo(`エラー: ${error.message}`);
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
              {debugInfo && (
                <p className="text-xs text-gray-500 mt-2">{debugInfo}</p>
              )}
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <CardTitle className="text-2xl">登録完了！</CardTitle>
              <CardDescription>
                {message}
              </CardDescription>
              {debugInfo && (
                <p className="text-xs text-gray-500 mt-2">{debugInfo}</p>
              )}
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <CardTitle className="text-2xl">エラー</CardTitle>
              <CardDescription className="whitespace-pre-wrap">
                {message}
              </CardDescription>
              {debugInfo && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-xs text-red-700 font-mono">{debugInfo}</p>
                </div>
              )}
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
