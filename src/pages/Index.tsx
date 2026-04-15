// Sweden.JP - Stockholm Japanese Community - Main index page
import { useState, useEffect } from 'react';
import { Search, Plus, User, Briefcase, ShoppingBag, Home, Phone, Wrench, Shield, Image as ImageIcon, ArrowRight, Music, Trophy, Palette, Users, GraduationCap, Star, ChevronLeft, ChevronRight, List, Grid3X3, MapPin, MessageSquare, Heart, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import db from '@/lib/shared/kliv-database';
import auth from '@/lib/shared/kliv-auth';
import { AuthModal } from '@/components/AuthModal';
import { PostModal } from '@/components/PostModal';
import Footer from '@/components/Footer';
import { useNavigate, Link } from 'react-router-dom';
import MapView from '@/components/MapView';

const categoryIcons = {
  'cat-for-sale': ShoppingBag,
  'cat-job-seeking': User,
  'cat-housing': Home,
  'cat-events': Star,
  'cat-services': Wrench,
  'cat-bulletin': MessageSquare
};

const postTypeLabels = {
  'free': '無料',
  'paid': '有料'
};

const employmentTypeLabels = {
  'full-time': 'フルタイム',
  'part-time': 'パートタイム',
  'contract': 'コントラクト',
  'internship': 'インターン',
  'other': 'その他'
};

const experienceLevelLabels = {
  'entry': '初級',
  'mid': '中級',
  'senior': 'シニア',
  'any': '経験問わず'
};

type ViewMode = 'grid' | 'list' | 'images' | 'map';

const Index = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedMapPost, setSelectedMapPost] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 20; // Posts per page

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
      const [categoriesData, locationsData, subcategoriesData, postsData, usersData] = await Promise.all([
        db.query('categories', { _deleted: 'eq.0' }),
        db.query('locations', { _deleted: 'eq.0' }),
        db.query('subcategories', { _deleted: 'eq.0' }),
        db.query('posts', { status: 'eq.active', _deleted: 'eq.0', order: '_created_at.desc' }),
        db.query('users', { _deleted: 'eq.0' })
      ]);
      
      setCategories(categoriesData);
      setLocations(locationsData);
      setSubcategories(subcategoriesData);
      
      // Create a Map for quick user lookup (performance optimization)
      const userMap = new Map();
      usersData.forEach(user => {
        userMap.set(user.user_uuid, user);
      });
      
      // Parse images JSON for each post and get user info from Map
      const postsWithImages = postsData.map(post => {
        let images = [];
        if (post.images) {
          try {
            if (typeof post.images === 'string') {
              images = JSON.parse(post.images);
            } else if (Array.isArray(post.images)) {
              images = post.images;
            }
            if (!Array.isArray(images)) {
              images = [];
            }
          } catch (e) {
            console.warn('Error parsing images for post:', post._row_id, e);
            images = [];
          }
        }

        // Get user information from Map (no additional DB query)
        let userName = 'SverigeJP スタッフ';
        if (post._created_by) {
          const user = userMap.get(post._created_by);
          if (user) {
            userName = user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}`
              : user.email || 'SverigeJP スタッフ';
          }
        }
        
        // Get category and location info
        const category = categoriesData.find(c => c.uuid === post.category_uuid);
        const location = locationsData.find(l => l.uuid === post.location_uuid);
        
        return {
          ...post,
          images,
          userName,
          categoryName: category?.name_ja || '未分類',
          categoryColor: category?.color || '#666',
          locationName: location?.name_en || location?.name_ja || 'Ej angivet'
        };
      });
      
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
      // Not authenticated
    }
  };

  const handleAuthSuccess = (authUser: any) => {
    setUser(authUser);
    loadData(); // Reload data to show user-specific content
  };

  const handlePostCreated = () => {
    loadData(); // Reload posts to include the new one
  };

  const handleCategoryChange = (categoryUuid: string) => {
    // 掲示板カテゴリーの場合はフォーラムページに遷移
    if (categoryUuid === 'cat-bulletin') {
      navigate('/forum');
      return;
    }
    setSelectedCategory(categoryUuid);
    // イベントカテゴリー以外が選択されたら月選択をクリア
    if (categoryUuid !== 'cat-events') {
      setSelectedMonth('');
    }
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
        
        // Get category and location info from state
        const category = categories.find(c => c.uuid === post.category_uuid);
        const location = locations.find(l => l.uuid === post.location_uuid);
        
        return {
          ...post,
          images,
          userName,
          categoryName: category?.name_ja || '未分類',
          categoryColor: category?.color || '#666',
          locationName: location?.name_en || location?.name_ja || 'Ej angivet'
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
        
        // Get category and location info from state
        const category = categories.find(c => c.uuid === post.category_uuid);
        const location = locations.find(l => l.uuid === post.location_uuid);
        
        return {
          ...post,
          images,
          userName,
          categoryName: category?.name_ja || '未分類',
          categoryColor: category?.color || '#666',
          locationName: location?.name_en || location?.name_ja || 'Ej angivet'
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

  const getSubcategoryName = (subcategoryUuid) => {
    const subcategory = subcategories.find(s => s.uuid === subcategoryUuid);
    return subcategory ? subcategory.name_ja : '';
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
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0 hover:opacity-80 transition-opacity">
              <img 
                src="/content/templates/sverigejplogo.png" 
                alt="Sverige.JP Logo"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0"
                style={{ width: '48px', height: '48px' }}
              />
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
                    {user.firstName || user.email?.split('@')[0]}
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
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNewPost}>
              <Plus className="w-4 h-4 mr-2" />
              新規投稿
            </Button>
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

          {/* Categories and View Toggle */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={selectedCategory === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCategoryChange('')}
              className={selectedCategory === '' ? 'text-white border-2' : 'border-2 bg-white hover:bg-gray-50'}
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
                  className={selectedCategory === category.uuid ? 'text-white border-2' : 'border-2 bg-white hover:bg-gray-50'}
                  style={{
                    backgroundColor: selectedCategory === category.uuid ? category.color : undefined,
                    borderColor: category.color,
                    borderWidth: '2px'
                  }}
                >
                  <IconComponent className="w-4 h-4 mr-1" />
                  {category.name_ja}
                </Button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="flex justify-end mb-4">
            <div className="inline-flex rounded-md border overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 flex items-center gap-1 text-sm ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
                リスト
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 flex items-center gap-1 text-sm border-l ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                カード
              </button>
              <button
                onClick={() => setViewMode('images')}
                className={`px-3 py-2 flex items-center gap-1 text-sm border-l ${
                  viewMode === 'images' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                画像のみ
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-2 flex items-center gap-1 text-sm border-l ${
                  viewMode === 'map' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MapPin className="w-4 h-4" />
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Posts Display based on View Mode */}
        {viewMode === 'grid' && (
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
                          className="text-gray-600"
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
                      {post.subcategory_uuid && (
                        <span className="ml-2 text-gray-700">
                          {' > '}{getSubcategoryName(post.subcategory_uuid)}
                        </span>
                      )}
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
                  {post.postal_code && (
                    <div className="flex items-center mb-2 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 mr-1" />
                      {post.postal_code}
                    </div>
                  )}
                  {post.brand && (
                    <div className="flex items-center mb-2 text-xs text-gray-500">
                      <span className="font-medium">ブランド:</span> {post.brand}
                    </div>
                  )}
                  {post.model_name && (
                    <div className="flex items-center mb-2 text-xs text-gray-500">
                      <span className="font-medium">モデル:</span> {post.model_name}
                    </div>
                  )}
                  {post.size_dimensions && (
                    <div className="flex items-center mb-2 text-xs text-gray-500">
                      <span className="font-medium">サイズ:</span> {post.size_dimensions}
                    </div>
                  )}
                  {post.company_name && (
                    <div className="flex items-center mb-2 text-xs text-gray-500">
                      <span className="font-medium">会社:</span> {post.company_name}
                    </div>
                  )}
                  {post.salary && (
                    <div className="flex items-center mb-2 text-xs text-green-600">
                      <span className="font-medium text-gray-700">給料:</span> {post.salary}
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex gap-2">
                      {post.employment_type && (
                        <span className="text-xs text-gray-600">
                          {employmentTypeLabels[post.employment_type] || post.employment_type}
                        </span>
                      )}
                      {post.experience_level && (
                        <span className="text-xs text-gray-600">
                          {experienceLevelLabels[post.experience_level] || post.experience_level}
                        </span>
                      )}
                      {post.post_type === 'event' && post.event_date_readable && (
                        <span className="font-semibold text-purple-600">
                          📅 {post.event_date_readable}
                        </span>
                      )}
                      {post.price ? (
                        <span className="font-semibold text-green-600">
                          {post.post_type === 'free' ? (
                            <><span className="line-through opacity-50">{post.price}</span> 0kr</>
                          ) : (
                            post.price
                          )}
                        </span>
                      ) : null}
                    </div>
                    <span>{formatDate(post._created_at)}</span>
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
        )}

        {/* List View - Thumbnail + Text */}
        {viewMode === 'list' && (
          <div className="space-y-3">
            {currentPosts.map((post) => (
              <Card key={post._row_id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      {post.images && post.images.length > 0 ? (
                        <Link to={`/post/${post._row_id}`}>
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded overflow-hidden bg-gray-100">
                            <img
                              src={post.images[0]}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </Link>
                      ) : (
                        <Link to={`/post/${post._row_id}`}>
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        </Link>
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h3 className="text-base font-semibold truncate">{post.title}</h3>
                        <Badge
                          variant="secondary"
                          className="flex-shrink-0 text-xs text-gray-600"
                        >
                          {postTypeLabels[post.post_type]}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                        {post.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {post.category_uuid && (
                          <span className="flex items-center text-blue-700">
                            <span className="font-medium">{getCategoryName(post.category_uuid)}</span>
                            {post.subcategory_uuid && (
                              <span className="ml-1">
                                {' > '}{getSubcategoryName(post.subcategory_uuid)}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {post.userName || 'SverigeJP スタッフ'}
                        </span>
                        {post.location_uuid && (
                          <span className="flex items-center">
                            <Home className="w-3 h-3 mr-1" />
                            {getLocationName(post.location_uuid)}
                          </span>
                        )}
                        {post.postal_code && (
                          <span className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {post.postal_code}
                          </span>
                        )}
                        {post.brand && (
                          <span className="flex items-center">
                            <span className="font-medium">ブランド:</span> {post.brand}
                          </span>
                        )}
                        {post.model_name && (
                          <span className="flex items-center">
                            <span className="font-medium">モデル:</span> {post.model_name}
                          </span>
                        )}
                        {post.size_dimensions && (
                          <span className="flex items-center">
                            <span className="font-medium">サイズ:</span> {post.size_dimensions}
                          </span>
                        )}
                        {post.company_name && (
                          <span className="flex items-center">
                            <span className="font-medium">会社:</span> {post.company_name}
                          </span>
                        )}
                        {post.salary && (
                          <span className="flex items-center font-semibold text-green-600">
                            <span className="font-medium text-gray-700">給料:</span> {post.salary}
                          </span>
                        )}
                        {post.employment_type && (
                          <span className="flex items-center">
                            <span className="font-medium">形態:</span> {employmentTypeLabels[post.employment_type] || post.employment_type}
                          </span>
                        )}
                        {post.experience_level && (
                          <span className="flex items-center">
                            <span className="font-medium">経験:</span> {experienceLevelLabels[post.experience_level] || post.experience_level}
                          </span>
                        )}
                        {post.price ? (
                          <span className="font-semibold text-green-600">
                            {post.post_type === 'free' ? (
                              <><span className="line-through opacity-50">{post.price}</span> 0kr</>
                            ) : (
                              post.price
                            )}
                          </span>
                        ) : null}
                        {post.post_type === 'event' && post.event_date_readable && (
                          <span className="font-semibold text-purple-600">
                            📅 {post.event_date_readable}
                          </span>
                        )}
                        <span>{formatDate(post._created_at)}</span>
                      </div>
                    </div>
                    {/* Action */}
                    <div className="flex items-center flex-shrink-0">
                      <Link to={`/post/${post._row_id}`}>
                        <Button variant="outline" size="sm">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Images Only View */}
        {viewMode === 'images' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentPosts.filter(p => p.images && p.images.length > 0).map((post) => (
              <Link key={post._row_id} to={`/post/${post._row_id}`}>
                <div className="flex flex-col gap-1 hover:shadow-lg transition-shadow">
                  <div className="relative aspect-square rounded overflow-hidden bg-gray-100 group">
                    <img 
                      src={post.images[0]} 
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                    {post.images.length > 1 && (
                      <div className="absolute top-1 right-1 bg-black/60 text-white px-1.5 py-0.5 rounded text-xs">
                        {post.images.length}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {formatDate(post._created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Map View - Shows location dots on map */}
        {viewMode === 'map' && (
          <div className="space-y-4">
            {allPosts.filter(p => p.location_uuid).length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📍</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">地図表示できる投稿がありません</h3>
                <p className="text-gray-500">場所を指定した投稿のみ地図に表示されます</p>
              </div>
            ) : (
              <>
                {/* Real Map using Leaflet */}
                <MapView 
                  posts={allPosts}
                  locations={locations}
                  onPostClick={(postId) => setSelectedMapPost(postId)}
                  selectedPostId={selectedMapPost}
                  getCategoryName={getCategoryName}
                  getCategoryColor={getCategoryColor}
                  getLocationName={getLocationName}
                  formatDate={formatDate}
                />

                {/* Location Legend */}
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold mb-2 text-sm">📍 場所一覧（最大50件）</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {allPosts.filter(p => p.location_uuid).slice(0, 50).map((post, index) => (
                      <button
                        key={post._row_id}
                        onClick={() => setSelectedMapPost(post._row_id)}
                        className={`
                          text-left p-2 rounded border text-sm transition-all
                          ${selectedMapPost === post._row_id 
                            ? 'bg-blue-100 border-blue-500' 
                            : 'bg-gray-50 hover:bg-gray-100'
                          }
                        `}
                      >
                        <div className="font-medium line-clamp-1">{post.title}</div>
                        <div className="text-xs text-gray-500">{getLocationName(post.location_uuid)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

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
      </main>

      <Footer />
    </div>
  );
};

export default Index;