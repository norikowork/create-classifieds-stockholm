import { useState, useEffect } from 'react';
import { User, Settings, Trash2, Edit, Phone, Mail, Calendar, MapPin, Camera, Upload, KeyRound, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link, useNavigate } from 'react-router-dom';
import auth from '@/lib/shared/kliv-auth';
import db from '@/lib/shared/kliv-database';
import { content } from '@/lib/shared/kliv-content';
import { useToast } from '@/hooks/use-toast';
import { PostModal } from '@/components/PostModal';
import Footer from '@/components/Footer';
import { statusLabels, postTypeLabels } from '@/constants/postLabels';

const categoryIcons = {
  'cat-for-sale': '🛍️',
  'cat-wanted': '🔍',
  'cat-job-offering': '💼',
  'cat-job-seeking': '👤',
  'cat-services': '🔧',
  'cat-housing': '🏠'
};

const Profile = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userCreatedAt, setUserCreatedAt] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    phone: '',
    county: '',
    contact_pref: 'email'
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [deletingPost, setDeletingPost] = useState(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await auth.getUser();
      if (!currentUser) {
        navigate('/');
        return;
      }
      
      setUser(currentUser);
      
      // Load locations for county dropdown
      const locationsData = await db.query('locations', { _deleted: 'eq.0' });
      setLocations(locationsData);
      
      // Load user profile
      const profiles = await db.query('user_profiles', { 
        user_uuid: `eq.${currentUser.userUuid}` 
      });
      
      if (profiles.length > 0) {
        const profile = profiles[0];
        setUserProfile(profile);
        setEditForm({
          display_name: profile.display_name || '',
          bio: profile.bio || '',
          location: profile.location || '',
          phone: profile.phone || '',
          county: profile.county || '',
          contact_pref: profile.contact_pref || 'email'
        });
      }
      
      // Load user registration date from users table
      try {
        const usersData = await db.query('users', { 
          user_uuid: `eq.${currentUser.userUuid}` 
        });
        if (usersData.length > 0) {
          setUserCreatedAt(usersData[0]._created_at);
        } else {
          // Fallback to profile creation date
          setUserCreatedAt(profiles.length > 0 ? profiles[0]._created_at : null);
        }
      } catch (userError) {
        console.warn('Could not load user registration date:', userError);
        // Fallback to profile creation date
        setUserCreatedAt(profiles.length > 0 ? profiles[0]._created_at : null);
      }
      
      // Load user posts
      const posts = await db.query('posts', { 
        _created_by: `eq.${currentUser.userUuid}`,
        status: 'neq.removed'
      });
      
      // Filter out any invalid posts and parse images
      const validPosts = posts.filter(post => post && post._row_id);
      const postsWithImages = validPosts.map(post => {
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
        return { ...post, images };
      });
      
      setUserPosts(postsWithImages.sort((a, b) => b._created_at - a._created_at));
      
      // Load unread message count
      try {
        const unreadMessages = await db.query('messages', {
          to_uuid: `eq.${currentUser.userUuid}`,
          is_read: 'eq.0',
          _deleted: 'eq.0'
        });
        setUnreadCount(unreadMessages.length);
      } catch (error) {
        console.error('Error loading unread count:', error);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      console.log('Saving profile with editForm:', editForm);
      const now = Math.floor(Date.now() / 1000);

      if (userProfile) {
        console.log('Updating existing profile:', userProfile);
        await db.update('user_profiles',
          { user_uuid: `eq.${user.userUuid}` },
          {
            ...editForm,
            last_active: now,
            _updated_at: now
          }
        );
        console.log('Profile updated successfully');
      } else {
        console.log('Creating new profile');
        await db.insert('user_profiles', {
          user_uuid: user.userUuid,
          ...editForm,
          last_active: now
        });
        console.log('Profile created successfully');
      }

      // データベースから最新のプロフィール情報を再取得
      console.log('Fetching updated profile from database...');
      const updatedProfiles = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`
      });

      console.log('Updated profiles fetched:', updatedProfiles);

      if (updatedProfiles.length > 0) {
        const updatedProfile = updatedProfiles[0];
        console.log('Setting userProfile to:', updatedProfile);
        setUserProfile(updatedProfile);
        // editFormも最新の状態に更新
        setEditForm({
          display_name: updatedProfile.display_name || '',
          bio: updatedProfile.bio || '',
          location: updatedProfile.location || '',
          phone: updatedProfile.phone || '',
          county: updatedProfile.county || '',
          contact_pref: updatedProfile.contact_pref || 'email'
        });
      }

      setIsEditing(false);

      toast({
        title: "プロフィール更新",
        description: "プロフィールが更新されました",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "エラー",
        description: "プロフィールの更新に失敗しました: " + error.message,
        variant: "destructive"
      });
    }
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // ファイルサイズチェック（1MB = 1,048,576 bytes）
    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "ファイルサイズ超過",
        description: "プロフィール写真は1MBまでです",
        variant: "destructive"
      });
      event.target.value = ''; // ファイル選択をリセット
      return;
    }

    // 画像ファイルチェック
    if (!file.type.startsWith('image/')) {
      toast({
        title: "ファイル形式エラー",
        description: "画像ファイルを選択してください",
        variant: "destructive"
      });
      event.target.value = ''; // ファイル選択をリセット
      return;
    }

    try {
      setProfilePhotoUploading(true);

      const result = await content.uploadFile(file, '/content/profile-photos/');
      const photoUrl = result.path || result.contentUrl || result.url || result.fileUrl;

      // プロフィールを更新
      const now = Math.floor(Date.now() / 1000);
      if (userProfile) {
        await db.update('user_profiles',
          { user_uuid: `eq.${user.userUuid}` },
          {
            profile_photo_url: photoUrl,
            last_active: now,
            _updated_at: now,
            contact_pref: editForm.contact_pref
          }
        );
      } else {
        await db.insert('user_profiles', {
          user_uuid: user.userUuid,
          profile_photo_url: photoUrl,
          last_active: now
        });
      }

      const updatedProfiles = await db.query('user_profiles', {
        user_uuid: `eq.${user.userUuid}`
      });

      if (updatedProfiles.length > 0) {
        setUserProfile(updatedProfiles[0]);
      }

      toast({
        title: "プロフィール写真更新",
        description: "プロフィール写真が更新されました",
      });
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      toast({
        title: "エラー",
        description: "プロフィール写真のアップロードに失敗しました: " + error.message,
        variant: "destructive"
      });
    } finally {
      setProfilePhotoUploading(false);
      event.target.value = ''; // ファイル選択をリセット
    }
  };

  const handleDeleteProfilePhoto = async () => {
    if (!window.confirm('プロフィール写真を削除しますか？')) {
      return;
    }

    try {
      const now = Math.floor(Date.now() / 1000);

      // ファイルシステムから画像ファイルを削除
      if (userProfile?.profile_photo_url) {
        try {
          // URLからファイルパスを抽出
          const photoUrl = userProfile.profile_photo_url;
          const urlParts = photoUrl.split('/content/');
          if (urlParts.length > 1) {
            const filePath = '/content/' + urlParts[1];
            await content.deleteFile(filePath);
          }
        } catch (fileError) {
          // File deletion failed - continue with DB cleanup
          // ファイルの削除に失敗しても続行（データベース参照は削除する）
        }
      }

      // データベースの参照を削除
      await db.update('user_profiles',
        { user_uuid: `eq.${user.userUuid}` },
        {
          profile_photo_url: null,
          last_active: now,
          _updated_at: now
        }
      );

      setUserProfile(prev => ({
        ...prev,
        profile_photo_url: null
      }));

      toast({
        title: "プロフィール写真削除",
        description: "プロフィール写真が削除されました",
      });
    } catch (error) {
      console.error('Error deleting profile photo:', error);
      toast({
        title: "エラー",
        description: "プロフィール写真の削除に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleDeletePost = async (postUuid) => {
    if (!window.confirm('本当にこの投稿を削除しますか？')) {
      return;
    }
    
    try {
      setDeletingPost(postUuid);
      
      // Soft delete the post
      await db.update('posts',
        { _row_id: `eq.${postUuid}` },
        { status: 'removed' }
      );
      
      setUserPosts(prev => prev.filter(post => post._row_id !== postUuid));
      
      toast({
        title: "投稿削除",
        description: "投稿が削除されました",
      });
      
      setSelectedPost(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "エラー",
        description: "投稿の削除に失敗しました",
        variant: "destructive"
      });
    } finally {
      setDeletingPost(null);
    }
  };

  const handleEditPost = (post) => {
    setEditingPost(post);
    setIsPostModalOpen(true);
  };

  const handlePostUpdated = async (updatedPost) => {
    console.log('handlePostUpdated called with:', updatedPost);
    setIsPostModalOpen(false);
    setEditingPost(null);
    
    // Refresh posts from server to ensure data consistency
    try {
      if (user) {
        console.log('Refreshing posts for user:', user.userUuid);
        const posts = await db.query('posts', { 
          _created_by: `eq.${user.userUuid}`,
          status: 'neq.removed'
        });
        
        console.log('Posts refreshed:', posts.length, 'posts');
        
        // Filter out any invalid posts and parse images
        const validPosts = posts.filter(post => post && post._row_id);
        const postsWithImages = validPosts.map(post => {
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
          return { ...post, images };
        });
        
        console.log('Setting user posts:', postsWithImages.length, 'posts');
        setUserPosts(postsWithImages.sort((a, b) => b._created_at - a._created_at));
      }
    } catch (error) {
      console.error('Error refreshing posts:', error);
    }
    
    toast({
      title: "投稿更新",
      description: "投稿が更新されました",
    });
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました",
        variant: "destructive"
      });
    }
  };

  const handlePasswordChange = async () => {
    // エラーと成功メッセージをリセット
    setPasswordError('');
    setPasswordSuccess('');

    // 入力値を取得
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('すべての項目を入力してください');
      toast({
        title: "入力エラー",
        description: "すべての項目を入力してください",
        variant: "destructive"
      });
      return;
    }

    // 新パスワードと確認が一致するかチェック
    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードと確認が一致しません');
      toast({
        title: "入力エラー",
        description: "新しいパスワードと確認が一致しません",
        variant: "destructive"
      });
      return;
    }

    // パスワード強度チェック（8文字以上）
    if (newPassword.length < 8) {
      setPasswordError('新しいパスワードは8文字以上である必要があります');
      toast({
        title: "入力エラー",
        description: "新しいパスワードは8文字以上である必要があります",
        variant: "destructive"
      });
      return;
    }

    // パスワード強度チェック（簡単な強度チェック）
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    
    if (!hasLetter || !hasNumber) {
      setPasswordError('新しいパスワードは少なくとも1つの文字と1つの数字を含む必要があります');
      toast({
        title: "入力エラー",
        description: "新しいパスワードは少なくとも1つの文字と1つの数字を含む必要があります",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsChangingPassword(true);

      // まず現在のパスワードが正しいか確認
      try {
        await auth.signIn(user.email, currentPassword);
      } catch (signInError) {
        setPasswordError('現在のパスワードが正しくありません');
        toast({
          title: "認証エラー",
          description: "現在のパスワードが正しくありません",
          variant: "destructive"
        });
        return;
      }

      // 現在のパスワードが正しければ、新しいパスワードに更新
      await auth.updateUser({ password: newPassword });

      // 成功メッセージを表示
      setPasswordSuccess('パスワードを変更しました');
      toast({
        title: "パスワード変更完了",
        description: "パスワードを変更しました",
      });

      // 入力欄をクリア
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // 3秒後に成功メッセージを消す
      setTimeout(() => {
        setPasswordSuccess('');
      }, 3000);

    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('パスワードの変更に失敗しました: ' + error.message);
      toast({
        title: "エラー",
        description: "パスワードの変更に失敗しました: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCategoryName = (categoryUuid) => {
    // This would normally come from categories data
    const categories = {
      'cat-for-sale': '売ります',
      'cat-wanted': '探しています',
      'cat-job-offering': '仕事募集',
      'cat-job-seeking': '仕事探し',
      'cat-services': 'サービス',
      'cat-housing': '住居'
    };
    return categories[categoryUuid] || '';
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'sold': 'bg-blue-100 text-blue-800',
      'expired': 'bg-yellow-100 text-yellow-800',
      'flagged': 'bg-red-100 text-red-800',
      'removed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
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
                <h1 className="text-base sm:text-xl font-bold text-gray-900 hidden sm:block">Sverige.JP</h1>
                <h1 className="text-base font-bold text-gray-900 sm:hidden">Sverige.JP</h1>
                <p className="text-xs text-gray-600 hidden md:block">スウェーデン日本コミュニティ</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="relative" onClick={() => navigate('/messages')}>
                    <Mail className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 bg-red-500 text-white text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    ログアウト
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                    ホームに戻る
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">プロフィール設定</TabsTrigger>
            <TabsTrigger value="posts">投稿管理</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6">
            {/* Profile Info */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span>基本情報</span>
                    </CardTitle>
                    <CardDescription>
                      {user.email}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? <Edit className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                    {isEditing ? 'キャンセル' : '編集'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* プロフィール写真セクション */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 mb-4">
                      {userProfile?.profile_photo_url ? (
                        <img
                          src={userProfile.profile_photo_url}
                          alt="プロフィール写真"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {isEditing && (
                      <div className="absolute bottom-4 right-0 flex space-x-2">
                        <Label 
                          htmlFor="profile-photo-upload" 
                          className="cursor-pointer bg-white rounded-full p-2 shadow-md border border-gray-200 hover:bg-gray-50"
                        >
                          <Upload className="w-4 h-4 text-gray-600" />
                          <Input
                            id="profile-photo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            disabled={profilePhotoUploading}
                            className="hidden"
                          />
                        </Label>
                        {userProfile?.profile_photo_url && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-full p-2 h-auto w-auto"
                            onClick={handleDeleteProfilePhoto}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {profilePhotoUploading && (
                    <p className="text-sm text-blue-600">アップロード中...</p>
                  )}
                  {isEditing && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      プロフィール写真（1MBまで）
                    </p>
                  )}
                </div>

                {!isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">表示名</label>
                      <p className="text-lg">{userProfile?.display_name || '未設定'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">自己紹介</label>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {userProfile?.bio || '未設定'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center">
                          <Phone className="w-4 h-4 mr-1" />
                          電話番号
                        </label>
                        <p>{userProfile?.phone || '未設定'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          県
                        </label>
                        <p>{userProfile?.county || '未設定'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        連絡の受け取り方
                      </label>
                      <p>
                        {userProfile?.contact_pref === 'dm_only' ? (
                          <span>サイト内メッセージのみ（メール非公開）</span>
                        ) : (
                          <span>メールで受け取る（おすすめ）</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        詳細住所
                      </label>
                      <p>{userProfile?.location || '未設定'}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-4">
                    <div>
                      <Label htmlFor="display_name">表示名</Label>
                      <Input
                        id="display_name"
                        value={editForm.display_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                        placeholder="表示名"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bio">自己紹介</Label>
                      <Textarea
                        id="bio"
                        value={editForm.bio}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="自己紹介を入力してください"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">電話番号</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="070-123-4567"
                        />
                      </div>
                      <div>
                        <Label htmlFor="county">県 *</Label>
                        <Select 
                          value={editForm.county} 
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, county: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="県を選択してください" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(new Set(locations.map((loc: any) => loc.county)))
                              .sort((a, b) => {
                                if (a === 'Other') return 1;
                                if (b === 'Other') return -1;
                                return a.localeCompare(b);
                              })
                              .map((county) => (
                                <SelectItem key={county} value={county}>
                                  {county}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="contact_pref">連絡の受け取り方</Label>
                      <Select 
                        value={editForm.contact_pref} 
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, contact_pref: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="連絡の受け取り方を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">
                            <div className="flex flex-col">
                              <span className="font-medium">メールで受け取る（おすすめ）</span>
                              <span className="text-xs text-gray-500">あなたの投稿への連絡を、サイト内メッセージとメールの両方で受け取れます</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="dm_only">
                            <div className="flex flex-col">
                              <span className="font-medium">メールを隠す（サイト内メッセージのみ）</span>
                              <span className="text-xs text-gray-500">メールアドレスを相手に知られず、サイト内メッセージだけで連絡を受け取ります。信用できたら相手に個別でメールアドレスを伝えられます</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="location">詳細住所</Label>
                      <Input
                        id="location"
                        value={editForm.location}
                        onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="地区や通りなど"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button type="submit">保存</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Password Change Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <KeyRound className="w-5 h-5" />
                  <span>パスワード変更</span>
                </CardTitle>
                <CardDescription>
                  セキュリティのため、定期的にパスワードを変更することをおすすめします
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* エラーメッセージ */}
                  {passwordError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  {/* 成功メッセージ */}
                  {passwordSuccess && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">{passwordSuccess}</AlertDescription>
                    </Alert>
                  )}

                  {/* パスワード変更フォーム */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">現在のパスワード</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="現在のパスワードを入力"
                        disabled={isChangingPassword}
                      />
                    </div>

                    <div>
                      <Label htmlFor="new-password">新しいパスワード</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="新しいパスワードを入力（8文字以上）"
                        disabled={isChangingPassword}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        ※ 8文字以上、文字と数字を含める必要があります
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="新しいパスワードを再入力"
                        disabled={isChangingPassword}
                      />
                    </div>

                    <Button
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword}
                      className="w-full"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          変更中...
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 h-4 w-4" />
                          変更する
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {user && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>アカウント設定</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">登録日</p>
                        <p className="text-sm text-gray-600">
                          {userCreatedAt ? formatDate(userCreatedAt) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <Button 
                        variant="destructive" 
                        onClick={() => auth.signOut().then(() => navigate('/'))}
                      >
                        ログアウト
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="posts" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">投稿した広告</h2>
              <Button onClick={() => { setEditingPost(null); setIsPostModalOpen(true); }}>
                新規投稿
              </Button>
            </div>
            
            {userPosts.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">投稿はありません</h3>
                    <p className="text-gray-500 mb-4">最初の投稿を作成しましょう</p>
                    <Button onClick={() => { setEditingPost(null); setIsPostModalOpen(true); }}>
                      投稿する
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userPosts.filter(post => post && post._row_id).map((post) => (
                  <Card key={post._row_id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">
                            {post.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <Badge variant="secondary" className="mr-2">
                              {categoryIcons[post.category_uuid]} {getCategoryName(post.category_uuid)}
                            </Badge>
                            <Badge variant="secondary" className="mr-2 text-gray-600">
                              {postTypeLabels[post.post_type]}
                            </Badge>
                            <Badge className={getStatusColor(post.status)}>
                              {statusLabels[post.status] ?? post.status}
                            </Badge>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {post.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(post._created_at)}
                            </span>
                            {post.price && (
                              <span className="font-semibold text-green-600">{post.price}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPost(post)}
                          >
                            詳細
                          </Button>
                          {post.status === 'active' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleEditPost(post)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                編集
                              </Button>
                            </>
                          )}
                          {post.status === 'active' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeletePost(post._row_id)}
                              disabled={deletingPost === post._row_id}
                            >
                              {deletingPost === post._row_id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Post Detail Modal */}
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>投稿詳細</DialogTitle>
            </DialogHeader>
            {selectedPost && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedPost.title}</h3>
                  <div className="flex space-x-2 mt-2">
                    <Badge variant="secondary">
                      {categoryIcons[selectedPost.category_uuid]} {getCategoryName(selectedPost.category_uuid)}
                    </Badge>
                    <Badge variant="secondary" className="text-gray-600">
                      {postTypeLabels[selectedPost.post_type]}
                    </Badge>
                    <Badge className={getStatusColor(selectedPost.status)}>
                      {statusLabels[selectedPost.status] ?? selectedPost.status}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">詳細説明</h4>
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {selectedPost.description}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPost.price && (
                    <div>
                      <h4 className="font-medium mb-1">価格</h4>
                      <p className="text-green-600 font-semibold">{selectedPost.price}</p>
                    </div>
                  )}
                  {selectedPost.location && (
                    <div>
                      <h4 className="font-medium mb-1">場所</h4>
                      <p>{selectedPost.location}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium mb-1">連絡方法</h4>
                    <p>
                      {selectedPost.contact_method === 'email' ? 'メール' : 
                       selectedPost.contact_method === 'phone' ? '電話' : '両方'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">連絡先</h4>
                    <p>{selectedPost.email}</p>
                    {selectedPost.phone && <p>{selectedPost.phone}</p>}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 pt-4 border-t">
                  投稿日時: {formatDate(selectedPost._created_at)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Post Modal for editing */}
        <PostModal
          isOpen={isPostModalOpen}
          onClose={() => {
            setIsPostModalOpen(false);
            setEditingPost(null);
          }}
          onPostCreated={handlePostUpdated}
          user={user}
          editingPost={editingPost}
        />
      </main>

      <Footer />
    </div>
  );
};

export default Profile;