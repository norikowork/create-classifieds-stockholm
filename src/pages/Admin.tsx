import { useState, useEffect } from 'react';
import { Shield, Users, FileText, AlertTriangle, Ban, Check, X, Eye, Search, Filter, Trash, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import auth from '@/lib/shared/kliv-auth';
import db from '@/lib/shared/kliv-database';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { PostModal } from '@/components/PostModal';
import Footer from '@/components/Footer';

const categoryIcons = {
  'cat-sell': '🛍️',
  'cat-wanted': '🔍',
  'cat-job': '💼',
  'cat-housing': '🏠',
  'cat-event': '📅'
};

const postTypeLabels = {
  'free': '無料',
  'paid': '有料',
  'donation': '寄付'
};

const statusLabels = {
  'active': '公開中',
  'sold': '完了',
  'expired': '期限切れ',
  'flagged': '報告済み',
  'removed': '削除'
};

const ADMIN_EMAIL = 'admin@example.com';

const Admin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [flaggedPosts, setFlaggedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [postFilter, setPostFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [editingPost, setEditingPost] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    flaggedPosts: 0,
    blockedUsers: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const currentUser = await auth.getUser();
      
      if (!currentUser) {
        navigate('/');
        return;
      }
      
      if (!currentUser.isPrimaryOrg) {
        navigate('/');
        return;
      }
      
      setUser(currentUser);
      setIsAdmin(true);
      await loadAdminData();
    } catch (error) {
      console.error('Admin access check failed:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const [users, posts, flagged, categoriesData] = await Promise.all([
        db.query('users', { _deleted: 'eq.0' }),
        db.query('posts', { _deleted: 'eq.0', order: '_created_at.desc' }),
        db.query('posts', { status: 'eq.flagged', order: '_created_at.desc' }),
        db.query('categories', { _deleted: 'eq.0' })
      ]);
      
      setAllUsers(users);
      setAllPosts(posts);
      setFlaggedPosts(flagged);
      setCategories(categoriesData);
      
      // Calculate stats
      const blockedCount = users.filter(u => u.user_metadata?.blocked).length;
      setStats({
        totalUsers: users.length,
        totalPosts: posts.length,
        flaggedPosts: flagged.length,
        blockedUsers: blockedCount
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast({
        title: "データ読み込みエラー",
        description: "管理データの読み込みに失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleDeleteImage = async (postRowId, imageUrl) => {
    try {
      const post = allPosts.find(p => p._row_id === postRowId);
      if (!post) return;
      
      let images = [];
      if (post.images) {
        try {
          images = JSON.parse(post.images);
        } catch (e) {
          images = [];
        }
      }
      
      images = images.filter(img => img !== imageUrl);
      
      await db.update('posts',
        { _row_id: `eq.${postRowId}` },
        { 
          images: JSON.stringify(images),
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "画像削除完了",
        description: "画像が削除されました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: "エラー",
        description: "画像の削除に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async (userUuid) => {
    try {
      await db.update('users',
        { user_uuid: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      await db.update('user_profiles',
        { user_uuid: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      await db.update('posts',
        { _created_by: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      toast({
        title: "ユーザー削除完了",
        description: "ユーザーと関連投稿が削除されました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "エラー",
        description: "ユーザーの削除に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleBlockUser = async (userUuid) => {
    try {
      await db.update('users',
        { user_uuid: `eq.${userUuid}` },
        { 
          user_metadata: JSON.stringify({ ...allUsers.find(u => u.user_uuid === userUuid)?.user_metadata, blocked: true }),
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "ユーザーブロック完了",
        description: "ユーザーがブロックされました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "エラー",
        description: "ユーザーのブロックに失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleUnblockUser = async (userUuid) => {
    try {
      const userData = allUsers.find(u => u.user_uuid === userUuid);
      const metadata = { ...userData?.user_metadata, blocked: false };
      
      await db.update('users',
        { user_uuid: `eq.${userUuid}` },
        { 
          user_metadata: JSON.stringify(metadata),
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "ユーザーブロック解除完了",
        description: "ユーザーのブロックが解除されました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast({
        title: "エラー",
        description: "ユーザーのブロック解除に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleUpdatePost = async (postId, updates) => {
    try {
      await db.update('posts',
        { _row_id: `eq.${postId}` },
        { 
          ...updates,
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "投稿更新完了",
        description: "投稿が更新されました",
      });
      
      setEditingPost(null);
      loadAdminData();
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "エラー",
        description: "投稿の更新に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleDeletePost = async (postId) => {
    console.log('🔥 Deleting post with ID:', postId);
    try {
      console.log('🔥 Calling db.delete...');
      const result = await db.delete('posts', { _row_id: `eq.${postId}` });
      console.log('🔥 Delete result:', result);
      
      toast({
        title: "投稿削除完了",
        description: "投稿が削除されました",
      });
      
      setSelectedPost(null);
      console.log('🔥 Reloading admin data...');
      loadAdminData();
    } catch (error) {
      console.error('🔥 Error deleting post:', error);
      toast({
        title: "エラー",
        description: "投稿の削除に失敗しました: " + (error?.message || 'Unknown error'),
        variant: "destructive"
      });
    }
  };

  const filteredPosts = () => {
    let filtered = [...allPosts];
    
    if (searchTerm) {
      filtered = filtered.filter(post => 
        post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (postFilter !== 'all') {
      filtered = filtered.filter(post => post.status === postFilter);
    }
    
    return filtered;
  };

  const filteredUsers = () => {
    let filtered = [...allUsers];
    
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (userFilter === 'blocked') {
      filtered = filtered.filter(user => user.user_metadata?.blocked);
    } else if (userFilter === 'active') {
      filtered = filtered.filter(user => !user.user_metadata?.blocked);
    }
    
    return filtered;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '不明';
    return new Date(timestamp * 1000).toLocaleDateString('ja-JP');
  };

  const getCategoryName = (categoryUuid) => {
    const category = categories.find(cat => cat._row_id === categoryUuid || cat.uuid === categoryUuid);
    return category ? category.name : '未分類';
  };

  const handleCreateCategory = async () => {
    try {
      if (!newCategory.name.trim()) {
        toast({
          title: "エラー",
          description: "カテゴリ名を入力してください",
          variant: "destructive"
        });
        return;
      }

      const categoryData = {
        name: newCategory.name,
        description: newCategory.description,
        _created_at: Math.floor(Date.now() / 1000)
      };

      await db.insert('categories', categoryData);
      
      toast({
        title: "カテゴリ作成完了",
        description: "新しいカテゴリが作成されました",
      });
      
      setIsCategoryModalOpen(false);
      setNewCategory({ name: '', description: '' });
      loadAdminData();
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "エラー",
        description: "カテゴリの作成に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await db.update('categories',
        { uuid: `eq.${categoryId}` },
        { _deleted: 1 }
      );
      
      toast({
        title: "カテゴリ削除完了",
        description: "カテゴリが削除されました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "エラー",
        description: "カテゴリの削除に失敗しました",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            管理者権限が必要です
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">管理者パネル</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.email}
              </span>
              <Button variant="outline" onClick={() => navigate('/')}>
                サイトに戻る
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">総ユーザー数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">総投稿数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">報告済み投稿</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.flaggedPosts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">ブロック済みユーザー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.blockedUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="posts">投稿管理</TabsTrigger>
            <TabsTrigger value="users">ユーザー管理</TabsTrigger>
            <TabsTrigger value="categories">カテゴリ管理</TabsTrigger>
            <TabsTrigger value="flagged">報告済み</TabsTrigger>
          </TabsList>

          <TabsContent value="posts">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>投稿管理</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Select value={postFilter} onValueChange={setPostFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="active">公開中</SelectItem>
                        <SelectItem value="sold">完了</SelectItem>
                        <SelectItem value="expired">期限切れ</SelectItem>
                        <SelectItem value="flagged">報告済み</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredPosts().map((post) => (
                    <div key={post._row_id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{post.title}</h3>
                          <p className="text-gray-600 text-sm mb-2">{post.description?.substring(0, 100)}...</p>
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline">
                              {categoryIcons[post.category_uuid || post.category || '']} {getCategoryName(post.category_uuid || post.category)}
                            </Badge>
                            <Badge variant={post.status === 'active' ? 'default' : 'secondary'}>
                              {statusLabels[post.status] || post.status}
                            </Badge>
                            <Badge variant="outline">
                              投稿ID: {post._row_id}
                            </Badge>
                            <Badge variant="outline">
                              投稿者ID: {post._created_by?.substring(0, 8)}...
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            投稿日: {formatDate(post._created_at)}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingPost(post);
                              setIsEditModalOpen(true);
                            }}
                          >
                            編集
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePost(post._row_id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Images */}
                      {post.images && JSON.parse(post.images).length > 0 && (
                        <div className="flex space-x-2 mt-3">
                          {JSON.parse(post.images).map((image, index) => (
                            <div key={index} className="relative group">
                              <img 
                                src={image + '?w=100&h=100'} 
                                alt={`Image ${index + 1}`}
                                className="w-24 h-24 object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteImage(post._row_id, image)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>ユーザー管理</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="active">アクティブ</SelectItem>
                        <SelectItem value="blocked">ブロック済み</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers().map((userItem) => (
                    <div key={userItem.user_uuid} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">
                            {userItem.first_name} {userItem.last_name}
                          </h3>
                          <p className="text-gray-600">{userItem.email}</p>
                          <p className="text-xs text-gray-500">
                            登録日: {formatDate(userItem._created_at)}
                          </p>
                          {userItem.user_metadata?.blocked && (
                            <Badge variant="destructive" className="mt-2">
                              ブロック済み
                            </Badge>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(userItem.user_uuid)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>カテゴリ管理</CardTitle>
                  <Button 
                    onClick={() => {
                      setNewCategory({ name: '', description: '' });
                      setIsCategoryModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新規カテゴリ
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categories.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      カテゴリがありません
                    </p>
                  ) : (
                    categories.map((category) => (
                      <div key={category.uuid} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold">{category.name}</h3>
                            <p className="text-gray-600 text-sm">{category.description}</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.uuid)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flagged">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                  報告済み投稿
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {flaggedPosts.map((post) => (
                    <div key={post._row_id} className="border rounded-lg p-4 border-orange-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-orange-800">{post.title}</h3>
                          <p className="text-gray-600 text-sm mb-2">{post.description?.substring(0, 100)}...</p>
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline">
                              {categoryIcons[post.category_uuid || post.category || '']} {getCategoryName(post.category_uuid || post.category)}
                            </Badge>
                            <Badge className="bg-orange-100 text-orange-800">
                              報告済み
                            </Badge>
                            <Badge variant="outline">
                              投稿者ID: {post._created_by?.substring(0, 8)}...
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            投稿日: {formatDate(post._created_at)}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePost(post._row_id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {flaggedPosts.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      報告済み投稿はありません
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Post Detail Modal */}
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>投稿詳細</DialogTitle>
            </DialogHeader>
            {selectedPost && (
              <div className="space-y-4">
                <div>
                  <Label>タイトル</Label>
                  <Input 
                    value={selectedPost.title}
                    onChange={(e) => setSelectedPost({...selectedPost, title: e.target.value})}
                  />
                </div>
                <div>
                  <Label>説明</Label>
                  <Textarea 
                    value={selectedPost.description}
                    onChange={(e) => setSelectedPost({...selectedPost, description: e.target.value})}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>ステータス</Label>
                  <Select 
                    value={selectedPost.status} 
                    onValueChange={(value) => setSelectedPost({...selectedPost, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">公開中</SelectItem>
                      <SelectItem value="sold">完了</SelectItem>
                      <SelectItem value="expired">期限切れ</SelectItem>
                      <SelectItem value="flagged">報告済み</SelectItem>
                      <SelectItem value="removed">削除</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedPost.images && JSON.parse(selectedPost.images).length > 0 && (
                  <div>
                    <Label>画像</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {JSON.parse(selectedPost.images).map((image, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={image + '?w=200&h=200'} 
                            alt={`Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1"
                            onClick={() => handleDeleteImage(selectedPost._row_id, image)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSelectedPost(null)}>
                    キャンセル
                  </Button>
                  <Button onClick={() => handleUpdatePost(selectedPost._row_id, selectedPost)}>
                    保存
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDeletePost(selectedPost._row_id)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* User Detail Modal */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>ユーザー詳細</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div>
                  <p><strong>名前:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                  <p><strong>メール:</strong> {selectedUser.email}</p>
                  <p><strong>登録日:</strong> {formatDate(selectedUser._created_at)}</p>
                  {selectedUser.user_metadata?.blocked && (
                    <Badge variant="destructive" className="mt-2">
                      ブロック済み
                    </Badge>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  {selectedUser.user_metadata?.blocked ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleUnblockUser(selectedUser.user_uuid);
                        setSelectedUser(null);
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      ブロック解除
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleBlockUser(selectedUser.user_uuid);
                        setSelectedUser(null);
                      }}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      ブロック
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDeleteUser(selectedUser.user_uuid);
                      setSelectedUser(null);
                    }}
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    完全削除
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedUser(null)}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Post Modal */}
        <PostModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPost(null);
          }}
          onPostCreated={() => {
            loadAdminData();
            setIsEditModalOpen(false);
            setEditingPost(null);
          }}
          user={user ? {...user, userMetadata: {is_admin: true}} : null}
          editingPost={editingPost}
        />

        {/* Category Modal */}
        <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新規カテゴリ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="categoryName">カテゴリ名 *</Label>
                <Input
                  id="categoryName"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="カテゴリ名を入力"
                />
              </div>
              <div>
                <Label htmlFor="categoryDescription">説明</Label>
                <Textarea
                  id="categoryDescription"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                  placeholder="カテゴリの説明（任意）"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleCreateCategory}>
                  作成
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
};

export default Admin;