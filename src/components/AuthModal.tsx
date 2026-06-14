import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import auth from '@/lib/shared/kliv-auth';
import db from '@/lib/shared/kliv-database';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }: AuthModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const ensureProfileExists = async (user: any) => {
    try {
      const existingProfile = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`,
        _deleted: 'eq.0'
      });
      
      if (existingProfile.length === 0) {
        // 新規作成：user_uuid, email, display_name, role: 'user', is_blocked: 0, phone: ''
        await db.insert('user_profiles', {
          user_uuid: user.userUuid,
          email: user.email || '',
          display_name: user.name || user.email || '',
          role: 'user',
          is_blocked: 0,
          phone: ''
        });
      } else {
        // 既存のプロフィールがある場合
        const profile = existingProfile[0];
        
        // emailが空または未設定の場合のみ、emailを更新（他の項目は変更しない）
        if (!profile.email || profile.email === '') {
          await db.update('user_profiles', { 
            _row_id: `eq.${profile._row_id}` 
          }, { 
            email: user.email || '' 
          });
        }
        
        // roleやis_blockedは既存値を維持（上書きしない）
      }
    } catch (err) {
      // Profile creation is best-effort — don't block login
      console.error('Profile ensure error:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await auth.signIn(loginEmail, loginPassword);
      
      // ブロックチェック：user_profiles を取得して is_blocked を確認
      const profiles = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`,
        _deleted: 'eq.0'
      });
      
      const profile = profiles[0];
      
      // ブロックされている場合はサインアウトしてエラーを表示
      if (profile && profile.is_blocked === 1) {
        await auth.signOut();
        setError('このアカウントは利用停止中です。運営にお問い合わせください。');
        setIsLoading(false);
        return; // onAuthSuccess や onClose は呼ばずに中断
      }
      
      // ブロックされていない場合は通常通りログインを続行
      onAuthSuccess(user);
      onClose();
      toast({
        title: "ログイン成功",
        description: "ようこそ！",
      });

      // Create profile in background after login completes
      ensureProfileExists(user);
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 新規登録（自動サインインされる）
      const user = await auth.signUp(registerEmail, registerPassword, registerName);
      
      onAuthSuccess(user);
      handleClose();
      
      toast({
        title: "登録完了",
        description: "アカウントが作成されました！ようこそ、Sverige.JPへ！",
        className: "bg-green-50 border-green-200 text-green-900",
      });

      // Create profile in background after registration completes
      ensureProfileExists(user);
      
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await auth.requestPasswordReset(resetEmail);
      setResetStep(2);
      toast({
        title: "リセットコード送信",
        description: "メールにリセットコードを送信しました。",
        className: "bg-yellow-50 border-yellow-200 text-yellow-900",
      });
    } catch (err: any) {
      console.error('Password reset request error:', err);
      
      // エラーメッセージをわかりやすく整形
      let errorMessage = err.message || 'リセットコードの送信に失敗しました';
      
      if (errorMessage.includes('email_template_not_configured')) {
        errorMessage = 'メールテンプレートが設定されていません。管理者にお問い合わせください。';
      } else if (errorMessage.includes('email_rate_limit_exceeded')) {
        errorMessage = 'メール送信回数の上限を超えました。しばらくしてから再度お試しください。';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      setIsLoading(false);
      return;
    }

    try {
      // 認証SDKでパスワードリセット完了
      await auth.completePasswordReset(resetCode, newPassword);
      
      toast({
        title: "パスワードリセット完了",
        description: "新しいパスワードが設定されました。ログインしてください。",
        className: "bg-green-50 border-green-200 text-green-900",
      });
      
      handleClose();
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      // エラーメッセージをわかりやすく整形
      let errorMessage = err.message || 'パスワードのリセットに失敗しました';
      
      if (errorMessage.includes('invalid_token')) {
        errorMessage = 'リセットコードが無効です。有効期限が切れている可能性があります。再度リセットをリクエストしてください。';
      } else if (errorMessage.includes('password_too_short')) {
        errorMessage = 'パスワードが短すぎます。最低8文字以上で入力してください。';
      } else if (errorMessage.includes('insufficient_password_complexity')) {
        errorMessage = 'パスワードが脆弱です。より複雑なパスワードを設定してください。';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLoginEmail('');
    setLoginPassword('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterName('');
    setIsResetPassword(false);
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetStep(1);
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>アカウント</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register">新規登録</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            {isResetPassword ? (
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsResetPassword(false);
                      setResetStep(1);
                      setError('');
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    戻る
                  </Button>
                </div>

                {resetStep === 1 ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">パスワードリセット</h3>
                      <p className="text-sm text-gray-600">
                        メールアドレスを入力してリセットコードを受け取ってください
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">メールアドレス</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? '送信中...' : 'リセットコードを送信'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">新しいパスワードを設定</h3>
                      <p className="text-sm text-gray-600">
                        {resetEmail} に送信されたリセットコードを入力してください
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-code">リセットコード</Label>
                      <Input
                        id="reset-code"
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="メールに記載されたコード"
                        required
                        className="font-mono"
                      />
                    </div>
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
                      />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? '更新中...' : 'パスワードをリセット'}
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">メールアドレス</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">パスワード</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button 
                  type="button" 
                  variant="link" 
                  className="px-0 h-auto text-sm"
                  onClick={() => {
                    setIsResetPassword(true);
                    setResetEmail(loginEmail);
                    setError('');
                  }}
                >
                  パスワードをお忘れですか？
                </Button>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'ログイン中...' : 'ログイン'}
                </Button>
              </form>
            )}
          </TabsContent>
          
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">お名前</Label>
                <Input
                  id="register-name"
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">メールアドレス</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">パスワード</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '登録中...' : '登録'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
