import { useState, useEffect } from 'react';
import { Shield, Users, FileText, AlertTriangle, Ban, Check, X, Eye, Search, Filter, Trash, Plus, Edit, CheckCircle, Clock, Download, Package, Mail } from 'lucide-react';
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
import { checkIsAdmin } from '@/lib/isAdmin';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { PostModal } from '@/components/PostModal';
import Footer from '@/components/Footer';
import { statusLabels } from '@/constants/postLabels';
import JSZip from 'jszip';

const categoryIcons = {
  'cat-sell': '🛍️',
  'cat-wanted': '🔍',
  'cat-job': '💼',
  'cat-housing': '🏠',
  'cat-event': '📅'
};

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
  const [editingUser, setEditingUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    display_name: '',
    email: '',
    role: 'user',
    is_blocked: false
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    flaggedPosts: 0,
    blockedUsers: 0
  });
  const [isVerifyingEmails, setIsVerifyingEmails] = useState(false);
  const [testEmail, setTestEmail] = useState('noriko@rational.ventures');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResults, setEmailTestResults] = useState<string>('');
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
      
      // 統一された管理者判定関数を使用
      const isAdminUser = await checkIsAdmin(currentUser);
      
      if (!isAdminUser) {
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
      // 認証ユーザー一覧を取得
      const authResult = await auth.listUsers();
      const authUsers = Array.isArray(authResult) ? authResult : (authResult?.data || []);
      
      // user_profilesを取得
      const userProfiles = await db.query('user_profiles', { _deleted: 'eq.0' });
      
      // 投稿、カテゴリも取得
      const [posts, flagged, categoriesData] = await Promise.all([
        db.query('posts', { _deleted: 'eq.0', order: '_created_at.desc' }),
        db.query('posts', { status: 'eq.flagged', order: '_created_at.desc' }),
        db.query('categories', { _deleted: 'eq.0' })
      ]);
      
      // 認証ユーザーを基準にユーザーリストを作成
      const mergedUsers = authUsers.map(authUser => {
        const profile = userProfiles.find(p => p.user_uuid === authUser.userUuid);
        
        return {
          user_uuid: authUser.userUuid,
          email: authUser.email || (profile?.email || ''),
          display_name: profile?.display_name || authUser.firstName || authUser.email || '不明',
          role: profile?.role || 'user',
          is_blocked: profile?.is_blocked || 0,
          plan: profile?.plan || 'free',
          emailVerified: authUser.emailVerified || false,
          profile_exists: !!profile,
          _created_at: profile?._created_at || null,
          _updated_at: profile?._updated_at || null,
          _row_id: profile?._row_id || null,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          teamUuid: authUser.teamUuid,
          isPrimaryTeam: authUser.isPrimaryTeam,
          groups: authUser.groups || []
        };
      });
      
      // 認証ユーザーにいないがuser_profilesにある行を追加
      const profileOnlyUsers = userProfiles.filter(profile => 
        !authUsers.find(authUser => authUser.userUuid === profile.user_uuid)
      ).map(profile => ({
        user_uuid: profile.user_uuid,
        email: profile.email || '',
        display_name: profile.display_name || profile.email || '不明',
        role: profile.role || 'user',
        is_blocked: profile.is_blocked || 0,
        plan: profile.plan || 'free',
        emailVerified: false,
        profile_exists: true,
        _created_at: profile._created_at,
        _updated_at: profile._updated_at,
        _row_id: profile._row_id,
        firstName: profile.email?.split('@')[0] || '',
        lastName: '',
        teamUuid: null,
        isPrimaryTeam: false,
        groups: []
      }));
      
      // マージしたユーザーリスト
      const allUsersList = [...mergedUsers, ...profileOnlyUsers];
      setAllUsers(allUsersList);
      
      // Add creator display name to posts
      const postsWithCreatorNames = posts.map(post => {
        const creatorProfile = allUsersList.find(user => user.user_uuid === post._created_by);
        const displayName = creatorProfile?.display_name || '不明';
        
        return {
          ...post,
          creatorDisplayName: displayName
        };
      });
      
      // Add creator display name to flagged posts
      const flaggedWithCreatorNames = flagged.map(post => {
        const creatorProfile = allUsersList.find(user => user.user_uuid === post._created_by);
        const displayName = creatorProfile?.display_name || '不明';
        
        return {
          ...post,
          creatorDisplayName: displayName
        };
      });
      
      setAllPosts(postsWithCreatorNames);
      setFlaggedPosts(flaggedWithCreatorNames);
      setCategories(categoriesData);
      
      // Calculate stats - マージ後のリストを使用
      const blockedCount = allUsersList.filter(u => u.is_blocked === 1).length;
      setStats({
        totalUsers: allUsersList.length,
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

  const handleBackupAllData = async () => {
    try {
      toast({
        title: "バックアップ中...",
        description: "全データを取得中です",
      });

      // 全テーブルを取得（_deletedで絞らず、削除済みも含めて全件）
      const [
        usersData,
        userProfilesData,
        postsData,
        categoriesData,
        subcategoriesData,
        locationsData,
        forumTopicsData,
        forumRepliesData,
        messagesData
      ] = await Promise.all([
        // usersは読み取りのみ（認証システムテーブル）
        db.query('users', {}).catch(e => {
          console.warn('Failed to fetch users:', e);
          return [];
        }),
        db.query('user_profiles', {}),
        db.query('posts', {}),
        db.query('categories', {}),
        db.query('subcategories', {}),
        db.query('locations', {}),
        db.query('forum_topics', {}),
        db.query('forum_replies', {}),
        db.query('messages', {})
      ]);

      // 画像ファイルを収集（重複を除く）
      const imageFilesSet = new Set<string>();

      // posts の images を収集
      postsData.forEach(post => {
        if (post.images) {
          try {
            const images = typeof post.images === 'string' ? JSON.parse(post.images) : post.images;
            if (Array.isArray(images)) {
              images.forEach(img => {
                if (img && typeof img === 'string') {
                  imageFilesSet.add(img);
                }
              });
            }
          } catch (e) {
            console.warn('Failed to parse images for post:', post._row_id, e);
          }
        }
      });

      // user_profiles の profile_photo_url を収集
      userProfilesData.forEach(profile => {
        if (profile.profile_photo_url && typeof profile.profile_photo_url === 'string') {
          imageFilesSet.add(profile.profile_photo_url);
        }
      });

      // Set を配列に変換してソート
      const imageFiles = Array.from(imageFilesSet).sort();

      // バックアップデータを構造化
      const backupData = {
        exported_at: new Date().toISOString(),
        version: '1.0',
        tables: {
          users: usersData,
          user_profiles: userProfilesData,
          posts: postsData,
          categories: categoriesData,
          subcategories: subcategoriesData,
          locations: locationsData,
          forum_topics: forumTopicsData,
          forum_replies: forumRepliesData,
          messages: messagesData
        },
        image_files: imageFiles,
        stats: {
          total_users: usersData.length,
          total_user_profiles: userProfilesData.length,
          total_posts: postsData.length,
          total_categories: categoriesData.length,
          total_subcategories: subcategoriesData.length,
          total_locations: locationsData.length,
          total_forum_topics: forumTopicsData.length,
          total_forum_replies: forumRepliesData.length,
          total_messages: messagesData.length,
          total_image_files: imageFiles.length
        }
      };

      // UTF-8 with BOM でJSONファイルとしてダウンロード
      const jsonString = JSON.stringify(backupData, null, 2);
      // BOM (Byte Order Mark) を追加して UTF-8 を明示
      const bom = '\uFEFF';
      const blob = new Blob([bom + jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      link.href = url;
      link.download = `sverige-jp-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "バックアップ完了",
        description: `バックアップをダウンロードしました（${imageFiles.length}件の画像ファイルを含む）`,
      });
    } catch (error) {
      console.error('Backup failed:', error);
      toast({
        title: "バックアップエラー",
        description: `エラーが発生しました: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDownloadAllImages = async () => {
    try {
      toast({
        title: "画像ダウンロード中...",
        description: "画像ファイルを収集中です",
      });

      // 全データを取得して画像ファイルを収集
      const [userProfilesData, postsData] = await Promise.all([
        db.query('user_profiles', {}),
        db.query('posts', {})
      ]);

      // user_profiles を Map に変換（user_uuid -> profile）
      const userProfileMap = new Map<string, any>();
      userProfilesData.forEach(profile => {
        if (profile.user_uuid) {
          userProfileMap.set(profile.user_uuid, profile);
        }
      });

      // 画像ファイル情報を収集（メタデータ付き）
      const postImages: Array<{url: string, post: any}> = [];
      const profileImages: Array<{url: string, profile: any}> = [];

      // posts の images を収集
      postsData.forEach(post => {
        if (post.images) {
          try {
            const images = typeof post.images === 'string' ? JSON.parse(post.images) : post.images;
            if (Array.isArray(images)) {
              images.forEach(img => {
                if (img && typeof img === 'string' && img.startsWith('/content/')) {
                  postImages.push({ url: img, post });
                }
              });
            }
          } catch (e) {
            console.warn('Failed to parse images for post:', post._row_id, e);
          }
        }
      });

      // user_profiles の profile_photo_url を収集
      userProfilesData.forEach(profile => {
        if (profile.profile_photo_url && typeof profile.profile_photo_url === 'string' && profile.profile_photo_url.startsWith('/content/')) {
          profileImages.push({ url: profile.profile_photo_url, profile });
        }
      });

      const totalImages = postImages.length + profileImages.length;
      
      if (totalImages === 0) {
        toast({
          title: "画像なし",
          description: "ダウンロード対象の画像ファイルがありません",
        });
        return;
      }

      toast({
        title: "画像ダウンロード中...",
        description: `${totalImages}件中0件をダウンロード中...`,
      });

      // ファイル名をサニタイズする関数
      const sanitizeFileName = (name: string): string => {
        // ファイル名に使えない文字を _ に置換
        let sanitized = name.replace(/[\/\\:*?"<>|]/g, '_');
        // 空白も _ に置換
        sanitized = sanitized.replace(/\s+/g, '_');
        // 長すぎる場合は短縮（最大80文字）
        if (sanitized.length > 80) {
          sanitized = sanitized.substring(0, 80);
        }
        return sanitized;
      };

      // 日付をフォーマットする関数
      const formatDate = (timestamp: string): string => {
        if (!timestamp) return 'unknown-date';
        try {
          const date = new Date(timestamp);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } catch {
          return 'unknown-date';
        }
      };

      // 読みやすい日時をフォーマットする関数
      const formatDateTime = (timestamp: string): string => {
        if (!timestamp) return '不明';
        try {
          const date = new Date(timestamp);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } catch {
          return '不明';
        }
      };

      // ZIPファイルを作成
      const zip = new JSZip();
      const metadata: any = {
        exported_at: new Date().toISOString(),
        total_images: totalImages,
        images: []
      };

      let downloadedCount = 0;
      let failedCount = 0;
      const usedFileNames = new Set<string>();

      // 投稿画像をダウンロードしてZIPに追加
      for (let i = 0; i < postImages.length; i++) {
        const { url, post } = postImages[i];
        
        try {
          // 画像をフェッチ
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`Failed to fetch image: ${url} (status: ${response.status})`);
            failedCount++;
            continue;
          }

          const blob = await response.blob();
          
          // 投稿者情報を取得
          const userProfile = userProfileMap.get(post._created_by);
          const displayName = userProfile?.display_name || post._created_by;
          
          // ファイル名を生成
          const postDate = formatDate(post._created_at);
          const originalFileName = url.split('/').pop() || 'image';
          const sanitizedName = sanitizeFileName(originalFileName);
          let fileName = `${postDate}_post${post._row_id}_${displayName}_${sanitizedName}`;
          
          // 同名衝突を回避
          let finalFileName = fileName;
          let counter = 1;
          while (usedFileNames.has(finalFileName)) {
            finalFileName = `${fileName}_${counter}`;
            counter++;
          }
          usedFileNames.add(finalFileName);

          // ZIPに追加（posts/ フォルダ）
          zip.file(`posts/${finalFileName}`, blob);
          
          // メタデータを追加
          metadata.images.push({
            file: `posts/${finalFileName}`,
            original_path: url,
            source: 'post',
            post_id: post._row_id,
            post_title: post.title,
            post_created_by: displayName,
            post_created_at: formatDateTime(post._created_at),
            post_uuid: post._created_by
          });
          
          downloadedCount++;
          
          // 進捗を更新（10件ごと）
          if (downloadedCount % 10 === 0) {
            toast({
              title: "画像ダウンロード中...",
              description: `${totalImages}件中${downloadedCount}件をダウンロード中...`,
            });
          }
        } catch (error) {
          console.warn(`Failed to download image: ${url}`, error);
          failedCount++;
        }
      }

      // プロフィール画像をダウンロードしてZIPに追加
      for (let i = 0; i < profileImages.length; i++) {
        const { url, profile } = profileImages[i];
        
        try {
          // 画像をフェッチ
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`Failed to fetch image: ${url} (status: ${response.status})`);
            failedCount++;
            continue;
          }

          const blob = await response.blob();
          
          // ファイル名を生成
          const profileDate = formatDate(profile._updated_at || profile._created_at);
          const displayName = profile.display_name || profile.user_uuid;
          const originalFileName = url.split('/').pop() || 'image';
          const sanitizedName = sanitizeFileName(originalFileName);
          let fileName = `${profileDate}_${displayName}_${sanitizedName}`;
          
          // 同名衝突を回避
          let finalFileName = fileName;
          let counter = 1;
          while (usedFileNames.has(finalFileName)) {
            finalFileName = `${fileName}_${counter}`;
            counter++;
          }
          usedFileNames.add(finalFileName);

          // ZIPに追加（profiles/ フォルダ）
          zip.file(`profiles/${finalFileName}`, blob);
          
          // メタデータを追加
          metadata.images.push({
            file: `profiles/${finalFileName}`,
            original_path: url,
            source: 'user_profile',
            user_uuid: profile.user_uuid,
            display_name: profile.display_name || profile.user_uuid,
            email: profile.email || '',
            profile_updated_at: formatDateTime(profile._updated_at || profile._created_at)
          });
          
          downloadedCount++;
          
          // 進捗を更新（10件ごと）
          if (downloadedCount % 10 === 0) {
            toast({
              title: "画像ダウンロード中...",
              description: `${totalImages}件中${downloadedCount}件をダウンロード中...`,
            });
          }
        } catch (error) {
          console.warn(`Failed to download image: ${url}`, error);
          failedCount++;
        }
      }

      // メタデータJSONをZIPに追加（UTF-8 with BOM）
      const metadataJson = JSON.stringify(metadata, null, 2);
      const bom = '\uFEFF';
      const metadataBlob = new Blob([bom + metadataJson], { type: 'application/json;charset=utf-8' });
      zip.file('metadata.json', metadataBlob);

      // ZIPファイルを生成
      toast({
        title: "ZIPファイル作成中...",
        description: "アーカイブを作成中です...",
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // ダウンロード
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      link.href = url;
      link.download = `sverige-jp-images-${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "ダウンロード完了",
        description: `${totalImages}件中${downloadedCount}件を保存、${failedCount}件は取得できませんでした（メタデータを含む）`,
      });
    } catch (error) {
      console.error('Image download failed:', error);
      toast({
        title: "ダウンロードエラー",
        description: `エラーが発生しました: ${error.message}`,
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
      // ユーザープロフィールを削除
      await db.update('user_profiles',
        { user_uuid: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      // ユーザーの投稿を削除
      await db.update('posts',
        { _created_by: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      // ユーザーの掲示板トピックを削除
      await db.update('forum_topics',
        { _created_by: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      // ユーザーの掲示板返信を削除
      await db.update('forum_replies',
        { _created_by: `eq.${userUuid}` },
        { _deleted: 1 }
      );
      
      toast({
        title: "ユーザー削除完了",
        description: "ユーザーと関連データ（投稿、掲示板、プロフィール）が削除されました",
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
      // 対象ユーザーのuser_profiles行を確認
      const targetUser = allUsers.find(u => u.user_uuid === userUuid);
      if (!targetUser) {
        throw new Error('ユーザーが見つかりません');
      }
      
      // user_profiles行がない場合は作成
      if (!targetUser.profile_exists) {
        await db.insert('user_profiles', {
          user_uuid: userUuid,
          email: targetUser.email,
          display_name: targetUser.display_name || targetUser.email,
          role: targetUser.role || 'user',
          is_blocked: 1,
          plan: targetUser.plan || 'free',
          _created_at: Math.floor(Date.now() / 1000),
          _updated_at: Math.floor(Date.now() / 1000)
        });
      } else {
        // 既存のuser_profiles行を更新
        await db.update('user_profiles',
          { user_uuid: `eq.${userUuid}` },
          { 
            is_blocked: 1,
            _updated_at: Math.floor(Date.now() / 1000)
          }
        );
      }
      
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
  };

  const handleVerifyAllEmails = async () => {

  const handleVerifyAllEmails = async () => {
    // 確認ダイアログ
    const confirmed = window.confirm(
      '既存ユーザー全員のメール確認フラグ（emailVerified）を true に設定します。\n\n' +
      'この操作は元に戻せません。続行しますか？'
    );
    
    if (!confirmed) {
      return;
    }
    
    setIsVerifyingEmails(true);
    
    try {
      // ユーザー一覧を取得
      const result = await auth.listUsers();
      const users = result.data || result || [];
      
      let updatedCount = 0;
      let alreadyVerifiedCount = 0;
      let errorCount = 0;
      const errors = [];
      
      // 各ユーザーを更新
      for (const user of users) {
        try {
          // 既に確認済みの場合はスキップ
          if (user.emailVerified) {
            alreadyVerifiedCount++;
            continue;
          }
          
          // emailVerified を true に設定
          await auth.updateUserByUuid(user.userUuid, { 
            emailVerified: true 
          });
          
          updatedCount++;
          
          // API レート制限を考慮して待機
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          errorCount++;
          errors.push({ 
            userUuid: user.userUuid, 
            email: user.email, 
            error: error.message 
          });
          console.error(`Failed to verify email for ${user.email}:`, error);
        }
      }
      
      // 結果を表示
      toast({
        title: "メール確認完了",
        description: `${updatedCount}人を確認済みにしました (既に確認済み:${alreadyVerifiedCount}人、エラー:${errorCount}件)`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
      
      if (errors.length > 0) {
        console.error('Email verification errors:', errors);
      }
      
    } catch (error) {
      console.error('Failed to verify emails:', error);
      toast({
        title: "エラー",
        description: `エラーが発生しました: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsVerifyingEmails(false);
    }
  };

  const handleTestAuthEmails = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({
        title: "エラー",
        description: "有効なメールアドレスを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    setIsTestingEmail(true);
    let results = '=== 認証メール送信テスト結果 ===\n';
    results += `テスト対象: ${testEmail}\n`;
    results += `実行時刻: ${new Date().toLocaleString('ja-JP')}\n\n`;
    
    // Test 1: auth.resendActivation
    results += '--- テスト1: auth.resendActivation() ---\n';
    try {
      const result = await auth.resendActivation(testEmail);
      results += `✅ 成功:\n`;
      results += `- 戻り値: ${JSON.stringify(result, null, 2)}\n`;
      results += `- データ型: ${typeof result}\n`;
      results += `- データキー: ${Object.keys(result || {}).join(', ')}\n\n`;
    } catch (error: any) {
      results += `❌ エラー:\n`;
      results += `- error.message: ${error.message}\n`;
      results += `- エラー全文: ${JSON.stringify(error, null, 2)}\n`;
      results += `- エラーコード: ${error.code || 'N/A'}\n`;
      results += `- エラー名: ${error.name || 'N/A'}\n\n`;
    }
    
    // Test 2: auth.requestPasswordReset
    results += '--- テスト2: auth.requestPasswordReset() ---\n';
    try {
      const result = await auth.requestPasswordReset(testEmail);
      results += `✅ 成功:\n`;
      results += `- 戻り値: ${JSON.stringify(result, null, 2)}\n`;
      results += `- データ型: ${typeof result}\n`;
      results += `- データキー: ${Object.keys(result || {}).join(', ')}\n\n`;
    } catch (error: any) {
      results += `❌ エラー:\n`;
      results += `- error.message: ${error.message}\n`;
      results += `- エラー全文: ${JSON.stringify(error, null, 2)}\n`;
      results += `- エラーコード: ${error.code || 'N/A'}\n`;
      results += `- エラー名: ${error.name || 'N/A'}\n\n`;
    }
    
    results += '--- テスト完了 ---\n';
    results += `※ 結果をメールボックス(迷惑メールフォルダ含む)で確認してください\n`;
    
    setEmailTestResults(results);
    
    toast({
      title: "テスト完了",
      description: `${testEmail} に認証メールを送信しました。結果を確認してください。`,
    });
    
    setIsTestingEmail(false);
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
    try {
      await db.delete('posts', { _row_id: `eq.${postId}` });
      
      toast({
        title: "投稿削除完了",
        description: "投稿が削除されました",
      });
      
      setSelectedPost(null);
      loadAdminData();
    } catch (error) {
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
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (userFilter === 'blocked') {
      filtered = filtered.filter(user => user.is_blocked === 1);
    } else if (userFilter === 'active') {
      filtered = filtered.filter(user => user.is_blocked !== 1);
    } else if (userFilter === 'unverified') {
      // 未承認ユーザー：メールアドレスがないユーザー
      filtered = filtered.filter(user => !user.email || user.email === '');
    }
    
    return filtered;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '不明';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryName = (categoryUuid) => {
    const category = categories.find(cat => cat._row_id === categoryUuid || cat.uuid === categoryUuid);
    return category ? (category.name_ja || category.name) : '未分類';
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

  const handleEditUser = (userItem) => {
    setEditingUser(userItem);
    setUserForm({
      display_name: userItem.display_name || '',
      email: userItem.email || '',
      role: userItem.role || 'user',
      is_blocked: userItem.is_blocked === 1 || userItem.is_blocked === true
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      const targetUser = allUsers.find(u => u.user_uuid === editingUser.user_uuid);
      if (!targetUser) {
        throw new Error('ユーザーが見つかりません');
      }
      
      // user_profiles行がない場合は作成
      if (!targetUser.profile_exists) {
        await db.insert('user_profiles', {
          user_uuid: editingUser.user_uuid,
          email: userForm.email,
          display_name: userForm.display_name,
          role: userForm.role,
          is_blocked: userForm.is_blocked ? 1 : 0,
          plan: targetUser.plan || 'free',
          _created_at: Math.floor(Date.now() / 1000),
          _updated_at: Math.floor(Date.now() / 1000)
        });
      } else {
        // 既存のuser_profiles行を更新
        await db.update('user_profiles',
          { _row_id: `eq.${editingUser._row_id}` },
          {
            display_name: userForm.display_name,
            email: userForm.email,
            role: userForm.role,
            is_blocked: userForm.is_blocked ? 1 : 0,
            _updated_at: Math.floor(Date.now() / 1000)
          }
        );
      }
      
      toast({
        title: "ユーザー更新完了",
        description: "ユーザー情報が更新されました",
      });
      
      setIsUserModalOpen(false);
      setEditingUser(null);
      loadAdminData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "エラー",
        description: "ユーザーの更新に失敗しました",
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
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0 hover:opacity-80 transition-opacity">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">管理者パネル</h1>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[100px] sm:max-w-[200px] hidden sm:block">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate('/')}>
                戻る
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

        {/* Backup Section */}
        <div className="space-y-4 mb-8">
          {/* Database Backup */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-blue-900">データベースバックアップ</CardTitle>
                  <p className="text-sm text-blue-700 mt-1">
                    ※定期的(月1回など)にダウンロードして保管することをおすすめします
                  </p>
                </div>
                <Button 
                  onClick={handleBackupAllData}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  全データをバックアップ(ダウンロード)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• バックアップには全テーブルのデータが含まれます（削除済みデータも含む）</p>
                <p>• ファイル形式: JSON (sverige-jp-backup-YYYY-MM-DD.json)</p>
                <p>• 含まれるテーブル: users, user_profiles, posts, categories, subcategories, locations, forum_topics, forum_replies, messages</p>
              </div>
            </CardContent>
          </Card>

          {/* Image Download */}
          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-purple-900">画像ファイル一括ダウンロード</CardTitle>
                  <p className="text-sm text-purple-700 mt-1">
                    ※アップロードされた画像ファイルをZIPファイルとしてダウンロードします
                  </p>
                </div>
                <Button 
                  onClick={handleDownloadAllImages}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Package className="h-4 w-4 mr-2" />
                  画像ファイルを一括ダウンロード(ZIP)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-purple-700 space-y-1">
                <p>• 全投稿の画像とユーザープロフィール画像をまとめてダウンロードします</p>
                <p>• ファイル形式: ZIP (sverige-jp-images-YYYY-MM-DD.zip)</p>
                <p>• 対象: /content/... の画像のみ（外部URLはスキップされます）</p>
                <p>• 取得できなかった画像は最後に報告されます</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Verification */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-green-900">既存ユーザーを全員メール確認済みにする</CardTitle>
                  <p className="text-sm text-green-700 mt-1">
                    ※一度きりのバッチ処理：emailVerified フラグを true に一括設定します
                  </p>
                </div>
                <Button 
                  onClick={handleVerifyAllEmails}
                  disabled={isVerifyingEmails}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isVerifyingEmails ? '実行中...' : '全員を確認済みにする'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-green-700 space-y-1">
                <p>• 既存ユーザー全員の emailVerified フラグを true に設定します</p>
                <p>• 既に確認済みのユーザーはスキップされます</p>
                <p>• 各更新の間に 100ms 待機して API レート制限を考慮します</p>
                <p>• 完了後、更新人数を toast で報告します（他のデータは変更しません）</p>
              </div>
            </CardContent>
          </Card>

          {/* Auth Email Test */}
          <Card className="bg-orange-50 border-orange-200">
            <CardHeader>
              <div>
                <CardTitle className="text-orange-900">認証メール送信テスト</CardTitle>
                <p className="text-sm text-orange-700 mt-1">
                  ※ auth.resendActivation() と auth.requestPasswordReset() の結果を診断します
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Input
                  type="email"
                  placeholder="テスト送信先メールアドレス"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="max-w-md"
                />
                <Button 
                  onClick={handleTestAuthEmails}
                  disabled={isTestingEmail}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isTestingEmail ? 'テスト中...' : '認証メールテスト送信'}
                </Button>
              </div>
              
              {emailTestResults && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-orange-900">テスト結果:</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEmailTestResults('')}
                    >
                      クリア
                    </Button>
                  </div>
                  <textarea
                    readOnly
                    value={emailTestResults}
                    className="w-full h-96 p-3 text-xs font-mono bg-white border border-orange-200 rounded-lg"
                  />
                </div>
              )}
              
              <div className="text-sm text-orange-700 space-y-1">
                <p>• 入力されたメールアドレスに認証メールを送信します</p>
                <p>• auth.resendActivation() と auth.requestPasswordReset() を順番に実行</p>
                <p>• 成功時の戻り値、失敗時のエラー全文を表示します</p>
                <p>• 結果を確認したら、メールボックス(迷惑メールフォルダ含む)も確認してください</p>
              </div>
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
                              投稿者: {post.creatorDisplayName || '不明'} (ID: {post._created_by?.substring(0, 8)}...)
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
                        <SelectItem value="unverified">未承認</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers().map((userItem) => (
                    <div key={userItem.user_uuid} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">
                              {userItem.display_name || '不明'}
                            </h3>
                            {/* アカウント状態バッジ */}
                            {userItem.email ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                有効
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                <Clock className="h-3 w-3 mr-1" />
                                未承認
                              </Badge>
                            )}
                            {userItem.is_blocked === 1 && (
                              <Badge variant="destructive">
                                <Ban className="h-3 w-3 mr-1" />
                                ブロック済み
                              </Badge>
                            )}
                            {userItem.email === user?.email && (
                              <Badge variant="outline" className="bg-blue-50">
                                <Shield className="h-3 w-3 mr-1" />
                                管理者（あなた）
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm">{userItem.email || 'メール未設定'}</p>
                          <p className="text-xs text-gray-500">
                            登録日: {formatDate(userItem._created_at)}
                          </p>
                          <div className="mt-2 text-sm text-gray-600">
                            投稿数: {allPosts.filter(p => p._created_by === userItem.user_uuid).length}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {userItem.email !== user?.email && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(userItem)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {userItem.is_blocked === 1 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnblockUser(userItem.user_uuid)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  ブロック解除
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleBlockUser(userItem.user_uuid)}
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  ブロック
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(userItem.user_uuid)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
                            <h3 className="font-semibold">{category.name_ja || category.name}</h3>
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
                              投稿者: {post.creatorDisplayName || '不明'} (ID: {post._created_by?.substring(0, 8)}...)
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
                  <p><strong>表示名:</strong> {selectedUser.display_name || '不明'}</p>
                  <p><strong>メール:</strong> {selectedUser.email || '未設定'}</p>
                  <p><strong>登録日:</strong> {formatDate(selectedUser._created_at)}</p>
                  {selectedUser.is_blocked === 1 && (
                    <Badge variant="destructive" className="mt-2">
                      ブロック済み
                    </Badge>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  {selectedUser.is_blocked === 1 ? (
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

        {/* User Edit Modal */}
        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ユーザー編集</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="displayName">表示名</Label>
                  <Input
                    id="displayName"
                    value={userForm.display_name}
                    onChange={(e) => setUserForm({...userForm, display_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="role">ロール</Label>
                  <Select 
                    value={userForm.role} 
                    onValueChange={(value) => setUserForm({...userForm, role: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">一般ユーザー</SelectItem>
                      <SelectItem value="admin">管理者</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isBlocked"
                    checked={userForm.is_blocked}
                    onChange={(e) => setUserForm({...userForm, is_blocked: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isBlocked">ブロック済み</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsUserModalOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleSaveUser}>
                    保存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
};

export default Admin;