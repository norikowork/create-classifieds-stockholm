import { useState, useEffect } from 'react';
import { Shield, Users, FileText, AlertTriangle, Ban, Check, X, Eye, Search, Filter, Trash, Plus, Edit, CheckCircle, Clock, Download, Package } from 'lucide-react';
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
import functions from '@/lib/shared/kliv-functions';
import { checkIsAdmin } from '@/lib/isAdmin';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { PostModal } from '@/components/PostModal';
import Footer from '@/components/Footer';
import { statusLabels } from '@/constants/postLabels';
import JSZip from 'jszip';
import { addAuthorNamesToPosts } from '@/lib/utils/authorHelpers';

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

  const [spamReports, setSpamReports] = useState([]);
  const [spamReportsByPost, setSpamReportsByPost] = useState({});
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
      const [userProfiles, posts, flagged, categoriesData, spamReportsData] = await Promise.all([
        db.query('user_profiles', { _deleted: 'eq.0', order: '_created_at.desc' }),
        db.query('posts', { _deleted: 'eq.0', order: '_created_at.desc' }),
        db.query('posts', { status: 'eq.flagged', order: '_created_at.desc' }),
        db.query('categories', { _deleted: 'eq.0' }),
        db.query('spam_reports', { order: '_created_at.desc' })
      ]);
      
      // ユーザーリストはuser_profilesのみを使用
      setAllUsers(userProfiles);
      
      // 共通ヘルパー関数で投稿者名を追加
      const postsWithCreatorNames = await addAuthorNamesToPosts(posts, userProfiles);
      const flaggedWithCreatorNames = await addAuthorNamesToPosts(flagged, userProfiles);
      
      setAllPosts(postsWithCreatorNames);
      setFlaggedPosts(flaggedWithCreatorNames);
      setCategories(categoriesData);
      setSpamReports(spamReportsData || []);
      
      // Group spam reports by post_id
      const groupedReports = {};
      (spamReportsData || []).forEach(report => {
        if (!groupedReports[report.post_id]) {
          groupedReports[report.post_id] = [];
        }
        groupedReports[report.post_id].push(report);
      });
      setSpamReportsByPost(groupedReports);
      
      // Calculate stats
      const blockedCount = userProfiles.filter(u => u.is_blocked === 1).length;
      setStats({
        totalUsers: userProfiles.length,
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

  const handleDeactivateUser = async (userUuid) => {
    if (!window.confirm('このユーザーを無効化しますか？（ログイン不可・投稿も非表示になります。あとで復活できます）')) {
      return;
    }
    
    try {
      console.log(`🚫 ユーザー無効化開始: ${userUuid}`);
      
      // 管理者用Edge Functionを呼び出して無効化実行
      const result = await functions.post('admin-user-action', {
        action: 'deactivate',
        targetUuid: userUuid
      });
      
      console.log(`🎉 Edge Function結果:`, result);
      
      if (result.success) {
        toast({
          title: "ユーザーを無効化しました",
          description: result.message || "投稿も非表示にしました",
        });
        console.log(`✅ ユーザー無効化完全成功: ${userUuid} - ${result.postsUpdated}件の投稿を非表示`);
        
        loadAdminData();
      } else {
        throw new Error(result.error || '無効化に失敗しました');
      }
      
    } catch (error: any) {
      console.error(`❌ ユーザー無効化失敗: ${error.message}`);
      
      // 本当のエラー内容を表示
      toast({
        title: "エラー",
        description: `ユーザーの無効化に失敗しました: ${error.message || '不明なエラー'}`,
        variant: "destructive"
      });
    }
  };
  
  const handleReactivateUser = async (userUuid) => {
    if (!window.confirm('このユーザーを復活させますか？（ログイン可能・投稿も再表示されます）')) {
      return;
    }
    
    try {
      console.log(`✅ ユーザー復活開始: ${userUuid}`);
      
      // 管理者用Edge Functionを呼び出して復活実行
      const result = await functions.post('admin-user-action', {
        action: 'activate',
        targetUuid: userUuid
      });
      
      console.log(`🎉 Edge Function結果:`, result);
      
      if (result.success) {
        toast({
          title: "ユーザーを復活しました",
          description: result.message || "ログイン可能・投稿も再表示されました",
        });
        console.log(`✅ ユーザー復活完全成功: ${userUuid} - ${result.postsUpdated}件の投稿を再表示`);
        
        loadAdminData();
      } else {
        throw new Error(result.error || '復活に失敗しました');
      }
      
    } catch (error: any) {
      console.error(`❌ ユーザー復活失敗: ${error.message}`);
      
      // 本当のエラー内容を表示
      toast({
        title: "エラー",
        description: `ユーザーの復活に失敗しました: ${error.message || '不明なエラー'}`,
        variant: "destructive"
      });
    }
  };

  const handleBlockUser = async (userUuid) => {
    try {
      // 常にuser_profiles.is_blockedを更新
      await db.update('user_profiles',
        { user_uuid: `eq.${userUuid}` },
        { 
          is_blocked: 1,
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
      // 常にuser_profiles.is_blockedを更新
      await db.update('user_profiles',
        { user_uuid: `eq.${userUuid}` },
        { 
          is_blocked: 0,
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

  // スパム報告用ハンドラー
  const handleHidePost = async (postId, adminName) => {
    try {
      // 投稿を非表示に設定
      await db.update('posts',
        { _row_id: `eq.${postId}` },
        { 
          is_hidden: 1,
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      // 関連するスパム報告をhiddenに更新
      await db.update('spam_reports',
        { post_id: `eq.${postId}` },
        { 
          status: 'hidden',
          resolved_by: adminName,
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "非表示完了",
        description: "投稿を非表示にしました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error hiding post:', error);
      toast({
        title: "エラー",
        description: "投稿の非表示に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleShowPost = async (postId) => {
    try {
      // 投稿を再表示
      await db.update('posts',
        { _row_id: `eq.${postId}` },
        { 
          is_hidden: 0,
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "再表示完了",
        description: "投稿を再表示しました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error showing post:', error);
      toast({
        title: "エラー",
        description: "投稿の再表示に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleMarkAsOk = async (postId, adminName) => {
    try {
      // 投稿を再表示する（問題なし＝公開に戻す）
      await db.update('posts',
        { _row_id: `eq.${postId}` },
        { 
          is_hidden: 0,
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      // 関連するスパム報告をokに更新
      await db.update('spam_reports',
        { post_id: `eq.${postId}` },
        { 
          status: 'ok',
          resolved_by: adminName,
          _updated_at: Math.floor(Date.now() / 1000)
        }
      );
      
      toast({
        title: "対応完了",
        description: "問題なしとしてマークし、投稿を再表示しました",
      });
      
      loadAdminData();
    } catch (error) {
      console.error('Error marking as ok:', error);
      toast({
        title: "エラー",
        description: "操作に失敗しました",
        variant: "destructive"
      });
    }
  };

  const handleVerifyAllEmails = async () => {
    try {
      const userProfiles = await db.query('user_profiles', { _deleted: 'eq.0' });
      
      // スクリプトを生成（UUIDリストを安全に埋め込む）
      const userUuidsArray = userProfiles.map(p => p.user_uuid);
      const userUuidsJSON = JSON.stringify(userUuidsArray);
      
      const script = `
(async () => {
  try {
    // authオブジェクトを動的にインポート
    const authModule = await import('/src/lib/shared/kliv-auth.js');
    const auth = authModule.default;
    
    if (!auth) {
      console.error('❌ authオブジェクトが見つかりません。ログインしているか確認してください。');
      alert('❌ authオブジェクトが見つかりません。ログインしているか確認してください。');
      return;
    }
    
    // 既存ユーザーのUUIDリストを使用
    const userUuids = ${userUuidsJSON};
    
    let updatedCount = 0;
    let alreadyVerifiedCount = 0;
    let errors = [];
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔧 既存ユーザーを全員メール確認済みに設定するバッチ処理');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(\`📊 処理対象ユーザー数: \${userUuids.length}人\`);
    console.log('');
    console.log('処理開始...');
    
    for (const userUuid of userUuids) {
      try {
        // auth.updateUserを使ってemailVerifiedをtrueに設定
        const result = await auth.updateUser({ userUuid: userUuid, emailVerified: true });
        
        if (result.emailVerified === true) {
          updatedCount++;
          console.log(\`✅ \${userUuid} をメール確認済みに設定しました\`);
        } else {
          alreadyVerifiedCount++;
          console.log(\`ℹ️ \${userUuid} は既にメール確認済みです\`);
        }
        
        // 100msディレイを追加してレート制限を回避
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        errors.push(\`\${userUuid}: \${err.message}\`);
        console.error(\`❌ \${userUuid} の更新に失敗: \${err.message}\`);
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 バッチ処理完了');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(\`✅ 更新成功: \${updatedCount}人\`);
    console.log(\`ℹ️ 既に確認済み: \${alreadyVerifiedCount}人\`);
    console.log(\`❌ エラー: \${errors.length}件\`);
    
    if (errors.length > 0) {
      console.log('');
      console.log('エラー詳細:');
      errors.forEach(err => console.log(\`  - \${err}\`));
    }
    
    alert(\`✅ バッチ処理完了！\\n\\n更新成功: \${updatedCount}人\\n既に確認済み: \${alreadyVerifiedCount}人\\nエラー: \${errors.length}件\\n\\n詳細はブラウザコンソールを確認してください。\`);
    
  } catch (error) {
    console.error('❌ バッチ処理エラー:', error);
    alert(\`❌ エラーが発生しました: \${error.message}\`);
  }
})();
      `.trim();
      
      // クリップボードにコピー
      await navigator.clipboard.writeText(script);
      
      toast({
        title: "スクリプトをクリップボードにコピーしました",
        description: `${userProfiles.length}人のユーザーを処理します。開発者ツールで実行してください。`,
      });
      
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('🔧 既存ユーザーを全員メール確認済みに設定するバッチ処理');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log(`📊 処理対象ユーザー数: ${userProfiles.length}人`);
      console.log('');
      console.log('✅ スクリプトをクリップボードにコピーしました！');
      console.log('');
      console.log('📋 実行手順:');
      console.log('   1. スクリプトは既にクリップボードにコピーされています');
      console.log('   2. ブラウザの開発者ツールを開いてください (F12)');
      console.log('   3. Consoleタブを選択してください');
      console.log('   4. スクリプトを貼り付けて (Ctrl+V / Cmd+V)');
      console.log('   5. Enterキーを押してください');
      console.log('   6. 処理が完了するまでお待ちください（数分かかる場合があります）');
      console.log('');
      console.log('💡 ヒント: 処理が完了すると、結果がアラートで表示されます');
      console.log('═══════════════════════════════════════════════════════════════');
      
    } catch (error) {
      console.error('❌ スクリプト生成エラー:', error);
      toast({
        title: "スクリプト生成エラー",
        description: error.message,
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
    
    // ソート: 有効ユーザーが上、無効ユーザーは下にまとまる
    filtered.sort((a, b) => {
      // is_activeの降順（1が上、0が下）
      if (a.is_active !== b.is_active) {
        return b.is_active - a.is_active;
      }
      // 同じis_activeの場合、_created_atの降順（新しい順）
      return b._created_at - a._created_at;
    });
    
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
      is_blocked: userItem.is_blocked === 1
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
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
                  <p className="text-xs text-green-600 mt-1">
                    ⚠️ 新規登録者のメール確認には影響しません。既存ユーザーのロックアウト防止用です。
                  </p>
                </div>
                <Button 
                  onClick={handleVerifyAllEmails}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  スクリプトをコピー
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-green-700 space-y-1">
                <p>• 「スクリプトをコピー」ボタンをクリックすると、スクリプトがクリップボードにコピーされます</p>
                <p>• ブラウザの開発者ツール (F12) → Consoleタブで貼り付けて実行してください</p>
                <p>• 処理が完了すると、結果がアラートで表示されます</p>
                <p>• 既存ユーザー全員の emailVerified フラグを true に設定します</p>
                <p>• 各更新の間に 100ms 待機して API レート制限を考慮します</p>
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
            <TabsTrigger value="spam_reports">
              スパム報告
              {Object.values(spamReportsByPost).filter(reports => reports.some(r => r.status === 'pending')).length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {Object.values(spamReportsByPost).filter(reports => reports.some(r => r.status === 'pending')).length}
                </Badge>
              )}
            </TabsTrigger>
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
                              投稿者: {post.creatorDisplayName} (ID: {post.creatorId})
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
                  {filteredUsers().map((userItem) => {
                    const isInactive = userItem.is_active === 0;
                    
                    return (
                      <div 
                        key={userItem.user_uuid} 
                        className={`border rounded-lg p-4 ${isInactive ? 'bg-gray-100 opacity-60' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold">
                                {userItem.display_name || '不明'}
                              </h3>
                              {/* アカウント状態バッジ */}
                              {isInactive ? (
                                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                  <X className="h-3 w-3 mr-1" />
                                  無効
                                </Badge>
                              ) : userItem.email ? (
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
                                {isInactive ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-green-50 text-green-700 border-green-200"
                                    onClick={() => handleReactivateUser(userItem.user_uuid)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    復活
                                  </Button>
                                ) : (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeactivateUser(userItem.user_uuid)}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    無効化
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                              投稿者: {post.creatorDisplayName} (ID: {post.creatorId})
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

          <TabsContent value="spam_reports">
            <Card>
              <CardHeader>
                <CardTitle>スパム報告一覧</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(spamReportsByPost).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">スパム報告はありません</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(spamReportsByPost).map(([postId, reports]) => {
                      const postData = allPosts.find(p => p._row_id === postId);
                      const pendingReports = reports.filter(r => r.status === 'pending');
                      const isHidden = postData?.is_hidden === 1;

                      return (
                        <div key={postId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-2">
                                <Link to={`/post/${postId}`} className="hover:text-blue-600">
                                  {postData?.title || reports[0]?.post_title || '不明'}
                                </Link>
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>報告件数: {reports.length}件</span>
                                <span>未対応: {pendingReports.length}件</span>
                                {isHidden && (
                                  <Badge variant="destructive">非表示中</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!isHidden ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleHidePost(postId, user?.displayName || '管理者')}
                                >
                                  投稿を非表示にする
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleShowPost(postId)}
                                >
                                  再表示する
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsOk(postId, user?.displayName || '管理者')}
                              >
                                問題なし
                              </Button>
                            </div>
                          </div>

                          {/* 報告者リスト */}
                          <div className="space-y-3">
                            {reports.map((report, index) => {
                                  const reportDate = report._created_at ? new Date(report._created_at * 1000).toLocaleDateString('ja-JP') : '不明';
                                  return (
                                    <div key={report._row_id || index} className="border-l-2 pl-3 text-sm">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{report.reporter_name || '不明'}</span>
                                        <span className="text-gray-500">{reportDate}</span>
                                        {report.status === 'pending' && (
                                          <Badge variant="outline" className="text-xs">未対応</Badge>
                                        )}
                                        {report.status === 'hidden' && (
                                          <Badge variant="destructive" className="text-xs">非表示済み</Badge>
                                        )}
                                        {report.status === 'ok' && (
                                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">問題なし</Badge>
                                        )}
                                      </div>
                                      {report.reason && (
                                        <p className="text-gray-600 text-xs">理由: {report.reason}</p>
                                      )}
                                      {report.resolved_by && (
                                        <p className="text-xs text-gray-500">対応者: {report.resolved_by}</p>
                                      )}
                                    </div>
                                  );
                                })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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