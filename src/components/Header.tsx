import { Link, useNavigate } from 'react-router-dom';
import { Home, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import auth from '@/lib/shared/kliv-auth.js';
import { useState, useEffect } from 'react';
import { AuthModal } from '@/components/AuthModal';

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await auth.getUser();
      setUser(currentUser);
    } catch (error) {
      // Not authenticated
    }
  };

  const handleAuthSuccess = (authUser: any) => {
    setUser(authUser);
  };

  const handleSignOut = async () => {
    await auth.signOut();
    setUser(null);
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleRegister = () => {
    setIsAuthModalOpen(true);
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0 hover:opacity-80 transition-opacity">
              <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                <img 
                  src="/content/templates/sverigejplogo.png" 
                  alt="Sverige.JP Logo"
                  className="h-full w-full object-contain"
                  style={{ width: '48px', height: '48px' }}
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Sverige.JP</h1>
                <h1 className="text-base font-bold text-gray-900 sm:hidden">Sverige.JP</h1>
                <p className="text-xs text-gray-600 hidden md:block">スウェーデン日本コミュニティ</p>
              </div>
            </Link>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {user ? (
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-700 truncate max-w-[100px] sm:max-w-[150px]">
                    {user.name || user.email?.split('@')[0]}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs px-2 sm:px-3" onClick={() => navigate('/profile')}>
                    <span className="hidden sm:inline">プロフィール</span>
                    <span className="sm:hidden">プロフ</span>
                  </Button>
                  {user.isPrimaryOrg && (
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate('/admin')}>
                      <Shield className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={handleSignOut}>
                    <span className="hidden sm:inline">ログアウト</span>
                    <span className="sm:hidden">ログアウト</span>
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleLogin}>
                    ログイン
                  </Button>
                  <Button size="sm" className="h-8 text-xs px-2" onClick={handleRegister}>
                    新規登録
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
};

export default Header;
