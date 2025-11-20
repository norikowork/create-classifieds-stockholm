import { useState, useEffect } from 'react';
import { Search, Plus, User, Briefcase, ShoppingBag, Home, Phone, Wrench, Shield, Image as ImageIcon, ArrowRight, Music, Trophy, Palette, Users, GraduationCap, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import db from '@/lib/shared/kliv-database';
import auth from '@/lib/shared/kliv-auth';
import { AuthModal } from '@/components/AuthModal';
import { PostModal } from '@/components/PostModal';
import { EventModal } from '@/components/EventModal';
import Footer from '@/components/Footer';
import { useNavigate, Link } from 'react-router-dom';

const categoryIcons = {
  'cat-for-sale': ShoppingBag,
  'cat-wanted': Search,
  'cat-job-seeking': User,
  'cat-housing': Home,
  'cat-events': Star
};

const postTypeLabels = {
  'free': '無料',
  'paid': '有料',
  'donation': '寄付'
};

const Index = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2025-11');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 20;

  useEffect(() => {
    loadData();
    checkAuth();
  }, []);

  // Update posts when allPosts changes (for pagination)
  useEffect(() => {
    setPosts(allPosts);
    setCurrentPage(1);
  }, [allPosts]);

  useEffect(() => {
    if (searchTerm || selectedCategory || selectedMonth) {
      loadFilteredPosts();
    } else {
      loadPosts();
    }
  }, [searchTerm, selectedCategory, selectedMonth]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedMonth]);

  // Refresh posts when PostModal closes
  useEffect(() => {
    if (!isPostModalOpen) {
      loadData();
    }
  }, [isPostModalOpen]);

  const loadData = async () => {
    try {
      const [categoriesData, locationsData, postsData] = await Promise.all([
        db.query('categories', { _deleted: 'eq.0' }),
        db.query('locations', { _deleted: 'eq.0' }),
        db.query('posts', { status: 'eq.active', _deleted: 'eq.0', order: '_created_at.desc' })
      ]);
      setCategories(categoriesData);
      setLocations(locationsData);
      // Parse images JSON for each post and get user info
      const postsWithImages = await Promise.all(postsData.map(async post => {
        let images = [];
        if (post.images) {
          try {
            if (typeof post.images === 'string') {
              images = JSON.parse(post.images);
            } else if (Array.isArray(post.images)) {
              images = post.images;
            }
            // Ensure images is an array
            if (!Array.isArray(images)) {
              images = [];
            }
          } catch (e) {
            console.warn('Error parsing images for post:', post._row_id, e);
            images = [];
          }
        }

        // Get user information
        let userName = 'SverigeJP スタッフ';
        if (post._created_by) {
          try {
            const usersData = await db.query('users', {
              user_uuid: `eq.${post._created_by}`,
              _deleted: 'eq.0'
            });
            if (usersData && usersData.length > 0) {
              const user = usersData[0];
              userName = user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : user.email || 'SverigeJP スタッフ';
            }
          } catch (e) {
            console.warn('Error fetching user for post:', post._row_id, e);
          }
        }

        return {
          ...post,
          images,
          userName
        };
      }));
      setAllPosts(postsWithImages);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const currentUser = await auth.getUser();
      setUser(currentUser);
    } catch (error) {
      console.log('Not authenticated');
    }
  };

  const handleAuthSuccess = (authUser: any) => {
    setUser(authUser);
    loadData(); // Reload data to show user-specific content
  };

  const handlePostCreated = () => {
    loadData(); // Reload posts to include the new one
  };

  const handleEventCreated = () => {
    loadData(); // Reload posts to include the new event
  };

  const handleCategoryChange = (categoryUuid: string) => {
    setSelectedCategory(categoryUuid);
    // カテゴリーを選択したら月選択を2025年11月にリセット
    setSelectedMonth('2025-11');
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleRegister = () => {
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    await auth.signOut();
    setUser(null);
  };

  const handleNewPost = () => {
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      // 投稿タイプ選択モーダルを開く
      setIsPostModalOpen(true);
    }
  };

  const handleNewEvent = () => {
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      setIsEventModalOpen(true);
    }
  };

  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    // 月を選択したらカテゴリー選択をクリア（イベントのみ表示）
    setSelectedCategory('cat-events');
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get posts for current page
  const getCurrentPagePosts = () => {
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    return posts.slice(startIndex, endIndex);
  };

  // Calculate pagination
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const currentPosts = getCurrentPagePosts();

  const loadFilteredPosts = async () => {
    try {
      const filters = { status: 'eq.active', _deleted: 'eq.0', order: '_created_at.desc' };
      
      if (selectedCategory) {
        filters.category_uuid = `eq.${selectedCategory}`;
      }
      
      let postsData = await db.query('posts', filters);
      
      // 月別フィルターの適用
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number);
        const startOfMonth = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
        const endOfMonth = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);
        
        postsData = postsData.filter(post => {
          if (post.post_type === 'event' && post.event_date) {
            return post.event_date >= startOfMonth && post.event_date <= endOfMonth;
          }
          // 月選択がある場合はイベント以外の投稿は表示しない
          return false;
        });
      }
      
      // Parse images JSON for each post
      const postsWithImages = await Promise.all(postsData.map(async post => {
        let images = [];
        if (post.images) {
          try {
            if (typeof post.images === 'string') {
              images = JSON.parse(post.images);
            } else if (Array.isArray(post.images)) {
              images = post.images;
            }
            // Ensure images is an array
            if (!Array.isArray(images)) {
              images = [];
            }
          } catch (e) {
            console.warn('Error parsing images for post:', post._row_id, e);
            images = [];

          }
        }

        // Get user information
        let userName = 'SverigeJP スタッフ';
        if (post._created_by) {
          try {
            // First try to get display name from user_profiles
            const profilesData = await db.query('user_profiles', {
              user_uuid: `eq.${post._created_by}`,
              _deleted: 'eq.0'
            });
            
            if (profilesData && profilesData.length > 0 && profilesData[0].display_name) {
              userName = profilesData[0].display_name;
            } else {
              // Fall back to first_name + last_name from users table
              const usersData = await db.query('users', {
                user_uuid: `eq.${post._created_by}`,
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
            console.warn('Error fetching user for post:', post._row_id, e);
          }
        }

        return {
          ...post,
          images,
          userName
        };
      }));
      
      // Client-side search for title/description
      const filteredPosts = searchTerm
        ? postsWithImages.filter(post => 
            post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.description.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : postsWithImages;
      
      setAllPosts(filteredPosts);
    } catch (error) {
      console.error('Error loading filtered posts:', error);
    }
  };

  const loadPosts = async () => {
    try {
      const postsData = await db.query('posts', { status: 'eq.active', _deleted: 'eq.0', order: '_created_at.desc' });
      // Parse images JSON for each post
      const postsWithImages = await Promise.all(postsData.map(async post => {
        let images = [];
        if (post.images) {
          try {
            if (typeof post.images === 'string') {
              images = JSON.parse(post.images);
            } else if (Array.isArray(post.images)) {
              images = post.images;
            }
            // Ensure images is an array
            if (!Array.isArray(images)) {
              images = [];
            }
          } catch (e) {
            console.warn('Error parsing images for post:', post._row_id, e);
            images = [];
          }
        }

        // Get user information
        let userName = 'SverigeJP スタッフ';
        if (post._created_by) {
          try {
            const usersData = await db.query('users', {
              user_uuid: `eq.${post._created_by}`,
              _deleted: 'eq.0'
            });
            if (usersData && usersData.length > 0) {
              const user = usersData[0];
              userName = user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : user.email || 'SverigeJP スタッフ';
            }
          } catch (e) {
            console.warn('Error fetching user for post:', post._row_id, e);
          }
        }

        return {
          ...post,
          images,
          userName
        };
      }));
      setAllPosts(postsWithImages);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  const getCategoryName = (categoryUuid) => {
    const category = categories.find(c => c.uuid === categoryUuid);
    return category ? category.name_ja : '未分類';
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.uuid === locationId);
    return location ? location.name_en || location.name_ja : 'Ej angivet';
  };

  const getCategoryColor = (categoryUuid) => {
    const category = categories.find(c => c.uuid === categoryUuid);
    return category ? category.color : '#666';
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ja-JP');
  };

  const getMonthOptions = () => {
    const options = [];
    
    // 2025年11月から2026年10月までを生成
    for (let month = 11; month <= 12; month++) {
      const value = `2025-${month.toString().padStart(2, '0')}`;
      const label = `2025年${month}月`;
      options.push({ value, label });
    }
    
    for (let month = 1; month <= 10; month++) {
      const value = `2026-${month.toString().padStart(2, '0')}`;
      const label = `2026年${month}月`;
      options.push({ value, label });
    }
    
    return options;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="投稿を検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNewPost}>
                <Plus className="w-4 h-4 mr-2" />
                新規投稿
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleNewEvent}>
                <Star className="w-4 h-4 mr-2" />
                イベント掲載
              </Button>
            </div>
          </div>

          {/* Month Filter for Events - Only show when events category is selected */}
          {selectedCategory === 'cat-events' && (
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">イベント月別：</label>
                <Select value={selectedMonth} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="月を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMonthOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={selectedCategory === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCategoryChange('')}
            >
              全て
            </Button>
            {categories.map((category) => {
              const IconComponent = categoryIcons[category.uuid] || Home;
              return (
                <Button
                  key={category.uuid}
                  variant={selectedCategory === category.uuid ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange(category.uuid)}
                  style={{
                    backgroundColor: selectedCategory === category.uuid ? category.color : undefined,
                    borderColor: selectedCategory !== category.uuid ? category.color : undefined
                  }}
                >
                  <IconComponent className="w-4 h-4 mr-1" />
                  {category.name_ja}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentPosts.map((post) => (
            <Card key={post._row_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{post.title}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge 
                        variant="secondary" 
                        style={{ backgroundColor: getCategoryColor(post.category_uuid) + '20', color: getCategoryColor(post.category_uuid) }}
                      >
                        {postTypeLabels[post.post_type]}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Images */}
                {post.images && post.images.length > 0 && (
                  <div className="mb-4">
                    <div className="relative w-full aspect-video bg-gray-100 rounded overflow-hidden">
                      <img 
                        src={post.images[0]} 
                        alt="投稿画像"
                        className="w-full h-full object-cover"
                      />
                      {post.images.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                          {post.images.length}枚の画像
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <p className="text-gray-600 text-sm mb-2 line-clamp-3">
                  {post.description}
                </p>
                {post.category_uuid && (
                  <div className="flex items-center text-xs text-blue-600 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryName(post.category_uuid)}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center text-xs text-gray-500 mb-2">
                  <User className="w-3 h-3 mr-1" />
                  {post.userName || 'SverigeJP スタッフ'}
                </div>
                {post.location_uuid && (
                  <div className="flex items-center mb-2 text-xs text-gray-500">
                    <Home className="w-3 h-3 mr-1" />
                    {getLocationName(post.location_uuid)}
                  </div>
                )}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{formatDate(post._created_at)}</span>
                  <div className="flex gap-2">
                    {post.post_type === 'event' && post.event_date_readable && (
                      <span className="font-semibold text-purple-600">
                        📅 {post.event_date_readable}
                      </span>
                    )}
                    {post.price && <span className="font-semibold text-green-600">{post.price}</span>}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Link to={`/post/${post._row_id}`}>
                    <Button 
                      variant="outline" 
                      className="w-full"
                    >
                      詳細を見る
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">投稿が見つかりません</h3>
            <p className="text-gray-500">検索条件を変えてみてください</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </Button>
            
            <div className="flex space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Auth and Post Modals */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
        
        <PostModal
          isOpen={isPostModalOpen}
          onClose={() => setIsPostModalOpen(false)}
          onPostCreated={handlePostCreated}
          user={user}
        />
        
        <EventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          onEventCreated={handleEventCreated}
          user={user}
        />
      </main>

      <Footer />
    </div>
  );
};

export default Index;