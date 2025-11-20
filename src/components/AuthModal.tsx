import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Mail, ArrowLeft } from 'lucide-react';
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
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: request code, 2: reset password
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await auth.signIn(loginEmail, loginPassword);
      
      // Ensure user profile exists
      const existingProfile = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`,
        _deleted: 'eq.0'
      });
      
      if (existingProfile.length === 0) {
        // Create profile with email as display name if no profile exists
        await db.insert('user_profiles', {
          user_uuid: user.userUuid,
          display_name: user.email,
          phone: ''
        });
      }
      
      onAuthSuccess(user);
      onClose();
      toast({
        title: "ログイン成功",
        description: "ようこそ！",
      });
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
      const user = await auth.signUp(registerEmail, registerPassword, registerName);
      setIsVerifying(true);
      toast({
        title: "認証メール送信",
        description: "メールに記載された認証コードを入力してください",
      });
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setIsLoading(true);
    setError('');

    try {
      // This would typically call the auth API with verification code
      // For now, we'll simulate successful verification
      const user = await auth.signIn(registerEmail, registerPassword);
      
      // Create or update user profile with the name from registration
      const existingProfile = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`,
        _deleted: 'eq.0'
      });
      
      if (existingProfile.length === 0) {
        // Create new profile
        await db.insert('user_profiles', {
          user_uuid: user.userUuid,
          display_name: registerName || user.email,
          phone: ''
        });
      } else {
        // Update existing profile with the registered name
        await db.update('user_profiles', 
          { _row_id: `eq.${existingProfile[0]._row_id}` },
          { display_name: registerName || user.email }
        );
      }
      
      onAuthSuccess(user);
      onClose();
      toast({
        title: "登録完了",
        description: "アカウントが作成されました！",
      });
    } catch (err: any) {
      setError(err.message || '認証に失敗しました');
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
        description: "メールにリセットコードを送信しました",
      });
    } catch (err: any) {
      setError(err.message || 'リセットコードの送信に失敗しました');
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
      const response = await fetch('/api/v2/auth/password-reset-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetCode,
          password: newPassword
        })
      });

      if (response.ok) {
        toast({
          title: "パスワードリセット完了",
          description: "新しいパスワードが設定されました",
        });
        handleClose();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'パスワードのリセットに失敗しました');
      }
    } catch (err: any) {
      setError(err.message || 'パスワードのリセットに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset all states
    setLoginEmail('');
    setLoginPassword('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterName('');
    setVerificationCode('');
    setIsVerifying(false);
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
            {!isVerifying ? (
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
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">メール認証</h3>
                  <p className="text-sm text-gray-600">
                    {registerEmail} に送信された認証コードを入力してください
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verification-code">認証コード</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="6桁のコード"
                    required
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button onClick={handleVerifyEmail} className="w-full" disabled={isLoading}>
                  {isLoading ? '認証中...' : '認証する'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsVerifying(false)}
                  className="w-full"
                >
                  戻る
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;