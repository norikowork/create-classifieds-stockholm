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
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { toast } = useToast();

  const ensureProfileExists = async (user: any) => {
    try {
      console.log('🔍 プロフィール存在チェック開始:', user.userUuid);
      
      const existingProfile = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`,
        _deleted: 'eq.0'
      });
      
      console.log('👤 既存プロフィール数:', existingProfile.length);
      
      if (existingProfile.length === 0) {
        // 新規作成：user_uuid, email, display_name, role: 'user', is_blocked: 0, phone: ''
        const userEmail = user.email || '';
        const userDisplayName = user.name || user.email || '';
        
        console.log('➕ 新規プロフィール作成:', {
          user_uuid: user.userUuid,
          email: userEmail,
          display_name: userDisplayName
        });
        
        await db.insert('user_profiles', {
          user_uuid: user.userUuid,
          email: userEmail,
          display_name: userDisplayName,
          role: 'user',
          is_blocked: 0,
          phone: ''
        });
        
        console.log('✅ 新規プロフィール作成完了:', user.userUuid);
      } else {
        // 既存のプロフィールがある場合
        const profile = existingProfile[0];
        console.log('✅ 既存プロフィール発見:', profile._row_id);
        
        // emailが空または未設定の場合のみ、emailを更新（他の項目は変更しない）
        if (!profile.email || profile.email === '') {
          const userEmail = user.email || '';
          console.log('📧 email更新:', profile._row_id, userEmail);
          
          await db.update('user_profiles', { 
            _row_id: `eq.${profile._row_id}` 
          }, { 
            email: userEmail 
          });
          
          console.log('✅ email更新完了:', profile._row_id);
        }
        
        // roleやis_blockedは既存値を維持（上書きしない）
        console.log('ℹ️ 既存プロフィール維持:', {
          role: profile.role,
          is_blocked: profile.is_blocked
        });
      }
      
      console.log('🎉 プロフィール処理完了:', user.userUuid);
      
    } catch (err) {
      console.error('❌ Profile ensure error:', err);
      throw err; // 呼び出し元でキャッチできるように再スロー
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setIsEmailNotVerified(false);
    setResendSuccess(false);

    try {
      console.log('🔐 ログイン開始:', loginEmail);
      
      // ステップ1: ログイン
      let user;
      try {
        user = await auth.signIn(loginEmail, loginPassword);
        console.log('✅ ログイン成功[signIn]:', user.userUuid);
      } catch (signInErr: any) {
        console.error('❌ ログインエラー[signIn]:', signInErr);
        setError(`ログインエラー[signIn]: ${signInErr.message || 'メールアドレスまたはパスワードが正しくありません'}`);
        setIsLoading(false);
        return;
      }
      
      // ステップ2: emailVerifiedチェック（メール確認済みかどうか）
      try {
        console.log('📧 emailVerifiedチェック開始[emailVerifiedCheck]:', user.userUuid);
        
        let emailVerified = user.emailVerified;
        console.log('📧 signIn戻り値のemailVerified:', emailVerified);
        
        // signInの戻り値にemailVerifiedがない場合、auth.getUser()で取得
        if (emailVerified === undefined || emailVerified === null) {
          console.log('📧 emailVerifiedがundefinedのため、auth.getUser()で再取得');
          const refreshedUser = await auth.getUser();
          emailVerified = refreshedUser.emailVerified;
          console.log('📧 auth.getUser()のemailVerified:', emailVerified);
        }
        
        if (emailVerified === false) {
          console.log('🚫 emailVerifiedがfalseのため、サインアウト[emailVerified]:', user.userUuid);
          
          // サインアウト
          try {
            await auth.signOut();
            console.log('🚪 未承認によりサインアウト[signOut]:', user.userUuid);
          } catch (signOutErr: any) {
            console.error('⚠️ サインアウトエラー[signOut]:', signOutErr);
          }
          
          // 未承認ユーザー専用のUIを表示
          setIsEmailNotVerified(true);
          setIsLoading(false);
          return;
        }
        
        console.log('✅ emailVerifiedがtrue[emailVerified]:', user.userUuid);
        
      } catch (emailVerifiedErr: any) {
        console.error('⚠️ emailVerifiedチェックエラー[emailVerifiedCheck]:', emailVerifiedErr);
        // emailVerifiedチェックが失敗してもログインは続行（安全性のため）
      }
      
      // ステップ3: プロフィール確実に作成（onAuthSuccessの前に実行）
      try {
        console.log('👤 プロフィール作成開始[ensureProfileExists]:', user.userUuid);
        await ensureProfileExists(user);
        console.log('✅ プロフィール作成完了[ensureProfileExists]:', user.userUuid);
      } catch (profileErr: any) {
        console.error('⚠️ プロフィール作成エラー[ensureProfileExists]:', profileErr);
        // プロフィール作成が失敗してもログインは続行（ベストエフォート）
      }
      
      // ステップ4: ブロックチェック（プロフィール作成後なので必ず存在するはず）
      let isBlocked = false;
      try {
        const profiles = await db.query('user_profiles', {
          user_uuid: `eq.${user.userUuid}`,
          _deleted: 'eq.0'
        });
        
        const profile = profiles[0];
        if (profile && profile.is_blocked === 1) {
          console.log('🚫 アカウントブロック済み[isBlocked]:', user.userUuid);
          isBlocked = true;
        }
      } catch (blockCheckErr: any) {
        console.error('⚠️ ブロックチェックエラー[blockCheck]:', blockCheckErr);
        // ブロックチェックが失敗してもログインは続行
      }
      
      // ステップ5: ブロックされている場合はサインアウト
      if (isBlocked) {
        try {
          await auth.signOut();
          console.log('🚪 ブロックによりサインアウト[signOut]:', user.userUuid);
        } catch (signOutErr: any) {
          console.error('⚠️ サインアウトエラー[signOut]:', signOutErr);
        }
        setError('このアカウントは利用停止中です。運営にお問い合わせください。');
        setIsLoading(false);
        return;
      }
      
      // ステップ6: onAuthSuccessを呼ぶ（エラーになってもログインは成立）
      try {
        console.log('🎉 onAuthSuccess呼び出し[onAuthSuccess]:', user.userUuid);
        onAuthSuccess(user);
        console.log('✅ onAuthSuccess完了[onAuthSuccess]:', user.userUuid);
      } catch (authSuccessErr: any) {
        console.error('⚠️ onAuthSuccessエラー[onAuthSuccess]:', authSuccessErr);
        // onAuthSuccessがエラーでもログインは成立（UI更新が失敗しただけ）
      }
      
      // ステップ7: ダイアログを閉じる
      try {
        onClose();
        console.log('🚪 ダイアログクローズ[onClose]');
      } catch (closeErr: any) {
        console.error('⚠️ ダイアログクローズエラー[onClose]:', closeErr);
      }
      
      // ステップ8: トースト表示（エラーになっても無視）
      try {
        toast({
          title: "ログイン成功",
          description: "ようこそ！",
        });
        console.log('🔔 トースト表示[toast]');
      } catch (toastErr: any) {
        console.error('⚠️ トースト表示エラー[toast]:', toastErr);
      }
      
      console.log('🎉 ログインフロー完了:', user.userUuid);
      
    } catch (unexpectedErr: any) {
      console.error('❌ 予期しないエラー[unexpected]:', unexpectedErr);
      setError(`予期しないエラー: ${unexpectedErr.message || '不明なエラーが発生しました'}`);
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
      console.log('📝 新規登録開始:', registerEmail);
      const user = await auth.signUp(registerEmail, registerPassword, registerName);
      console.log('✅ 新規登録成功[signUp]:', user.userUuid);
      
      // プロフィール作成（onAuthSuccessの前に実行）
      try {
        console.log('👤 プロフィール作成開始[ensureProfileExists]:', user.userUuid);
        await ensureProfileExists(user);
        console.log('✅ プロフィール作成完了[ensureProfileExists]:', user.userUuid);
      } catch (profileErr: any) {
        console.error('⚠️ プロフィール作成エラー[ensureProfileExists]:', profileErr);
        // プロフィール作成が失敗しても登録は続行（ベストエフォート）
      }
      
      // onAuthSuccessを呼ぶ
      try {
        console.log('🎉 onAuthSuccess呼び出し[onAuthSuccess]:', user.userUuid);
        onAuthSuccess(user);
        console.log('✅ onAuthSuccess完了[onAuthSuccess]:', user.userUuid);
      } catch (authSuccessErr: any) {
        console.error('⚠️ onAuthSuccessエラー[onAuthSuccess]:', authSuccessErr);
        // onAuthSuccessがエラーでも登録は成立（UI更新が失敗しただけ）
      }
      
      // ダイアログを閉じる
      try {
        handleClose();
        console.log('🚪 ダイアログクローズ[handleClose]');
      } catch (closeErr: any) {
        console.error('⚠️ ダイアログクローズエラー[handleClose]:', closeErr);
      }
      
      // トースト表示
      try {
        toast({
          title: "登録完了",
          description: "アカウントが作成されました！ようこそ、Sverige.JPへ！",
          className: "bg-green-50 border-green-200 text-green-900",
        });
        console.log('🔔 トースト表示[toast]');
      } catch (toastErr: any) {
        console.error('⚠️ トースト表示エラー[toast]:', toastErr);
      }
      
      console.log('🎉 新規登録フロー完了:', user.userUuid);
      
    } catch (err: any) {
      console.error('❌ 新規登録エラー[signUp]:', err);
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
    setIsEmailNotVerified(false);
    setResendSuccess(false);
    onClose();
  };
  
  const handleResendActivationEmail = async () => {
    setIsResendingEmail(true);
    setResendSuccess(false);
    
    try {
      console.log('📧 確認メール再送開始[resendActivation]:', loginEmail);
      await auth.resendActivation(loginEmail);
      console.log('✅ 確認メール再送成功[resendActivation]:', loginEmail);
      
      setResendSuccess(true);
      
      toast({
        title: "確認メールを再送しました",
        description: "メールをご確認ください（迷惑メールフォルダもご確認ください）",
      });
    } catch (resendErr: any) {
      console.error('❌ 確認メール再送エラー[resendActivation]:', resendErr);
      toast({
        title: "確認メールの再送に失敗しました",
        description: resendErr.message || "もう一度お試しください",
        variant: "destructive"
      });
    } finally {
      setIsResendingEmail(false);
    }
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
                
                {isEmailNotVerified && (
                  <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-900">
                    <AlertDescription>
                      <div className="space-y-3">
                        <p className="font-semibold">ユーザー登録は完了していますが、まだメール確認が済んでいません。</p>
                        <p className="text-sm">登録時に送られた確認メールのリンクをクリックして承認してください。承認後にログインできます。</p>
                        
                        {!resendSuccess ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResendActivationEmail}
                            disabled={isResendingEmail}
                            className="w-full"
                          >
                            {isResendingEmail ? '送信中...' : '確認メールを再送する'}
                          </Button>
                        ) : (
                          <div className="text-sm font-semibold text-green-700">
                            ✓ 確認メールを再送しました。メールをご確認ください（迷惑メールフォルダもご確認ください）
                          </div>
                        )}
                      </div>
                    </AlertDescription>
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
