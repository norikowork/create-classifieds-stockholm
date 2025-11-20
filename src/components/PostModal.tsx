import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import db from '@/lib/shared/kliv-database';
import content from '@/lib/shared/kliv-content';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, Search, Briefcase, User, Trash2 } from 'lucide-react';

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  user: any;
  editingPost?: any;
}

const categoryIcons = {
  'cat-for-sale': ShoppingBag,
  'cat-wanted': Search,
  'cat-job-offering': Briefcase,
  'cat-job-seeking': User
};

export const PostModal = ({ isOpen, onClose, onPostCreated, user, editingPost }: PostModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_uuid: '',
    post_type: 'free',
    price: '',
    location_uuid: '',
    contact_method: 'email',
    phone: '',
    email: user?.email || ''
  });
  const [error, setError] = useState('');
  const { toast } = useToast();

  const isAdmin = user?.isPrimaryOrg || user?.userMetadata?.is_admin;
  console.log('PostModal - user:', user);
  console.log('PostModal - isAdmin:', isAdmin);
  console.log('PostModal - editingPost:', editingPost);

  useEffect(() => {
    console.log('PostModal render - isOpen:', isOpen, 'isAdmin:', isAdmin, 'editingPost:', editingPost);
    if (isOpen) {
      console.log('Modal is opening, fetching data...');
      fetchData();
      
      // Check if file input exists in DOM after modal opens
      setTimeout(() => {
        const adminInput = document.getElementById('admin-images');
        console.log('🔥🔥🔥 Admin file input in DOM:', !!adminInput);
        if (adminInput) {
          console.log('🔥🔥🔥 Admin input element:', adminInput);
          console.log('🔥🔥🔥 Admin input type:', adminInput.getAttribute('type'));
          console.log('🔥🔥🔥 Admin input disabled:', adminInput.getAttribute('disabled'));
        }
      }, 1000);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && editingPost && categories.length > 0 && locations.length > 0) {
      console.log('Editing post images:', editingPost.images);
      console.log('Editing post data:', editingPost);
      console.log('🔥 Available fields:', Object.keys(editingPost));
      console.log('🔥 category field:', editingPost.category);
      console.log('🔥 location field:', editingPost.location);
      console.log('🔥 category_uuid field:', editingPost.category_uuid);
      console.log('🔥 location_uuid field:', editingPost.location_uuid);
      
      const newFormData = {
        title: editingPost.title || '',
        description: editingPost.description || '',
        category_uuid: editingPost.category_uuid || editingPost.category || '',
        post_type: editingPost.post_type || 'free',
        price: editingPost.price || '',
        location_uuid: editingPost.location_uuid || editingPost.location || '',
        contact_method: editingPost.contact_method || 'email',
        phone: editingPost.phone || '',
        email: editingPost.email || ''
      };
      
      console.log('🔥 New formData for editing:', newFormData);
      setFormData(newFormData);
      const parsedImages = editingPost.images ? (typeof editingPost.images === 'string' ? JSON.parse(editingPost.images) : editingPost.images) : [];
      console.log('Parsed images for editing:', parsedImages);
      setImageUrls(parsedImages);
    } else if (isOpen && !editingPost) {
      console.log('New post mode, resetting form');
      resetForm();
    }
  }, [isOpen, editingPost, categories, locations]);

  useEffect(() => {
    console.log('🔥 imageUrls changed:', imageUrls);
  }, [imageUrls]);

  const resetForm = () => {
    console.log('Reset form called');
    setFormData({
      title: '',
      description: '',
      category_uuid: '',
      post_type: 'free',
      price: '',
      location_uuid: '',
      contact_method: 'email',
      phone: '',
      email: user?.email || ''
    });
    setImageUrls([]);
    setError('');
  };

  const fetchData = async () => {
    try {
      const [categoriesResult, locationsResult] = await Promise.all([
        db.query('categories', { _deleted: 'eq.0' }),
        db.query('locations', { _deleted: 'eq.0' })
      ]);
      console.log('Categories fetched:', categoriesResult);
      console.log('Locations fetched:', locationsResult);
      setCategories(categoriesResult || []);
      // Sort locations: English name alphabetically, but put "Other" and "Övriga" at the end
      const specialLocations = ['Other (including Japan)', 'Övriga Stockholmsområden'];
      const normalLocations = (locationsResult || []).filter((loc: any) => 
        !specialLocations.includes(loc.name_en)
      ).sort((a: any, b: any) => 
        (a.name_en || '').localeCompare(b.name_en || '')
      );
      const specialAreaLocations = (locationsResult || []).filter((loc: any) => 
        specialLocations.includes(loc.name_en)
      ).sort((a: any, b: any) => 
        // Keep Övriga last, Other before it
        a.name_en === 'Other (including Japan)' ? -1 : 1
      );
      const sortedLocations = [...normalLocations, ...specialAreaLocations];
      setLocations(sortedLocations);
    } catch (err) {
      console.error('Data fetch error:', err);
      setError('データの読み込みに失敗しました');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (files: FileList | null) => {
    console.log('🔥🔥🔥 handleImageUpload called with files!');
    console.log('🔥🔥🔥 Files:', files);
    
    if (!files) {
      console.log('🔥🔥🔥 No files provided');
      return;
    }

    const fileArray = Array.from(files);
    console.log('🔥🔥🔥 Files selected:', fileArray.length, 'files:', fileArray);
    
    // 1ファイル1MBのサイズ制限チェック
    const maxSizeBytes = 1 * 1024 * 1024; // 1MB
    const validFiles = fileArray.filter(file => {
      if (file.size > maxSizeBytes) {
        console.log('🔥🔥🔥 File too large:', file.name, 'size:', file.size, 'limit:', maxSizeBytes);
        toast({
          title: "ファイルサイズ超過",
          description: `${file.name}は ${(file.size / (1024 * 1024)).toFixed(2)}MB です。1ファイル1MBまでにしてください。`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) {
      console.log('🔥🔥🔥 No valid files after size check');
      return;
    }
    
    if (validFiles.length < fileArray.length) {
      toast({
        title: "一部のファイルがサイズ制限を超えました",
        description: "1ファイルのサイズは1MBまでにしてください。"
      });
    }
    
    const remainingSlots = 3 - imageUrls.length;
    const filesToUpload = validFiles.slice(0, remainingSlots);
    console.log('🔥🔥🔥 Files to upload:', filesToUpload.length, 'current URLs:', imageUrls);

    if (filesToUpload.length === 0) {
      console.log('🔥🔥🔥 No files to upload, exiting');
      return;
    }

    const newUrls: string[] = [];
    
    for (const file of filesToUpload) {
      try {
        console.log('🔥🔥🔥 Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
        console.log('🔥🔥🔥 content SDK available:', !!content);
        console.log('🔥🔥🔥 uploadFile method available:', typeof content.uploadFile);
        
        const result = await content.uploadFile(file, '/content/uploads/');
        console.log('🔥🔥🔥 Upload result:', result);
        console.log('🔥🔥🔥 Upload result keys:', Object.keys(result || {}));
        console.log('🔥🔥🔥 Upload result type:', typeof result);
        
        // 結果の様々な可能性をチェック
        let imageUrl = null;
        
        if (result && result.contentUrl) {
          imageUrl = result.contentUrl;
        } else if (result && result.url) {
          imageUrl = result.url;
        } else if (result && result.fileUrl) {
          imageUrl = result.fileUrl;
        } else if (result && result.path) {
          // Content SDKはpathを返す、それをコンテンツURLに変換
          imageUrl = result.path;
        } else if (result && typeof result === 'string') {
          imageUrl = result;
        } else if (result && result.data && result.data.contentUrl) {
          imageUrl = result.data.contentUrl;
        } else if (result && result.data && result.data.url) {
          imageUrl = result.data.url;
        } else if (result && result.data && result.data.path) {
          imageUrl = result.data.path;
        }
        
        if (imageUrl) {
          console.log('🔥🔥🔥 Adding URL to state:', imageUrl);
          newUrls.push(imageUrl);
        } else {
          console.log('🔥🔥🔥 No URL found in upload result:', result);
          console.log('🔥🔥🔥 Result structure:', JSON.stringify(result, null, 2));
        }
      } catch (err) {
        console.error('🔥🔥🔥 Image upload error:', err);
        toast({
          title: "画像のアップロードに失敗しました",
          description: err?.message || 'Unknown error',
          variant: "destructive"
        });
      }
    }
    
    if (newUrls.length > 0) {
      console.log('🔥🔥🔥 Updating imageUrls state with:', newUrls);
      setImageUrls(prev => {
        const updatedUrls = [...prev, ...newUrls];
        console.log('🔥🔥🔥 Final image URLs state:', updatedUrls);
        return updatedUrls;
      });
      
      // アップロード成功をトーストで通知
      toast({
        title: `${newUrls.length}枚の画像をアップロードしました`
      });
    } else {
      console.log('🔥🔥🔥 No new URLs to add');
    }
  };

  // 変更イベントハンドラ
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔥🔥🔥 File input onChange triggered!');
    console.log('🔥🔥🔥 Files property:', e.target.files);
    handleImageUpload(e.target.files);
    // ファイル入力をクリア
    e.target.value = '';
  };

  // デバッグ用: 1秒ごとに画像URL状態を確認
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        console.log('🔥🔥🔥 Current imageUrls state:', imageUrls);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, imageUrls]);

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValid = () => {
    console.log('🔥 isFormValid check:');
    console.log('🔥 - isAdmin:', isAdmin);
    console.log('🔥 - editingPost:', editingPost);
    console.log('🔥 - title:', formData.title.trim());
    console.log('🔥 - description:', formData.description.trim());
    console.log('🔥 - category_uuid:', formData.category_uuid);
    console.log('🔥 - location_uuid:', formData.location_uuid);
    console.log('🔥 - email:', formData.email);
    console.log('🔥 - contact_method:', formData.contact_method);
    console.log('🔥 - phone:', formData.phone);
    
    if (isAdmin && editingPost) return formData.title.trim() && formData.description.trim();
    
    const result = (
      formData.title.trim() &&
      formData.description.trim() &&
      formData.category_uuid &&
      formData.location_uuid &&
      formData.email &&
      ((formData.contact_method === 'phone' && formData.phone) || formData.contact_method !== 'phone')
    );
    
    console.log('🔥 - isFormValid result:', result);
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔥 Submit button clicked - current imageUrls:', imageUrls);
    console.log('🔥 Submit - imageUrls length:', imageUrls.length);
    
    if (!isFormValid()) {
      setError('必須項目をすべて入力してください');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      console.log('FormData before cleanup:', formData);
      console.log('🔥 imageUrls before save:', imageUrls);
      console.log('🔥 typeof imageUrls:', typeof imageUrls);
      console.log('🔥 Array.isArray(imageUrls):', Array.isArray(imageUrls));
      console.log('🔥 imageUrls content:', JSON.stringify(imageUrls));
      
      const { location_id, ...cleanFormData } = formData;
      const postData = {
        ...cleanFormData,
        images: imageUrls,
        location_uuid: formData.location_uuid, // Ensure location_uuid is included
        _updated_at: Math.floor(Date.now() / 1000)
      };
      console.log('PostData to send:', postData);

      if (editingPost) {
        await db.update('posts', { _row_id: `eq.${editingPost._row_id}` }, postData);
        toast({ title: "投稿を更新しました" });
      } else {
        await db.insert('posts', postData);
        toast({ title: "投稿を作成しました" });
      }

      onPostCreated();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Post creation error:', err);
      setError(editingPost ? '投稿の更新に失敗しました' : '投稿の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  console.log('PostModal render - isOpen:', isOpen, 'isAdmin:', isAdmin, 'editingPost:', editingPost);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAdmin && editingPost ? '投稿を編集' : '新しい投稿'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} key={`form-${editingPost?._row_id || 'new'}`} className="space-y-6">
          {/* Show all fields for editing */}
          {isAdmin ? (
            <>
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">カテゴリー *</Label>
                <Select 
                  value={formData.category_uuid} 
                  onValueChange={(value) => {
                    console.log('🔥 Admin Category changed to:', value);
                    handleInputChange('category_uuid', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリーを選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category: any) => (
                      <SelectItem key={category.uuid} value={category.uuid}>
                        {category.name_ja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">管理者 - 現在のUUID: {formData.category_uuid || '未選択'}</p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">タイトル *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="例：iPhone 13、家、翻訳作業など"
                  required
                />
              </div>
{/* Post Type for Admin */}
              {isAdmin && (
                <>
                  {console.log('🔥 Rendering admin post type radio buttons, isAdmin:', isAdmin, 'editingPost:', !!editingPost, 'mode:', editingPost ? 'edit' : 'new')}
                <div className="space-y-2">
                  <Label htmlFor="post_type">投稿タイプ *</Label>
                  <RadioGroup 
                    value={formData.post_type} 
                    onValueChange={(value) => handleInputChange('post_type', value)}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="free" id="admin_free" />
                        <Label htmlFor="admin_free">無料</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="paid" id="admin_paid" />
                        <Label htmlFor="admin_paid">有料</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="donation" id="admin_donation" />
                        <Label htmlFor="admin_donation">寄付</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                </>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">詳細説明 *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="商品やサービス、仕事内容について詳しく説明してください"
                  rows={4}
                  required
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">価格</Label>
                <Input
                  id="price"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="例：無料、500 SEK、寄付歓迎など"
                />
              </div>

              {/* Contact Method */}
              <div className="space-y-2">
                <Label>連絡方法 *</Label>
                <RadioGroup 
                  value={formData.contact_method} 
                  onValueChange={(value) => handleInputChange('contact_method', value)}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email">メールのみ</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="phone" id="phone" />
                      <Label htmlFor="phone">電話のみ</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both">両方</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="contact-email">メールアドレス *</Label>
                {isAdmin ? (
                  <Input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                ) : (
                  <Input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-50 cursor-not-allowed"
                    required
                  />
                )}
                {!isAdmin && (
                  <p className="text-sm text-gray-500">ログイン中のユーザーのメールアドレスが使用されます</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号{!isAdmin && '（プロフィール設定から変更）'}</Label>
                {isAdmin ? (
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="例：070-123-4567"
                  />
                ) : (
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone || '未設定'}
                    disabled
                    className="bg-gray-50 cursor-not-allowed"
                  />
                )}
                {!isAdmin && (
                  <p className="text-sm text-gray-500">プロフィールに登録されている電話番号が使用されます</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">地域 *</Label>
                <Select 
                  value={formData.location_uuid} 
                  onValueChange={(value) => handleInputChange('location_uuid', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="地域を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.uuid} value={location.uuid}>
                        {location.name_en || location.name_ja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Images */}
              <div className="space-y-2">
                <Label htmlFor="images">画像</Label>
                <div className="space-y-4">
                  {/* Existing images */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Admin Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                            onLoad={() => console.log(`Admin Image ${index} loaded successfully:`, url)}
                            onError={() => console.error(`Admin Image ${index} failed to load:`, url)}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Admin Image upload */}
                  <div>
                    <input
                      type="file"
                      id="admin-images"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target?.files && e.target.files.length > 0) {
                          handleImageUpload(e.target.files);
                        }
                      }}
                      disabled={imageUrls.length >= 3}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {imageUrls.length >= 3 && (
                      <p className="text-sm text-muted-foreground mt-1">最大3枚まで画像を追加できます</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Regular user form */
            <>
              {console.log('🔥 Rendering regular user form with post type radio buttons')}
              {/* Post Type */}
              <div className="space-y-2">
                <Label htmlFor="post_type">投稿タイプ *</Label>
                <RadioGroup 
                  value={formData.post_type} 
                  onValueChange={(value) => handleInputChange('post_type', value)}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="free" id="free" />
                      <Label htmlFor="free">無料</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="paid" id="paid" />
                      <Label htmlFor="paid">有料</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="donation" id="donation" />
                      <Label htmlFor="donation">寄付</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">カテゴリー *</Label>
                <Select 
                  value={formData.category_uuid} 
                  onValueChange={(value) => {
                    console.log('🔥 User Category changed to:', value);
                    handleInputChange('category_uuid', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリーを選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category: any) => (
                      <SelectItem key={category.uuid} value={category.uuid}>
                        {category.name_ja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">ユーザー - 現在のUUID: {formData.category_uuid || '未選択'}</p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">タイトル *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="例：iPhone 13、家、翻訳作業など"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">詳細説明 *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="商品やサービス、仕事内容について詳しく説明してください"
                  rows={4}
                  required
                />
              </div>

              {/* Price */}
              {(formData.post_type === 'paid' || formData.post_type === 'donation') && (
                <div className="space-y-2">
                  <Label htmlFor="price">価格</Label>
                  <Input
                    id="price"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    placeholder="例：無料、500 SEK、寄付歓迎など"
                  />
                </div>
              )}

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">地域 *</Label>
                <Select 
                  value={formData.location_uuid} 
                  onValueChange={(value) => handleInputChange('location_uuid', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="地域を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.uuid} value={location.uuid}>
                        {location.name_en || location.name_ja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Information */}
              <div className="space-y-2">
                <Label>連絡方法 *</Label>
                <RadioGroup 
                  value={formData.contact_method} 
                  onValueChange={(value) => handleInputChange('contact_method', value)}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email">メールのみ</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="phone" id="phone" />
                      <Label htmlFor="phone">電話のみ</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both">両方</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="contact-email">メールアドレス *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>

              {/* Phone */}
              {(formData.contact_method === 'phone' || formData.contact_method === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号 *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="例：070-123-4567"
                    required={formData.contact_method !== 'email'}
                  />
                </div>
              )}

              {/* Images */}
              <div className="space-y-2">
                <Label htmlFor="images">画像</Label>
                <div className="space-y-4">
                  
                  
                  {/* Existing images */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`User Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                            onLoad={() => console.log(`🔥 User Image ${index} loaded successfully:`, url)}
                            onError={() => console.error(`🔥 User Image ${index} failed to load:`, url)}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* User Image upload */}
                  {imageUrls.length < 3 && (
                    <div>
                      <Input
                        id="user-images"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={imageUrls.length >= 3}
                      />
                      {imageUrls.length >= 3 && (
                        <p className="text-sm text-gray-500 mt-1">最大3枚まで画像を追加できます</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid()}
            >
              {isSubmitting ? "送信中..." : editingPost ? "更新" : "投稿"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};