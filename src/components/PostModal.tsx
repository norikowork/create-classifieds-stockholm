import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import db from '@/lib/shared/kliv-database';
import content from '@/lib/shared/kliv-content';
import auth from '@/lib/shared/kliv-auth';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, Search, Briefcase, User, Trash2, Package, MapPin, Mail, Phone, Image as ImageIcon, X, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_uuid: '',
    subcategory_uuid: '',
    post_type: '',
    price: '',
    location_uuid: '',
    postal_code: '',
    // Detailed address fields
    show_detailed_address: false,
    street: '',
    cross_street: '',
    city: '',
    // For Sale fields
    brand: '',
    model_name: '',
    size_dimensions: '',
    condition: '',
    // Job Seeking fields
    company_name: '',
    salary: '',
    employment_type: '',
    experience_level: '',
    work_location: '',
    // Housing fields
    rent: '',
    rooms: '',
    area_sqm: '',
    available_date: '',
    // Services fields
    service_fee: '',
    service_area: '',
    availability: '',
    // Event fields
    event_date: '',
    event_location: '',
    event_fee: '',
    // Contact fields
    contact_method: 'email',
    phone: '',
    email: user?.email || ''
  });
  const [error, setError] = useState('');

  const isAdmin = user?.isPrimaryOrg || user?.userMetadata?.is_admin;

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && editingPost && categories.length > 0 && locations.length > 0) {
      const newFormData = {
        title: editingPost.title || '',
        description: editingPost.description || '',
        category_uuid: editingPost.category_uuid || editingPost.category || '',
        subcategory_uuid: editingPost.subcategory_uuid || '',
        post_type: editingPost.post_type || 'free',
        price: editingPost.price || '',
        location_uuid: editingPost.location_uuid || editingPost.location || '',
        postal_code: editingPost.postal_code || '',
        // Detailed address fields
        show_detailed_address: editingPost.show_detailed_address || false,
        street: editingPost.street || '',
        cross_street: editingPost.cross_street || '',
        city: editingPost.city || '',
        // For Sale fields
        brand: editingPost.brand || '',
        model_name: editingPost.model_name || '',
        size_dimensions: editingPost.size_dimensions || '',
        condition: editingPost.condition || '',
        // Job Seeking fields
        company_name: editingPost.company_name || '',
        salary: editingPost.salary || '',
        employment_type: editingPost.employment_type || '',
        experience_level: editingPost.experience_level || '',
        work_location: editingPost.work_location || '',
        // Housing fields
        rent: editingPost.rent || '',
        rooms: editingPost.rooms || '',
        area_sqm: editingPost.area_sqm || '',
        available_date: editingPost.available_date || '',
        // Services fields
        service_fee: editingPost.service_fee || '',
        service_area: editingPost.service_area || '',
        availability: editingPost.availability || '',
        // Event fields - convert unix timestamp to datetime-local format
        event_date: editingPost.event_date
          ? (typeof editingPost.event_date === 'number'
            ? new Date(editingPost.event_date * 1000).toISOString().slice(0, 16)
            : editingPost.event_date)
          : '',
        event_location: editingPost.event_location || '',
        event_fee: editingPost.event_fee || '',
        // Contact fields
        contact_method: editingPost.contact_method || 'email',
        phone: editingPost.phone || '',
        email: editingPost.email || ''
      };
      
      setFormData(newFormData);
      const parsedImages = editingPost.images ? (typeof editingPost.images === 'string' ? JSON.parse(editingPost.images) : editingPost.images) : [];
      setImageUrls(parsedImages);

      // Set selectedArea and selectedCounty from editingPost's location
      if (editingPost.location_uuid || editingPost.location) {
        const location = locations.find((loc: any) => loc.uuid === (editingPost.location_uuid || editingPost.location));
        if (location) {
          setSelectedArea(location.area || '');
          setSelectedCounty(location.county || '');
        }
      }
    } else if (isOpen && !editingPost) {
      resetForm();
    }
  }, [isOpen, editingPost, categories, locations]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category_uuid: '',
      subcategory_uuid: '',
      post_type: 'free',
      price: '',
      location_uuid: '',
      postal_code: '',
      // Detailed address fields
      show_detailed_address: false,
      street: '',
      cross_street: '',
      city: '',
      // For Sale fields
      brand: '',
      model_name: '',
      size_dimensions: '',
      condition: '',
      // Job Seeking fields
      company_name: '',
      salary: '',
      employment_type: '',
      experience_level: '',
      work_location: '',
      // Housing fields
      rent: '',
      rooms: '',
      area_sqm: '',
      available_date: '',
      // Services fields
      service_fee: '',
      service_area: '',
      availability: '',
      // Event fields
      event_date: '',
      event_location: '',
      event_fee: '',
      // Contact fields
      contact_method: 'email',
      phone: '',
      email: user?.email || ''
    });
    setImageUrls([]);
    setSelectedArea('');
    setSelectedCounty('');
    setError('');
  };

  const fetchData = async () => {
    try {
      const [categoriesResult, locationsResult, subcategoriesResult] = await Promise.all([
        db.query('categories', { _deleted: 'eq.0' }),
        db.query('locations', { _deleted: 'eq.0' }),
        db.query('subcategories', { _deleted: 'eq.0' })
      ]);
      setCategories(categoriesResult || []);
      setSubcategories(subcategoriesResult || []);
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
    // 掲示板カテゴリーが選択されたらフォーラムページにリダイレクト
    if (field === 'category_uuid' && value === 'cat-bulletin') {
      // モーダルを閉じてフォーラムページに遷移
      onClose();
      navigate('/forum');
      return;
    }

    // Area選択時にCountyとMunicipalityをクリア
    if (field === 'selectedArea') {
      setSelectedArea(value);
      setSelectedCounty('');
      setFormData(prev => ({ ...prev, location_uuid: '' }));
      return;
    }

    // County選択時にMunicipalityをクリア
    if (field === 'selectedCounty') {
      setSelectedCounty(value);
      setFormData(prev => ({ ...prev, location_uuid: '' }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    // Reset subcategory when category changes
    if (field === 'category_uuid') {
      const updates: any = { category_uuid: value, subcategory_uuid: '' };
      // Auto-set post_type for events
      if (value === 'cat-events') {
        updates.post_type = 'event';
      }
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    
    // 1ファイル1MBのサイズ制限チェック
    const maxSizeBytes = 1 * 1024 * 1024; // 1MB
    const validFiles = fileArray.filter(file => {
      if (file.size > maxSizeBytes) {
        toast({
          title: "ファイルサイズ超過",
          description: `${file.name}は ${(file.size / (1024 * 1024)).toFixed(2)}MB です。1ファイル1MBまでにしてください。`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    if (validFiles.length < fileArray.length) {
      toast({
        title: "一部のファイルがサイズ制限を超えました",
        description: "1ファイルのサイズは1MBまでにしてください。"
      });
    }
    
    const remainingSlots = 3 - imageUrls.length;
    const filesToUpload = validFiles.slice(0, remainingSlots);
    if (filesToUpload.length === 0) return;

    const newUrls: string[] = [];
    
    for (const file of filesToUpload) {
      try {
        const result = await content.uploadFile(file, '/content/uploads/');
        
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
          newUrls.push(imageUrl);
        }
      } catch (err) {
        toast({
          title: "画像のアップロードに失敗しました",
          description: err?.message || 'Unknown error',
          variant: "destructive"
        });
      }
    }
    
    if (newUrls.length > 0) {
      setImageUrls(prev => [...prev, ...newUrls]);
      
      // アップロード成功をトーストで通知
      toast({
        title: `${newUrls.length}枚の画像をアップロードしました`
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUpload(e.target.files);
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValid = () => {
    if (isAdmin && editingPost) return formData.title.trim() && formData.description.trim();
    
    // 共通必須フィールド
    const commonFields = (
      formData.title.trim() &&
      formData.description.trim() &&
      formData.category_uuid &&
      formData.location_uuid &&
      formData.email &&
      ((formData.contact_method === 'phone' && formData.phone) || formData.contact_method !== 'phone')
    );
    
    // サブカテゴリ必須チェック
    const subcategoryRequired = 
      ['cat-for-sale', 'cat-job-seeking', 'cat-housing', 'cat-services'].includes(formData.category_uuid);
    const hasSubcategory = !subcategoryRequired || formData.subcategory_uuid;
    
    // カテゴリ固有の必須フィールド
    let categorySpecificFields = true;
    
    if (formData.category_uuid === 'cat-for-sale') {
      categorySpecificFields = formData.price && formData.condition;
    } else if (formData.category_uuid === 'cat-job-seeking') {
      categorySpecificFields = formData.company_name && formData.salary && formData.employment_type && formData.experience_level;
    } else if (formData.category_uuid === 'cat-housing') {
      categorySpecificFields = formData.rent;
    } else if (formData.category_uuid === 'cat-services') {
      categorySpecificFields = formData.service_fee;
    } else if (formData.category_uuid === 'cat-events') {
      categorySpecificFields = formData.event_date;
    }
    
    return commonFields && hasSubcategory && categorySpecificFields;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      setError('必須項目をすべて入力してください');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const currentUser = await auth.getUser();
      if (!currentUser || !currentUser.userUuid) {
        throw new Error('ログインしていません。右上の「ログイン」ボタンからログインしてください。');
      }
      
      if (editingPost && editingPost._created_by !== currentUser.userUuid && !isAdmin) {
        throw new Error('この投稿を編集する権限がありません。自分の投稿のみ編集できます。');
      }

      const { location_id, ...cleanFormData } = formData;
      const postData: any = {
        ...cleanFormData,
        images: JSON.stringify(imageUrls),
        location_uuid: formData.location_uuid,
        show_detailed_address: formData.show_detailed_address || false,
        street: formData.street || '',
        cross_street: formData.cross_street || '',
        city: formData.city || '',
        _updated_at: Math.floor(Date.now() / 1000)
      };

      // For events, compute event_date as unix timestamp and event_date_readable
      if (formData.category_uuid === 'cat-events' && formData.event_date) {
        const eventDate = new Date(formData.event_date);
        postData.event_date = Math.floor(eventDate.getTime() / 1000);
        postData.event_date_readable = format(eventDate, 'yyyy年MM月dd日 (EEEE)', { locale: ja });
      }

      if (editingPost) {
        console.log('Updating post:', editingPost._row_id, postData);
        await db.update('posts', { _row_id: `eq.${editingPost._row_id}` }, postData);
        console.log('Post updated successfully');
        toast({ title: "投稿を更新しました" });
      } else {
        console.log('Creating new post:', postData);
        await db.insert('posts', postData);
        console.log('Post created successfully');
        toast({ title: "投稿を作成しました" });
      }

      // Wait a bit for the database to be updated
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('Calling onPostCreated...');
      await onPostCreated();
      console.log('onPostCreated completed');
      
      resetForm();
      onClose();
    } catch (err) {
      const errorMsg = err?.message || (editingPost ? '投稿の更新に失敗しました' : '投稿の作成に失敗しました');
      setError(errorMsg);
      toast({
        title: editingPost ? "更新エラー" : "作成エラー",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {editingPost ? '投稿を編集' : '新しい投稿'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* カテゴリーと地域 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingBag className="w-5 h-5" />
                カテゴリーと地域
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">カテゴリー *</Label>
                  <Select 
                    value={formData.category_uuid} 
                    onValueChange={(value) => handleInputChange('category_uuid', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: any) => (
                        <SelectItem key={category.uuid} value={category.uuid}>
                          {category.name_ja}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* サブカテゴリー - 売ります、仕事探し、住居、サービスのみ表示 */}
                {(formData.category_uuid === 'cat-for-sale' || formData.category_uuid === 'cat-job-seeking' || formData.category_uuid === 'cat-housing' || formData.category_uuid === 'cat-services') && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">サブカテゴリー *</Label>
                    <Select 
                      value={formData.subcategory_uuid} 
                      onValueChange={(value) => handleInputChange('subcategory_uuid', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories
                          .filter((sub: any) => sub.category_uuid === formData.category_uuid)
                          .sort((a: any, b: any) => a.sort_order - b.sort_order)
                          .map((subcategory: any) => (
                            <SelectItem key={subcategory.uuid} value={subcategory.uuid}>
                              {subcategory.name_ja}
                              {subcategory.price > 0 && (
                                <span className="ml-2 text-orange-600 font-semibold">({subcategory.price}SEK)</span>
                              )}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 3階層地域選択: Area → County → Municipality */}
                <div className="space-y-2">
                  <Label htmlFor="area">エリア（地域） *</Label>
                  <Select 
                    value={selectedArea} 
                    onValueChange={(value) => handleInputChange('selectedArea', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="エリアを選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(locations.map((loc: any) => loc.area || 'Other')))
                        .sort()
                        .map((area) => (
                          <SelectItem key={area} value={area}>
                            {area === 'gotaland' ? 'イェータランド（南側）' : 
                             area === 'svealand' ? 'スヴェアランド（中央）' : 
                             area === 'norrland' ? 'ノールランド（北側）' : area}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedArea && (
                  <div className="space-y-2">
                    <Label htmlFor="county">県 *</Label>
                    <Select 
                      value={selectedCounty} 
                      onValueChange={(value) => handleInputChange('selectedCounty', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="県を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(
                          locations
                            .filter((loc: any) => loc.area === selectedArea)
                            .map((loc: any) => loc.county)
                        ))
                          .sort()
                          .map((county) => (
                            <SelectItem key={county} value={county}>
                              {county}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedArea && selectedCounty && (
                  <div className="space-y-2">
                    <Label htmlFor="location">市町村 *</Label>
                    <Select 
                      value={formData.location_uuid} 
                      onValueChange={(value) => handleInputChange('location_uuid', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="市町村を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations
                          .filter((loc: any) => loc.area === selectedArea && loc.county === selectedCounty)
                          .sort((a: any, b: any) => (a.name_ja || a.name_en).localeCompare(b.name_ja || b.name_en))
                          .map((location) => (
                            <SelectItem key={location.uuid} value={location.uuid}>
                              {location.name_ja || location.name_en}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">郵便番号</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => handleInputChange('postal_code', e.target.value)}
                  placeholder="例：123 45 または 12345"
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* タイトルと説明 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="w-5 h-5" />
                投稿内容
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">タイトル *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder={
                    formData.category_uuid === 'cat-for-sale' ? '例：iPhone 13、IKEAの椅子、自転車など' :
                    formData.category_uuid === 'cat-job-seeking' ? '例：ウェブ開発者、日本語教師、レストランスタッフ' :
                    formData.category_uuid === 'cat-housing' ? '例：中央駅近くの1LDK、シェアハウス募集' :
                    formData.category_uuid === 'cat-services' ? '例：家事代行、ペットシッター、翻訳サービス' :
                    formData.category_uuid === 'cat-events' ? '例：日本語交流会、テニス大会、オンラインセミナー' :
                    '例：タイトルを入力'
                  }
                  required
                  className="text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">詳細説明 *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={
                    formData.category_uuid === 'cat-for-sale' ? '商品の状態、購入時期、使用頻度など詳しく説明してください' :
                    formData.category_uuid === 'cat-job-seeking' ? '仕事内容、必要なスキル、勤務条件など詳しく説明してください' :
                    formData.category_uuid === 'cat-housing' ? '部屋の設備、アクセス、契約条件など詳しく説明してください' :
                    formData.category_uuid === 'cat-services' ? '提供するサービス、料金体系、対応エリアなど詳しく説明してください' :
                    formData.category_uuid === 'cat-events' ? 'イベント内容、参加対象、申し込み方法など詳しく説明してください' :
                    '詳細を入力してください'
                  }
                  rows={5}
                  required
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* 価格 - 仕事探しと住居以外のカテゴリーで表示 */}
          {formData.category_uuid !== 'cat-job-seeking' && formData.category_uuid !== 'cat-housing' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="w-5 h-5" />
                  価格
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_free"
                      checked={formData.price === '無料' || formData.price === '0'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange('price', '無料');
                        } else {
                          handleInputChange('price', '');
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="is_free" className="cursor-pointer">無料</Label>
                  </div>
                  {formData.price !== '無料' && formData.price !== '0' && (
                    <div className="flex items-center gap-2">
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        placeholder="500"
                        className="text-base flex-1"
                        min="0"
                      />
                      <span className="text-gray-600 font-medium">SEK</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* カテゴリ別詳細情報 */}
          {formData.category_uuid === 'cat-for-sale' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5" />
                  商品詳細情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="condition">コンディション *</Label>
                  <Select 
                    value={formData.condition} 
                    onValueChange={(value) => handleInputChange('condition', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">新品</SelectItem>
                      <SelectItem value="like_new">ほぼ新品</SelectItem>
                      <SelectItem value="excellent">非常に良い</SelectItem>
                      <SelectItem value="good">良い</SelectItem>
                      <SelectItem value="fair">可</SelectItem>
                      <SelectItem value="junk">ジャンク</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">ブランド</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="例：IKEA、Apple、UNIQLO"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model_name">モデル名/番号</Label>
                  <Input
                    id="model_name"
                    value={formData.model_name}
                    onChange={(e) => handleInputChange('model_name', e.target.value)}
                    placeholder="例：iPhone 13、MALM チェスト"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_dimensions">サイズ/寸法</Label>
                  <Input
                    id="size_dimensions"
                    value={formData.size_dimensions}
                    onChange={(e) => handleInputChange('size_dimensions', e.target.value)}
                    placeholder="例：160cm x 80cm、Mサイズ、40L"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {formData.category_uuid === 'cat-job-seeking' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="w-5 h-5" />
                  求人情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">会社名 *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder="例：スウェーデン株式会社、ABC社"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary">給与 *</Label>
                  <Input
                    id="salary"
                    value={formData.salary}
                    onChange={(e) => handleInputChange('salary', e.target.value)}
                    placeholder="例：時給150 SEK、月給25,000 SEK"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employment_type">就業形態 *</Label>
                  <Select 
                    value={formData.employment_type} 
                    onValueChange={(value) => handleInputChange('employment_type', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">フルタイム</SelectItem>
                      <SelectItem value="part-time">パートタイム</SelectItem>
                      <SelectItem value="contract">コントラクト（契約）</SelectItem>
                      <SelectItem value="internship">インターン</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience_level">経験 *</Label>
                  <Select 
                    value={formData.experience_level} 
                    onValueChange={(value) => handleInputChange('experience_level', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">初級</SelectItem>
                      <SelectItem value="mid">中級</SelectItem>
                      <SelectItem value="senior">シニア</SelectItem>
                      <SelectItem value="any">経験問わず</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="work_location">勤務地</Label>
                  <Input
                    id="work_location"
                    value={formData.work_location}
                    onChange={(e) => handleInputChange('work_location', e.target.value)}
                    placeholder="例：ストックホルム中央駅周辺、リモート可"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {formData.category_uuid === 'cat-housing' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  住居詳細情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rent">家賃 *</Label>
                  <Input
                    id="rent"
                    value={formData.rent}
                    onChange={(e) => handleInputChange('rent', e.target.value)}
                    placeholder="例：月8,000 SEK"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rooms">部屋数/タイプ</Label>
                  <Select 
                    value={formData.rooms} 
                    onValueChange={(value) => handleInputChange('rooms', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="studio">ワンルーム</SelectItem>
                      <SelectItem value="1k">1K</SelectItem>
                      <SelectItem value="1dk">1DK</SelectItem>
                      <SelectItem value="1ldk">1LDK</SelectItem>
                      <SelectItem value="2k">2K</SelectItem>
                      <SelectItem value="2dk">2DK</SelectItem>
                      <SelectItem value="2ldk">2LDK</SelectItem>
                      <SelectItem value="3k">3K以上</SelectItem>
                      <SelectItem value="shared">シェアハウス</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area_sqm">広さ（㎡）</Label>
                  <Input
                    id="area_sqm"
                    value={formData.area_sqm}
                    onChange={(e) => handleInputChange('area_sqm', e.target.value)}
                    placeholder="例：45㎡"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="available_date">入居可能日</Label>
                  <Input
                    id="available_date"
                    type="date"
                    value={formData.available_date}
                    onChange={(e) => handleInputChange('available_date', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {formData.category_uuid === 'cat-services' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  サービス詳細情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service_fee">サービス料金 *</Label>
                  <Input
                    id="service_fee"
                    value={formData.service_fee}
                    onChange={(e) => handleInputChange('service_fee', e.target.value)}
                    placeholder="例：時給500 SEK、一回2,000 SEK"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service_area">サービス提供エリア</Label>
                  <Input
                    id="service_area"
                    value={formData.service_area}
                    onChange={(e) => handleInputChange('service_area', e.target.value)}
                    placeholder="例：ストックホルム市中心部、半径20km以内"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availability">対応可能時間</Label>
                  <Input
                    id="availability"
                    value={formData.availability}
                    onChange={(e) => handleInputChange('availability', e.target.value)}
                    placeholder="例：平日9:00-18:00、土日要相談"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {formData.category_uuid === 'cat-events' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5" />
                  イベント詳細情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event_date">イベント日時 *</Label>
                  <Input
                    id="event_date"
                    type="datetime-local"
                    value={formData.event_date}
                    onChange={(e) => handleInputChange('event_date', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_location">イベント場所</Label>
                  <Input
                    id="event_location"
                    value={formData.event_location}
                    onChange={(e) => handleInputChange('event_location', e.target.value)}
                    placeholder="例：ストックホルム中央駅、オンライン"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_fee">参加費</Label>
                  <Input
                    id="event_fee"
                    value={formData.event_fee}
                    onChange={(e) => handleInputChange('event_fee', e.target.value)}
                    placeholder="例：無料、100 SEK、要予約"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* その他のカテゴリ用 - 投稿タイプに応じた価格フィールド */}
          {!['cat-for-sale', 'cat-job-seeking', 'cat-housing', 'cat-services', 'cat-events'].includes(formData.category_uuid) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">詳細情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.post_type === 'paid' && (
                  <div className="space-y-2">
                    <Label htmlFor="price">価格</Label>
                    <Input
                      id="price"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      placeholder="例：500 SEK"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 連絡先 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="w-5 h-5" />
                連絡先情報 *
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>連絡方法</Label>
                <RadioGroup 
                  value={formData.contact_method} 
                  onValueChange={(value) => handleInputChange('contact_method', value)}
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <RadioGroupItem value="email" id="email" className="peer sr-only" />
                      <Label 
                        htmlFor="email" 
                        className="flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 hover:border-gray-300"
                      >
                        <Mail className="w-4 h-4" />
                        <span>メール</span>
                      </Label>
                    </div>
                    <div className="flex-1">
                      <RadioGroupItem value="phone" id="phone-method" className="peer sr-only" />
                      <Label 
                        htmlFor="phone-method" 
                        className="flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 hover:border-gray-300"
                      >
                        <Phone className="w-4 h-4" />
                        <span>電話</span>
                      </Label>
                    </div>
                    <div className="flex-1">
                      <RadioGroupItem value="both" id="both" className="peer sr-only" />
                      <Label 
                        htmlFor="both" 
                        className="flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 hover:border-gray-300"
                      >
                        <Mail className="w-4 h-4" />
                        <Phone className="w-4 h-4" />
                        <span>両方</span>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">メールアドレス *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              {(formData.contact_method === 'phone' || formData.contact_method === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号 *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="例：070-123-4567"
                    required
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 詳細住所 - オプション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5" />
                詳細住所（オプション）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show_detailed_address"
                    checked={formData.show_detailed_address}
                    onChange={(e) => handleInputChange('show_detailed_address', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="show_detailed_address" className="cursor-pointer">詳細住所を表示する</Label>
                </div>
                {formData.show_detailed_address && (
                  <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="street">番地・ストリート名</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        placeholder="例：Kungsgatan 1"
                        className="text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cross_street">交差点・目標</Label>
                      <Input
                        id="cross_street"
                        value={formData.cross_street}
                        onChange={(e) => handleInputChange('cross_street', e.target.value)}
                        placeholder="例：Sergels Torgの近く"
                        className="text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">都市・地域</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="例：ストックホルム市"
                        className="text-base"
                      />
                    </div>
                  </div>
                )}
                {!formData.show_detailed_address && (
                  <div className="text-sm text-gray-500 italic">
                    ※ 詳細住所を表示しない場合、「そのエリア」として表示されます
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 画像 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="w-5 h-5" />
                画像（最大3枚）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                
                {/* 既存の画像 */}
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`画像 ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* アップロード */}
                {imageUrls.length < 3 && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <Input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <Label 
                      htmlFor="images" 
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                      <span className="text-sm font-medium">クリックして画像を選択</span>
                      <span className="text-xs text-gray-500">最大3枚、各1MBまで</span>
                    </Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* エラーメッセージ */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* アクションボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              size="lg"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid()}
              size="lg"
              className="min-w-[120px]"
            >
              {isSubmitting ? "送信中..." : editingPost ? "更新" : "投稿"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};