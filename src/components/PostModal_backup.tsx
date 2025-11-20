import { useState, useEffect } from 'react';
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
import { ShoppingBag, Search, Briefcase, User, Upload, X, Image as ImageIcon } from 'lucide-react';

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  user: any;
}

const categoryIcons = {
  'cat-for-sale': ShoppingBag,
  'cat-wanted': Search,
  'cat-job-offering': Briefcase,
  'cat-job-seeking': User
};

export const PostModal = ({ isOpen, onClose, onPostCreated, user }: PostModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_uuid: '',
    post_type: 'for_sale',
    price: '',
    location: '',
    location_id: '',
    contact_method: 'email',
    phone: '',
    email: ''
  });
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadLocations();
      if (user) {
        setFormData(prev => ({
          ...prev,
          email: user.email || ''
        }));
      }
    }
  }, [isOpen, user]);

  const loadCategories = async () => {
    try {
      const categoriesData = await db.query('categories', { _deleted: 'eq.0' });
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== files.length) {
      toast({
        title: "エラー",
        description: "画像ファイルのみアップロードできます",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedFiles.length + validFiles.length > 3) {
      toast({
        title: "エラー",
        description: "最大3枚まで画像をアップロードできます",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (selectedFiles.length === 0) return ['/content/placeholders/no-image.svg'];
    
    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const result = await content.uploadFile(file, '/content/posts/');
        return result.contentUrl;
      });
      
      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw new Error('画像のアップロードに失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category_uuid: '',
      post_type: 'for_sale',
      price: '',
      location: '',
      location_id: '',
      contact_method: 'email',
      phone: '',
      email: user?.email || ''
    });
    setSelectedFiles([]);
    setUploadedImages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.title || !formData.description || !formData.category_uuid || !formData.location_id) {
        setError('タイトル、説明、カテゴリー、地域は必須です');
        setIsLoading(false);
        return;
      }

      // Validate phone if phone contact is selected
      if (formData.contact_method === 'phone' || formData.contact_method === 'both') {
        if (!formData.phone) {
          setError('電話番号の連絡先を選択した場合は電話番号を入力してください');
          setIsLoading(false);
          return;
        }
      }

      // Upload images first
      const imageUrls = await uploadImages();

      await db.insert('posts', {
        ...formData,
        images: JSON.stringify(imageUrls),
        status: 'active'
      });

      // Update user profile with phone if provided
      if (formData.phone && user) {
        const existingProfile = await db.query('user_profiles', { 
          user_uuid: `eq.${user.userUuid}` 
        });
        
        if (existingProfile.length > 0) {
          await db.update('user_profiles', 
            { user_uuid: `eq.${user.userUuid}` },
            { phone: formData.phone }
          );
        } else {
          await db.insert('user_profiles', {
            user_uuid: user.userUuid,
            phone: formData.phone
          });
        }
      }

      toast({
        title: "投稿成功",
        description: "投稿が公開されました",
      });

      // Reset form
      resetForm();

      onPostCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || '投稿に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedCategory = categories.find(c => c.uuid === formData.category_uuid);
  const availablePostTypes = selectedCategory?.uuid === 'cat-job-offering' || selectedCategory?.uuid === 'cat-job-seeking'
    ? ['job_offering', 'job_seeking']
    : ['for_sale', 'wanted'];

  return (
    <Dialog open={isOpen} onOpenChange={() => {
    resetForm();
    setError('');
    onClose();
  }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規投稿</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>カテゴリー</Label>
            <Select 
              value={formData.category_uuid} 
              onValueChange={(value) => {
                handleInputChange('category_uuid', value);
                // Auto-select appropriate post type
                if (value === 'cat-job-offering') {
                  handleInputChange('post_type', 'job_offering');
                } else if (value === 'cat-job-seeking') {
                  handleInputChange('post_type', 'job_seeking');
                } else {
                  handleInputChange('post_type', 'for_sale');
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="カテゴリーを選択" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => {
                  const IconComponent = categoryIcons[category.uuid] || ShoppingBag;
                  return (
                    <SelectItem key={category.uuid} value={category.uuid}>
                      <div className="flex items-center space-x-2">
                        <IconComponent className="w-4 h-4" />
                        <span>{category.name_ja}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Post Type */}
          <div className="space-y-2">
            <Label>投稿タイプ</Label>
            <RadioGroup 
              value={formData.post_type} 
              onValueChange={(value) => handleInputChange('post_type', value)}
            >
              <div className="flex flex-col space-y-2">
                {availablePostTypes.includes('for_sale') && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="for_sale" id="for_sale" />
                    <Label htmlFor="for_sale">売ります</Label>
                  </div>
                )}
                {availablePostTypes.includes('wanted') && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wanted" id="wanted" />
                    <Label htmlFor="wanted">探しています</Label>
                  </div>
                )}
                {availablePostTypes.includes('job_offering') && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="job_offering" id="job_offering" />
                    <Label htmlFor="job_offering">仕事募集</Label>
                  </div>
                )}
                {availablePostTypes.includes('job_seeking') && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="job_seeking" id="job_seeking" />
                    <Label htmlFor="job_seeking">仕事探し</Label>
                  </div>
                )}
              </div>
            </RadioGroup>
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

          {/* Price (for sale items only) */}
          {formData.post_type === 'for_sale' && (
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

          {/* Contact Methods - Email */}
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
        </>
      )}
      
      {/* Admin-only editable fields */}
      {isAdmin && editingPost && (
        <>
          {/* Location Edit */}
          <div className="space-y-2">
            <Label htmlFor="location">地域 *</Label>
            <Select 
              value={formData.location_id} 
              onValueChange={(value) => handleInputChange('location_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="地域を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location._row_id} value={location._row_id.toString()}>
                    {location.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

          {/* Contact Methods - Phone */}
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
                        alt={`Image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
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
              
              {/* Image upload */}
              {imageUrls.length < 3 && (
                <div>
                  <Input
                    id="images"
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

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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

                required
              />
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>画像（最大5枚）</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label 
                htmlFor="image-upload"
                className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">画像を選択</span>
                <span className="text-xs text-gray-500 mt-1">またはドラッグ＆ドロップ</span>
              </label>
              
              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative">
                      <div className="aspect-square bg-gray-100 rounded overflow-hidden">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={`選択された画像 ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                        {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? '投稿中...' : '投稿する'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};