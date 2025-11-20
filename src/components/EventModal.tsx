import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import db from '@/lib/shared/kliv-database';
import content from '@/lib/shared/kliv-content';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
  user: any;
  editingEvent?: any;
}

export const EventModal = ({ isOpen, onClose, onEventCreated, user, editingEvent }: EventModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eventDate, setEventDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_uuid: '',
    location_uuid: '',
    contact_method: 'email',
    phone: '',
    email: user?.email || ''
  });
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchData();
      
      if (editingEvent) {
        setFormData({
          title: editingEvent.title || '',
          description: editingEvent.description || '',
          category_uuid: editingEvent.category_uuid || editingEvent.category || '',
          location_uuid: editingEvent.location_uuid || editingEvent.location || '',
          contact_method: editingEvent.contact_method || 'email',
          phone: editingEvent.phone || '',
          email: editingEvent.email || ''
        });
        if (editingEvent.event_date) {
          setEventDate(new Date(editingEvent.event_date));
        }
        const parsedImages = editingEvent.images ? (typeof editingEvent.images === 'string' ? JSON.parse(editingEvent.images) : editingEvent.images) : [];
        setImageUrls(parsedImages);
      } else if (!editingEvent) {
        resetForm();
      }
    }
  }, [isOpen, editingEvent, user]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category_uuid: '',
      location_uuid: '',
      contact_method: 'email',
      phone: '',
      email: user?.email || ''
    });
    setImageUrls([]);
    setEventDate(undefined);
    setError('');
  };

  const fetchData = async () => {
    try {
      const [categoriesResult, locationsResult] = await Promise.all([
        db.query('categories', { _deleted: 'eq.0' }),
        db.query('locations', { _deleted: 'eq.0' })
      ]);
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

    if (filesToUpload.length === 0) {
      toast({
        title: "最大画像数に達しました",
        description: "最大3枚まで画像をアップロードできます。"
      });
      return;
    }

    const newUrls: string[] = [];
    
    for (const file of filesToUpload) {
      try {
        const result = await content.uploadFile(file, '/content/uploads/');
        
        let imageUrl = null;
        
        if (result && result.contentUrl) {
          imageUrl = result.contentUrl;
        } else if (result && result.url) {
          imageUrl = result.url;
        } else if (result && result.fileUrl) {
          imageUrl = result.fileUrl;
        } else if (result && result.path) {
          imageUrl = result.path;
        } else if (result && typeof result === 'string') {
          imageUrl = result;
        }
        
        if (imageUrl) {
          newUrls.push(imageUrl);
        }
      } catch (error) {
        console.error('Upload error for file:', file.name, error);
        toast({
          title: "アップロード失敗",
          description: `${file.name} のアップロードに失敗しました。`,
          variant: "destructive"
        });
      }
    }
    
    setImageUrls(prev => [...prev, ...newUrls]);
  };

  const removeImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim() || !eventDate) {
      setError('タイトル、詳細、開催日は必須です');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const postData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category_uuid: formData.category_uuid,
        post_type: 'event', // イベント投稿を示す特別なタイプ
        location_uuid: formData.location_uuid,
        contact_method: formData.contact_method,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        images: JSON.stringify(imageUrls),
        event_date: Math.floor(eventDate.getTime() / 1000), // Unix timestampとして保存
        event_date_readable: format(eventDate, 'yyyy年MM月dd日 (EEEE)', { locale: ja })
      };

      if (editingEvent) {
        await db.update('posts', { _row_id: `eq.${editingEvent._row_id}` }, postData);
        toast({
          title: "イベントを更新しました",
          description: "イベント情報が更新されました。"
        });
      } else {
        await db.insert('posts', postData);
        toast({
          title: "イベントを掲載しました",
          description: "新しいイベントを掲載しました。"
        });
      }

      onEventCreated();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Submit error:', error);
      setError('投稿に失敗しました。再度お試しください。');
      toast({
        title: "投稿失敗",
        description: "投稿に失敗しました。再度お試しください。",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '開催日を選択';
    return format(date, 'yyyy年MM月dd日', { locale: ja });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'イベントを編集' : '新しいイベントを掲載'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="title">イベントタイトル *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="イベントのタイトルを入力してください"
              required
            />
          </div>

          <div>
            <Label htmlFor="event-date">開催日 *</Label>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${
                    !eventDate && "text-muted-foreground"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDate(eventDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={(date) => {
                    setEventDate(date);
                    setShowDatePicker(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {eventDate && (
              <p className="text-sm text-gray-600 mt-1">
                {format(eventDate, 'yyyy年MM月dd日 (EEEE)', { locale: ja })}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">イベント詳細 *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="イベントの詳細情報を入力してください"
              rows={4}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">カテゴリ *</Label>
            <Select value={formData.category_uuid} onValueChange={(value) => handleInputChange('category_uuid', value)}>
              <SelectTrigger>
                <SelectValue placeholder="カテゴリを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category: any) => (
                  <SelectItem key={category.uuid} value={category.uuid}>
                    {category.name_ja || category.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">場所 *</Label>
            <Select value={formData.location_uuid} onValueChange={(value) => handleInputChange('location_uuid', value)}>
              <SelectTrigger>
                <SelectValue placeholder="場所を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location: any) => (
                  <SelectItem key={location.uuid} value={location.uuid}>
                    {location.name_ja || location.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="contact-method">連絡方法</Label>
            <Select value={formData.contact_method} onValueChange={(value) => handleInputChange('contact_method', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">メール</SelectItem>
                <SelectItem value="phone">電話</SelectItem>
                <SelectItem value="both">両方</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.contact_method === 'phone' || formData.contact_method === 'both') && (
            <div>
              <Label htmlFor="phone">電話番号</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="電話番号を入力してください"
              />
            </div>
          )}

          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="メールアドレスを入力してください"
            />
          </div>

          <div>
            <Label>画像（最大3枚、1枚あたり1MBまで）</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUrls.length >= 3}
              >
                画像を選択
              </Button>
              <span className="text-sm text-gray-500">
                {imageUrls.length}/3枚
              </span>
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`アップロード画像 ${index + 1}`}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => removeImage(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? '投稿中...' : (editingEvent ? '更新する' : '掲載する')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};