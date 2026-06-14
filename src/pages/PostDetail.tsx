import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, DollarSign, User, Mail, Phone, Send, X, Image as ImageIcon, MessageSquare, Home, Shield, ChevronLeft, ChevronRight, Briefcase, Building, TrendingUp, Package, Share2, Link2, Linkedin, Twitter, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import AuthModal from '@/components/AuthModal';
import Footer from '@/components/Footer';
import SingleLocationMap from '@/components/SingleLocationMap';
import db from '@/lib/shared/kliv-database';
import auth from '@/lib/shared/kliv-auth';
import functions from '@/lib/shared/kliv-functions';
import { checkIsAdmin } from '@/lib/isAdmin';
import { useToast } from '@/hooks/use-toast';
import { statusLabels, postTypeLabels } from '@/constants/postLabels';
import { getMessageLimit } from '@/constants/plans';

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
  const [subcategories, setSubcategories] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [allPosts, setAllPosts] = useState([]);
  const [previousPost, setPreviousPost] = useState(null);
  const [nextPost, setNextPost] = useState(null);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [isAdmin, setIsAdmin] = useState(false);
  const [contactMethod, setContactMethod] = useState('dm'); // 連絡方法: 'dm' または 'email'
  const [showMessageButton, setShowMessageButton] = useState(false); // メッセージを見るボタン表示用

  const conditionLabels = {
    'new': '新品',
    'like_new': 'ほぼ新品',
    'excellent': '非常に良い',
    'good': '良い',
    'fair': '可',
    'junk': 'ジャンク'
  };

  const conditionColors = {
    'new': 'bg-green-100 text-green-800',
    'like_new': 'bg-emerald-100 text-emerald-800',
    'excellent': 'bg-teal-100 text-teal-800',
    'good': 'bg-blue-100 text-blue-800',
    'fair': 'bg-yellow-100 text-yellow-800',
    'junk': 'bg-red-100 text-red-800'
  };

  const employmentTypeLabels = {
    'full-time': 'フルタイム',
    'part-time': 'パートタイム',
    'contract': 'コントラクト（契約）',
    'internship': 'インターン',
    'other': 'その他'
  };

  const experienceLevelLabels = {
    'entry': '初級',
    'mid': '中級',
    'senior': 'シニア',
    'any': '経験問わず'
  };

  const loadAllPosts = async () => {
    try {
      const postsData = await db.query('posts', {
        _deleted: 'eq.0'
      }, { orderBy: '_created_at', orderDirection: 'desc' });
      setAllPosts(postsData || []);
    } catch (error) {
      console.error('Error loading all posts:', error);
    }
  };

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

  const loadSubcategories = async () => {
    try {
      const subcategoriesData = await db.query('subcategories', { _deleted: 'eq.0' });
      setSubcategories(subcategoriesData);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
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

              console.log('👤 User profile found:', {
                user_uuid: postData._created_by,
                display_name: userProfile.display_name,
                email: userProfile.email,
                contact_pref: userProfile.contact_pref
              });

              // Store profile data including email and contact_pref
              setUserProfiles(prev => ({
                ...prev,
                [postData._created_by]: {
                  ...userProfile,
                  email: userProfile.email || null,
                  contact_pref: userProfile.contact_pref || 'email'
                }
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

        console.log('📄 Post loaded with user profile:', {
          postId: postWithImages._row_id,
          postTitle: postWithImages.title,
          createdBy: postWithImages._created_by,
          userName: postWithImages.userName,
          hasUserProfile: !!postWithImages.userProfile,
          userEmail: postWithImages.userProfile?.email
        });

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

  useEffect(() => {
    loadPost();
    loadAllPosts();
    loadLocations();
    loadCategories();
    loadSubcategories();
    checkAuthStatus();
  }, [postId]);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const adminStatus = await checkIsAdmin(user);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, [user]);

  // Set Open Graph meta tags for Facebook sharing
  useEffect(() => {
    if (post) {
      // Get first image URL
      let firstImageUrl = '';
      if (post.images && Array.isArray(post.images) && post.images.length > 0) {
        firstImageUrl = post.images[0];
      }
      
      // Fallback to default image if no images
      if (!firstImageUrl) {
        firstImageUrl = '/content/templates/sverigejplogo.png';
      }
      
      // Ensure image URL is absolute
      if (firstImageUrl.startsWith('/')) {
        firstImageUrl = 'https://create-classifieds-stockholm.kliv.site' + firstImageUrl;
      }
      
      // Add cache buster to image URL to prevent Facebook caching
      const cacheBuster = Date.now();
      const imageUrlWithCache = `${firstImageUrl}?v=${cacheBuster}`;
      
      console.log('📸 Setting og:image to:', imageUrlWithCache);
      
      // Update or create meta tags
      const updateMetaTag = (property, content) => {
        let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };
      
      const pageUrl = window.location.href;
      const title = post.title || 'Sverige.JP - スウェーデン日本コミュニティ';
      const description = post.description ? post.description.substring(0, 200) : '';
      
      // Set Open Graph tags
      updateMetaTag('og:title', title);
      updateMetaTag('og:description', description);
      updateMetaTag('og:image', imageUrlWithCache);
      updateMetaTag('og:image:width', '1200');
      updateMetaTag('og:image:height', '630');
      updateMetaTag('og:image:alt', title);
      updateMetaTag('og:url', pageUrl);
      updateMetaTag('og:type', 'article');
      updateMetaTag('og:site_name', 'Sverige.JP - スウェーデン日本コミュニティ');
      updateMetaTag('og:locale', 'ja_JP');
      
      // Also set twitter card
      updateMetaTag('twitter:card', 'summary_large_image');
      updateMetaTag('twitter:image', imageUrlWithCache);
      updateMetaTag('twitter:title', title);
      updateMetaTag('twitter:description', description);
      
      console.log('✅ Open Graph meta tags updated:', {
        'og:title': title,
        'og:image': imageUrlWithCache,
        'og:url': pageUrl
      });
      
      // Update document title as well
      document.title = `${title} | Sverige.JP`;
    }
  }, [post]);

  useEffect(() => {
    if (allPosts.length > 0 && post) {
      const currentIndex = allPosts.findIndex(p => p._row_id === post._row_id);
      if (currentIndex > 0) {
        setPreviousPost(allPosts[currentIndex - 1]);
      } else {
        setPreviousPost(null);
      }
      if (currentIndex >= 0 && currentIndex < allPosts.length - 1) {
        setNextPost(allPosts[currentIndex + 1]);
      } else {
        setNextPost(null);
      }
    }
  }, [allPosts, post]);

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.uuid === locationId);
    return location ? location.name_en || location.name_ja : 'Ej angivet';
  };

  const getLocationData = (locationId) => {
    return locations.find(l => l.uuid === locationId);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.uuid === categoryId);
    return category ? category.name_ja || category.name_en : 'Ej angivet';
  };

  const getSubcategoryName = (subcategoryId) => {
    const subcategory = subcategories.find(s => s.uuid === subcategoryId);
    return subcategory ? subcategory.name_ja : '';
  };

  // Calendar functions
  const generateICS = () => {
    if (!post.event_date && !post.event_date_readable) return null;

    // Parse the event date - try different formats
    let eventDate;
    if (post.event_date) {
      // If it's a Unix timestamp (seconds)
      if (typeof post.event_date === 'number') {
        eventDate = new Date(post.event_date * 1000);
      } else if (typeof post.event_date === 'string') {
        // If it's an ISO string or datetime-local format
        eventDate = new Date(post.event_date);
      }
    }

    if (!eventDate || isNaN(eventDate.getTime())) {
      console.warn('Invalid event date:', post.event_date);
      return null;
    }

    // Create end date (2 hours after start)
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);

    // Format dates for ICS
    const formatICSDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0];
    };

    // Escape text for ICS
    const escapeText = (text) => {
      if (!text) return '';
      return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sverige.JP//SverigeJP Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${post._row_id}@sverige.jp`,
      `DTSTART:${formatDate(eventDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${escapeText(post.title)}`,
      `DESCRIPTION:${escapeText(post.description)}`,
      post.event_location ? `LOCATION:${escapeText(post.event_location)}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    return icsContent;
  };

  const downloadICS = () => {
    const icsContent = generateICS();
    if (!icsContent) {
      toast({
        title: "エラー",
        description: "イベントの日時情報が正しくありません",
        variant: "destructive"
      });
      return;
    }

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${post.title}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "カレンダーに追加",
      description: "ICSファイルをダウンロードしました"
    });
  };

  const getGoogleCalendarUrl = () => {
    if (!post.event_date) return null;

    let eventDate;
    if (typeof post.event_date === 'number') {
      eventDate = new Date(post.event_date * 1000);
    } else if (typeof post.event_date === 'string') {
      eventDate = new Date(post.event_date);
    }

    if (!eventDate || isNaN(eventDate.getTime())) return null;

    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);

    const formatGoogleDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: post.title || '',
      dates: `${formatGoogleDate(eventDate)}/${formatGoogleDate(endDate)}`,
      details: post.description || '',
      location: post.event_location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleAddToCalendar = (type) => {
    if (type === 'google') {
      const url = getGoogleCalendarUrl();
      if (url) {
        window.open(url, '_blank');
      }
    } else if (type === 'ics') {
      downloadICS();
    }
  };

  // Share functionality
  const handleShare = async (platform) => {
    const url = window.location.href;
    const title = post?.title || 'Sverige.JP - スウェーデン日本コミュニティ';
    const text = post?.description || '';

    switch (platform) {
      case 'copy':
        try {
          await navigator.clipboard.writeText(url);
          toast({
            title: "コピー完了",
            description: "URLをクリップボードにコピーしました",
          });
        } catch (error) {
          console.error('Failed to copy:', error);
          toast({
            title: "エラー",
            description: "URLのコピーに失敗しました",
            variant: "destructive"
          });
        }
        break;

      case 'line':
        const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
        window.open(lineUrl, '_blank');
        break;

      case 'twitter':
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank');
        break;

      case 'facebook':
        // Facebookでシェア（URLコピー）
        try {
          await navigator.clipboard.writeText(url);
          toast({
            title: "URLコピー完了",
            description: "Facebookに貼り付けて投稿できます",
          });
          console.log('🔗 Copied share URL:', url);
        } catch (error) {
          console.error('Failed to copy URL:', error);
          toast({
            title: "エラー",
            description: "URLのコピーに失敗しました",
            variant: "destructive"
          });
        }
        break;

      case 'linkedin':
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        window.open(linkedinUrl, '_blank');
        break;

      default:
        break;
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

    if (contactMethod === 'dm') {
      await handleDirectMessageSubmit();
    } else {
      await handleEmailSubmit();
    }
  };

  // サイト内メッセージ(DM)で送信
  const handleDirectMessageSubmit = async () => {
    const currentUser = await auth.getUser();
    if (!currentUser || !currentUser.userUuid) {
      toast({
        title: "エラー",
        description: "ログインが必要です",
        variant: "destructive"
      });
      return;
    }

    const me = currentUser.userUuid;
    const other = post._created_by;

    // 自分自身の投稿には連絡不可
    if (me === other) {
      toast({
        title: "エラー",
        description: "自分の投稿には連絡できません",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 送信者のプロフィールを取得
      const profiles = await db.query('user_profiles', {
        user_uuid: `eq.${me}`,
        _deleted: 'eq.0'
      });

      const profile = profiles[0];
      const fromName = profile?.display_name || currentUser.displayName || currentUser.email || '自分';

      // 上限チェック
      const [sentMessages, receivedMessages] = await Promise.all([
        db.query('messages', { from_uuid: `eq.${me}`, _deleted: 'eq.0' }),
        db.query('messages', { to_uuid: `eq.${me}`, _deleted: 'eq.0' })
      ]);

      const allMessages = [...sentMessages, ...receivedMessages];
      const uniqueMessages = Array.from(
        new Map(allMessages.map(msg => [msg._row_id, msg])).values()
      );

      const limit = getMessageLimit(profile);

      if (uniqueMessages.length >= limit) {
        const limitText = limit === Infinity ? '無制限' : `${limit}通`;
        toast({
          title: "送信できません",
          description: `メッセージが上限に達しています。受信箱で古い会話を削除するか、有料プラン(月30kr・近日対応)をご利用ください。`,
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // conversation_keyを生成
      const sortedUuids = [me, other].sort();
      const conversation_key = `${post._row_id}:${sortedUuids.join('_')}`;

      // メッセージを送信
      await db.insert('messages', {
        post_id: post._row_id,
        post_title: post.title,
        conversation_key,
        from_uuid: me,
        from_name: fromName,
        to_uuid: other,
        body: contactMessage,
        is_read: 0
      });

      console.log('✅ Direct message sent successfully');

      // 受信者のプロフィールを取得してメールアドレスを取得
      const receiverProfiles = await db.query('user_profiles', {
        user_uuid: `eq.${other}`,
        _deleted: 'eq.0'
      });

      const receiverProfile = receiverProfiles[0];
      const receiverEmail = receiverProfile?.email;

      if (receiverEmail) {
        console.log('📬 Sending message notification to:', receiverEmail);

        try {
          const notificationResult = await functions.post('send-message-notification', {
            toEmail: receiverEmail,
            toName: receiverProfile?.display_name,
            fromName: fromName,
            postTitle: post.title,
            messagesUrl: `${window.location.origin}/messages`
          });

          console.log('✅ Message notification sent:', notificationResult);
        } catch (notificationError) {
          console.error('❌ Message notification error:', notificationError);
          // 通知のエラーはメッセージ送信自体の成功に影響しない
        }
      } else {
        console.log('⚠️ Receiver email not found, skipping notification');
      }

      toast({
        title: "送信完了",
        description: "メッセージを送信しました。返信は『メッセージ』画面で確認できます。",
      });

      setIsContactModalOpen(false);
      setContactMessage('');
      setIsSubmitting(false);

      // 「メッセージを見る」ボタンで遷移できるようにする
      // ユーザーがクリックしたら遷移するためのstateをセット
      setShowMessageButton(true);

    } catch (error) {
      console.error('Error sending direct message:', error);
      toast({
        title: "エラー",
        description: error.message || "送信に失敗しました",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  // メールで送信（既存の処理）
  const handleEmailSubmit = async () => {
    setIsSubmitting(true);
    try {
      const currentUser = await auth.getUser();
      if (!currentUser) {
        setIsSubmitting(false);
        toast({
          title: "エラー",
          description: "ログインが必要です",
          variant: "destructive"
        });
        return;
      }

      console.log('📧 Starting contact submission process');
      console.log('📧 Current post data:', {
        postId: post._row_id,
        postTitle: post.title,
        createdBy: post._created_by,
        hasUserProfile: !!post.userProfile,
        userEmail: post.userProfile?.email,
        creatorEmail: post.creator_email,
        userProfileKeys: post.userProfile ? Object.keys(post.userProfile) : []
      });

      // 投稿者のメールアドレスを取得（優先度: creator_email > userProfile.email > エラー）
      const toEmail = post.creator_email || post.userProfile?.email;
      if (!toEmail) {
        setIsSubmitting(false);
        console.error('❌ Poster email not found:', {
          hasUserProfile: !!post.userProfile,
          userProfile: post.userProfile,
          creatorEmail: post.creator_email,
          createdBy: post._created_by
        });
        toast({
          title: "エラー",
          description: "投稿者のメールアドレスが見つかりません",
          variant: "destructive"
        });
        return;
      }

      console.log('📧 Sending contact email with data:', {
        postId: post._row_id,
        postTitle: post.title,
        fromEmail: currentUser.email,
        toEmail: toEmail,
        message: contactMessage
      });

      // Edge Functionを呼び出してメールを送信
      try {
        const result = await functions.post('send-contact-email', {
          postId: post._row_id,
          postTitle: post.title,
          fromEmail: currentUser.email,
          fromName: currentUser.displayName || currentUser.firstName || currentUser.email,
          toEmail: toEmail,
          message: contactMessage,
          postUrl: window.location.href
        });

        console.log('✅ Edge function result:', result);

        if (result && result.success) {
          toast({
            title: "送信完了",
            description: "投稿者に問い合わせメールを送信しました",
          });
          setIsContactModalOpen(false);
          setContactMessage('');
        } else {
          throw new Error(result?.error || '送信に失敗しました');
        }
      } catch (functionError) {
        console.error('❌ Function call error:', functionError);
        throw new Error(functionError.message || 'Edge Functionの呼び出しに失敗しました');
      }

    } catch (error) {
      console.error('Error sending contact:', error);
      toast({
        title: "エラー",
        description: error.message || "送信に失敗しました",
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
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleNavigateToPost = (postId) => {
    if (postId) {
      navigate(`/post/${postId}`);
      window.scrollTo(0, 0);
    }
  };

  const handleGoBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // If no history, go to home
      navigate('/');
    }
  };

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
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
              {user ? (
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-700 truncate max-w-[80px] sm:max-w-[150px]">
                    {user.firstName || user.email?.split('@')[0]}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs px-2 sm:px-3" onClick={() => navigate('/profile')}>
                    <span className="hidden sm:inline">プロフィール</span>
                    <span className="sm:hidden">プロフ</span>
                  </Button>
                  {isAdmin && (
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

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={handleGoBack}
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
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-2">
                      <CardTitle className="text-xl sm:text-2xl flex-1">{post.title}</CardTitle>
                      <span className="text-xs text-gray-400 font-mono">#{post._row_id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-gray-600"
                      >
                        {post.post_type === 'event' ? 'イベント' : (postTypeLabels[post.post_type] ?? post.post_type)}
                      </Badge>
                      {post.condition && (
                        <Badge
                          variant="secondary"
                          className={conditionColors[post.condition] || 'bg-gray-100 text-gray-800'}
                        >
                          {conditionLabels[post.condition] || post.condition}
                        </Badge>
                      )}
                      {post.category_uuid && (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-700"
                        >
                          {getCategoryName(post.category_uuid)}
                        </Badge>
                      )}
                      {post.post_type === 'free' && post.price && (
                        <span className="text-green-600 font-semibold text-base sm:text-lg">
                          {post.price} SEK
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

                  {/* Share Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare('copy')}
                      className="flex items-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      URLコピー
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare('line')}
                      className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                    >
                      <MessageSquare className="w-4 h-4" />
                      LINE
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare('twitter')}
                      className="flex items-center gap-2 bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-700"
                    >
                      <Twitter className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare('facebook')}
                      className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </Button>
                  </div>

                </div>

                {/* Navigation Posts */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNavigateToPost(previousPost?._row_id)}
                    disabled={!previousPost}
                    className="flex items-center gap-2 text-sm flex-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="truncate max-w-[120px]">
                      {previousPost ? previousPost.title : '前の投稿'}
                    </span>
                  </Button>
                  <div className="px-2 text-xs text-gray-500">
                    {allPosts.findIndex(p => p?._row_id === post._row_id) + 1} / {allPosts.length}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNavigateToPost(nextPost?._row_id)}
                    disabled={!nextPost}
                    className="flex items-center gap-2 text-sm flex-1"
                  >
                    <span className="truncate max-w-[120px]">
                      {nextPost ? nextPost.title : '次の投稿'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {/* Main Image - 50% size */}
                <div className="mb-6">
                  <div className="relative mx-auto w-1/2">
                    <img 
                      src={
                        post.images && post.images.length > 0
                          ? post.images[selectedImageIndex] || post.images[0]
                          : '/content/templates/sverige_blank.png'
                      } 
                      alt={post.title}
                      className="w-full h-auto object-cover rounded-lg"
                    />
                    {post.images && post.images.length > 1 && (
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs sm:text-sm">
                        {selectedImageIndex + 1} / {post.images.length}
                      </div>
                    )}
                  </div>
                </div>

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
                    <div className="space-y-3">
                      {post.event_date_readable && (
                        <div className="flex items-center text-purple-700">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="font-medium">開催日:</span>
                          <span className="ml-2">{post.event_date_readable}</span>
                        </div>
                      )}
                      
                      {post.event_location && (
                        <div className="flex items-center text-purple-700">
                          <MapPin className="w-4 h-4 mr-2" />
                          <span className="font-medium">場所:</span>
                          <span className="ml-2">{post.event_location}</span>
                        </div>
                      )}

                      {post.event_fee && (
                        <div className="flex items-center text-purple-700">
                          <DollarSign className="w-4 h-4 mr-2" />
                          <span className="font-medium">参加費:</span>
                          <span className="ml-2">{post.event_fee}</span>
                        </div>
                      )}

                      {/* Calendar Add Buttons */}
                      <div className="pt-3 border-t border-purple-200">
                        <p className="text-sm font-medium text-purple-800 mb-2">カレンダーに追加:</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleAddToCalendar('google')}
                            size="sm"
                            variant="outline"
                            className="bg-white hover:bg-gray-50 border-purple-300 text-purple-700"
                          >
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google カレンダー
                          </Button>
                          <Button
                            onClick={() => handleAddToCalendar('ics')}
                            size="sm"
                            variant="outline"
                            className="bg-white hover:bg-gray-50 border-purple-300 text-purple-700"
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            ICS ファイル
                          </Button>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">
                          ※ ICSファイルはAppleカレンダー、Outlook、その他カレンダーアプリで使用できます
                        </p>
                      </div>
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

                {/* Product Information */}
                {(post.brand || post.model_name || post.size_dimensions) && (
                  <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      商品情報
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      {post.brand && (
                        <div>
                          <span className="font-medium text-gray-700">ブランド:</span>
                          <p className="text-gray-900">{post.brand}</p>
                        </div>
                      )}
                      {post.model_name && (
                        <div>
                          <span className="font-medium text-gray-700">モデル名/番号:</span>
                          <p className="text-gray-900">{post.model_name}</p>
                        </div>
                      )}
                      {post.size_dimensions && (
                        <div>
                          <span className="font-medium text-gray-700">サイズ/寸法:</span>
                          <p className="text-gray-900">{post.size_dimensions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Job Information - Only show for job postings */}
                {(post.company_name || post.salary || post.employment_type || post.experience_level || post.work_location) && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center text-blue-800">
                      <Briefcase className="w-5 h-5 mr-2" />
                      求人情報
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {post.company_name && (
                        <div className="flex items-start text-blue-700">
                          <Building className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">会社名:</span>
                            <p className="text-blue-900 mt-0.5">{post.company_name}</p>
                          </div>
                        </div>
                      )}
                      {post.salary && (
                        <div className="flex items-start text-blue-700">
                          <DollarSign className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">給与:</span>
                            <p className="text-blue-900 mt-0.5">{post.salary}</p>
                          </div>
                        </div>
                      )}
                      {post.employment_type && (
                        <div className="flex items-start text-blue-700">
                          <Briefcase className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">就業形態:</span>
                            <p className="text-blue-900 mt-0.5">{employmentTypeLabels[post.employment_type] || post.employment_type}</p>
                          </div>
                        </div>
                      )}
                      {post.experience_level && (
                        <div className="flex items-start text-blue-700">
                          <TrendingUp className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">経験:</span>
                            <p className="text-blue-900 mt-0.5">{experienceLevelLabels[post.experience_level] || post.experience_level}</p>
                          </div>
                        </div>
                      )}
                      {post.work_location && (
                        <div className="flex items-start text-blue-700 sm:col-span-2">
                          <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">勤務地:</span>
                            <p className="text-blue-900 mt-0.5">{post.work_location}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                        {post.subcategory_uuid && (
                          <span className="ml-2 text-gray-900 font-medium">
                            {' > '}{getSubcategoryName(post.subcategory_uuid)}
                          </span>
                        )}
                      </div>
                    )}
                    {post.location_uuid && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span className="text-xs sm:text-sm">場所: {getLocationName(post.location_uuid)}</span>
                      </div>
                    )}
                    {post.postal_code && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span className="text-xs sm:text-sm">郵便番号: {post.postal_code}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Section */}
          <div className="xl:col-span-1 space-y-4">
            {/* Map Card */}
            {post.location_uuid && (
              <Card>
                <CardContent className="p-0">
                  <div className="w-full" style={{ height: '300px' }}>
                    <SingleLocationMap 
                      locationName={getLocationName(post.location_uuid)}
                      latitude={getLocationData(post.location_uuid)?.latitude}
                      longitude={getLocationData(post.location_uuid)?.longitude}
                      className="w-full h-full"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Contact Card */}
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
                  {/* 自分の投稿の場合は連絡ボタンを非表示 */}
                  {user && user.userUuid === post._created_by ? (
                    <div className="text-sm text-gray-500 italic">
                      自分の投稿には連絡できません
                    </div>
                  ) : (
                    <Button 
                      onClick={handleContactClick}
                      className="w-full"
                      size="lg"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      問い合わせる
                    </Button>
                  )}
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
            {/* 送信方法の選択 */}
            <div>
              <Label>送信方法</Label>
              <RadioGroup value={contactMethod} onValueChange={setContactMethod} className="mt-2">
                <div className="flex items-start space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <RadioGroupItem value="dm" id="dm" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="dm" className="cursor-pointer font-medium text-gray-900">
                      サイト内メッセージで送る（おすすめ）
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      メールアドレスは相手に知られません
                    </p>
                  </div>
                </div>
                {post.userProfile?.contact_pref !== 'dm_only' && (
                  <div className="flex items-start space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <RadioGroupItem value="email" id="email" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="email" className="cursor-pointer font-medium text-gray-900">
                        メールで連絡する
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        あなたのメールアドレスが相手に伝わります
                      </p>
                    </div>
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* メッセージ入力欄 */}
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

            {/* メッセージを見るボタン（DM送信成功後に表示） */}
            {showMessageButton && (
              <div className="pt-2">
                <Button
                  onClick={() => navigate('/messages')}
                  variant="outline"
                  className="w-full"
                  type="button"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  メッセージを見る
                </Button>
              </div>
            )}

            {/* 送信ボタン */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsContactModalOpen(false);
                  setShowMessageButton(false);
                }}
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