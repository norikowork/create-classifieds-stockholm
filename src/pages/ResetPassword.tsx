import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import auth from '@/lib/shared/kliv-auth';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    
    if (!resetToken) {
      setStatus('error');
      setMessage('リセットトークンが見つかりません。メール内のリンクを確認してください。');
      return;
    }
    
    setToken(resetToken);
    setStatus('form'); // フォームを表示
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    if (newPassword !== confirmPassword) {
      setMessage('パスワードが一致しません');
      setIsSubmitting(false);
      return;
    }

    if (newPassword.length < 8) {
      setMessage('パスワードは最低8文字以上で入力してください');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('🔄 Completing password reset...');
      setStatus('loading');
      
      // パスワードリセット完了
      await auth.completePasswordReset(token, newPassword);
      
      console.log('✅ Password reset completed successfully');
      setStatus('success');
      setMessage('パスワードがリセットされました！新しいパスワードでログインしてください。');
      
      toast.success('パスワードリセット完了', {
        description: '新しいパスワードでログインしてください。',
      });
      
      // 5秒後にログインページへ
      setTimeout(() => {
        console.log('🏠 Redirecting to home...');
        navigate('/');
      }, 5000);
      
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      setStatus('error');
      
      // エラーメッセージを整形
      let errorMessage = error.message || 'パスワードのリセットに失敗しました。';
      
      if (errorMessage.includes('invalid_token')) {
        errorMessage = 'リセットトークンが無効です。有効期限が切れている可能性があります。再度パスワードリセットをリクエストしてください。';
      } else if (errorMessage.includes('password_too_short')) {
        errorMessage = 'パスワードが短すぎます。最低8文字以上で入力してください。';
        setStatus('form');
      } else if (errorMessage.includes('insufficient_password_complexity')) {
        errorMessage = 'パスワードが脆弱です。より複雑なパスワード（大文字・小文字・数字・記号を組み合わせ）を設定してください。';
        setStatus('form');
      } else if (errorMessage.includes('email_rate_limit_exceeded')) {
        errorMessage = 'パスワードリセットの回数が上限を超えました。しばらくしてから再度お試しください。';
      }
      
      setMessage(errorMessage);
      setIsSubmitting(false);
    }
  };

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
              <CardTitle className="text-2xl">処理中...</CardTitle>
              <CardDescription>
                パスワードをリセットしています
              </CardDescription>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <CardTitle className="text-2xl">完了！</CardTitle>
              <CardDescription>
                {message}
              </CardDescription>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <CardTitle className="text-2xl">エラー</CardTitle>
              <CardDescription className="whitespace-pre-wrap">
                {message}
              </CardDescription>
            </>
          )}

          {status === 'form' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔑</span>
              </div>
              <CardTitle className="text-2xl">新しいパスワードを設定</CardTitle>
              <CardDescription>
                8文字以上の強力なパスワードを設定してください
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        {status === 'form' && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">新しいパスワード</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="最低8文字"
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">パスワードの確認</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="もう一度入力"
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
              </div>
              {message && (
                <Alert variant="destructive">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? '処理中...' : 'パスワードをリセット'}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={handleGoHome} disabled={isSubmitting}>
                  キャンセル
                </Button>
              </div>
            </form>
          </CardContent>
        )}
        
        {status === 'success' && (
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                5秒後にログインページへ移動します...
              </p>
              <Button onClick={handleGoHome} className="w-full">
                今すぐログイン
              </Button>
            </div>
          </CardContent>
        )}
        
        {status === 'error' && (
          <CardContent>
            <div className="space-y-4">
              <Button onClick={handleGoHome} className="w-full">
                ホームに戻る
              </Button>
              <p className="text-sm text-gray-600 text-center">
                パスワードリセットのリンクの有効期限は24時間です。
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
