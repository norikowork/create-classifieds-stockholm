import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, DollarSign, User, Mail, Phone, Send, X, Image as ImageIcon, MessageSquare, Home, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthModal from '@/components/AuthModal';
import Footer from '@/components/Footer';
import db from '@/lib/shared/kliv-database';
import auth from '@/lib/shared/kliv-auth';
import { useToast } from '@/hooks/use-toast';

const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});

  const postTypeLabels = {
    'for_sale': '売ります',
    'wanted': '探しています',
    'job_offering': '仕事募集',
    'job_seeking': '仕事探し'
  };

  useEffect(() => {
    loadPost();
    loadLocations();
    loadCategories();
    checkAuthStatus();
  }, [postId]);

  const loadLocations = async () => {
    try {
      const locationsData = await db.query('locations', { _deleted: 'eq.0' });
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await db.query('categories', { _deleted: 'eq.0' });
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.uuid === locationId);
    return location ? location.name_en || location.name_ja : 'Ej angivet';
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.uuid === categoryId);
    return category ? category.name_ja || category.name_en : 'Ej angivet';
  };

  const loadPost = async () => {
    try {
      const postsData = await db.query('posts', {
        _row_id: `eq.${postId}`,
        _deleted: 'eq.0'
      });
      
      if (postsData && postsData.length > 0) {
        const postData = postsData[0];
        
        // Get user profile information
        let userName = 'SverigeJP スタッフ';
        let userProfile = null;
        
        if (postData._created_by) {
          try {
            // First try to get user profile
            const profilesData = await db.query('user_profiles', {
              user_uuid: `eq.${postData._created_by}`,
              _deleted: 'eq.0'
            });
            
            if (profilesData && profilesData.length > 0) {
              userProfile = profilesData[0];
              userName = userProfile.display_name || 'SverigeJP スタッフ';
              
              // Store profile data
              setUserProfiles(prev => ({
                ...prev,
                [postData._created_by]: userProfile
              }));
            } else {
              // Fallback to user data
              const usersData = await db.query('users', {
                user_uuid: `eq.${postData._created_by}`,
                _deleted: 'eq.0'
              });
              if (usersData && usersData.length > 0) {
                const user = usersData[0];
                userName = user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}`
                  : user.email || 'SverigeJP スタッフ';
              }
            }
          } catch (e) {
            console.warn('Error fetching user profile for post:', postData._row_id, e);
          }
        }
        
        // Parse images JSON for the post
        let images = [];
        if (postData.images) {
          try {
            if (typeof postData.images === 'string') {
              images = JSON.parse(postData.images);
            } else if (Array.isArray(postData.images)) {
              images = postData.images;
            }
            // Ensure images is an array
            if (!Array.isArray(images)) {
              images = [];
            }
          } catch (e) {
            console.warn('Error parsing images:', e);
            images = [];
          }
        }
        
        const postWithImages = {
          ...postData,
          images,
          userName,
          userProfile
        };
        
        setPost(postWithImages);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error loading post:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const currentUser = await auth.getUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    }
  };



  const handleContactClick = async () => {
    const currentUser = await auth.getUser();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsContactModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    checkAuthStatus();
    setIsContactModalOpen(true);
  };

  const handleContactSubmit = async () => {
    if (!contactMessage.trim()) {
      toast({
        title: "エラー",
        description: "メッセージを入力してください",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUser = await auth.getUser();
      if (!currentUser) {
        toast({
          title: "エラー",
          description: "ログインが必要です",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "送信完了",
        description: "問い合わせを送信しました",
      });
      
      setIsContactModalOpen(false);
      setContactMessage('');
    } catch (error) {
      console.error('Error sending contact:', error);
      toast({
        title: "エラー",
        description: "送信に失敗しました",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
    setAuthModalTab('login');
  };

  const handleRegister = () => {
    setIsAuthModalOpen(true);
    setAuthModalTab('register');
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ja-JP');
  };

  const [authModalTab, setAuthModalTab] = useState('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">投稿が見つかりません</h2>
          <Button onClick={() => navigate('/')}>ホームに戻る</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Home className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Sverige.JP スウェーデン日本コミュニティサイト</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700">{user.firstName || user.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
                    プロフィール
                  </Button>
                  {user.isPrimaryOrg && (
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                      <Shield className="w-4 h-4 mr-1" />
                      管理
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    ログアウト
                  </Button>
                </div>
              ) : (
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={handleLogin}>
                    ログイン
                  </Button>
                  <Button size="sm" onClick={handleRegister}>
                    新規登録
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 lg:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          戻る
        </Button>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-8">
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl mb-2">{post.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge 
                        variant="secondary"
                        className="bg-blue-100 text-blue-800"
                      >
                        {post.post_type === 'event' ? 'イベント' : postTypeLabels[post.post_type]}
                      </Badge>
                      {post.category_uuid && (
                        <Badge 
                          variant="outline"
                          className="border-green-500 text-green-700"
                        >
                          {getCategoryName(post.category_uuid)}
                        </Badge>
                      )}
                      {post.price && post.post_type !== 'event' && (
                        <span className="text-green-600 font-semibold text-base sm:text-lg">
                          {post.price}
                        </span>
                      )}
                      {post.post_type === 'event' && post.event_date_readable && (
                        <span className="text-purple-600 font-semibold text-base sm:text-lg bg-purple-50 px-3 py-1 rounded-full">
                          <Calendar className="inline w-4 h-4 mr-1" />
                          {post.event_date_readable}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {/* Main Image - 50% size */}
                {post.images && post.images.length > 0 && (
                  <div className="mb-6">
                    <div className="relative mx-auto w-1/2">
                      <img 
                        src={post.images[selectedImageIndex] || post.images[0]} 
                        alt={post.title}
                        className="w-full h-auto object-cover rounded-lg"
                        onMouseEnter={(e) => {
                          // Show next image on hover
                          const currentIndex = selectedImageIndex;
                          const nextIndex = (currentIndex + 1) % post.images.length;
                          setSelectedImageIndex(nextIndex);
                        }}
                      />
                      {post.images.length > 1 && (
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs sm:text-sm">
                          {selectedImageIndex + 1} / {post.images.length}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Thumbnail Gallery */}
                {post.images && post.images.length > 1 && (
                  <div className="mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center">
                      <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      画像一覧（クリックして選択）
                    </h3>
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {post.images.map((image, index) => (
                        <div 
                          key={index} 
                          className={`relative aspect-square bg-gray-100 rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border-2 ${
                            selectedImageIndex === index ? 'border-blue-500' : ''
                          }`} 
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          <img 
                            src={image} 
                            alt={`画像 ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event Information - Only show for events */}
                {post.post_type === 'event' && (
                  <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center text-purple-800">
                      <Calendar className="w-5 h-5 mr-2" />
                      イベント情報
                    </h3>
                    <div className="space-y-2">
                      {post.event_date_readable && (
                        <div className="flex items-center text-purple-700">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="font-medium">開催日:</span>
                          <span className="ml-2">{post.event_date_readable}</span>
                        </div>
                      )}
                      
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">詳細</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">{post.description}</p>
                  </div>
                </div>

                {/* User Information */}
                <div className="border-t pt-4">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {post.userProfile?.profile_photo_url ? (
                        <img 
                          src={post.userProfile.profile_photo_url}
                          alt={post.userName || 'プロフィール写真'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {post.userName || 'SverigeJP スタッフ'}
                        </span>
                        {post.userProfile?.username && (
                          <span className="text-sm text-gray-500">@{post.userProfile.username}</span>
                        )}
                      </div>
                      {post.userProfile?.bio && (
                        <p className="text-sm text-gray-600 line-clamp-2">{post.userProfile.bio}</p>
                      )}
                      {(post.userProfile?.location || post.userProfile?.phone) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                          {post.userProfile.location && (
                            <div className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {post.userProfile.location}
                            </div>
                          )}
                          {post.userProfile.phone && (
                            <div className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {post.userProfile.phone}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm pt-4 border-t">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span className="text-xs sm:text-sm">投稿日: {formatDate(post._created_at)}</span>
                    </div>
                    {post.category_uuid && (
                      <div className="flex items-center text-gray-600">
                        <Shield className="w-4 h-4 mr-2" />
                        <span className="text-xs sm:text-sm">カテゴリ: {getCategoryName(post.category_uuid)}</span>
                      </div>
                    )}
                    {post.location_uuid && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span className="text-xs sm:text-sm">場所: {getLocationName(post.location_uuid)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Section */}
          <div className="xl:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  問い合わせ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600 text-sm">
                    この投稿に興味がありますか？下のボタンから問い合わせてください。
                  </p>
                  <Button 
                    onClick={handleContactClick}
                    className="w-full"
                    size="lg"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    問い合わせる
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>投稿者に問い合わせる</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="message">メッセージ</Label>
              <Textarea
                id="message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="この投稿について質問やメッセージを入力してください..."
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsContactModalOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleContactSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? '送信中...' : '送信する'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab={authModalTab}
        onSuccess={handleAuthSuccess}
      />

      <Footer />
    </div>
  );
};

export default PostDetail;