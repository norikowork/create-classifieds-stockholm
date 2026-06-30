import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Loader2 } from 'lucide-react';
import { FORUM_CATEGORIES } from '@/constants/forumCategories';
import db from '@/lib/shared/kliv-database.js';
import auth from '@/lib/shared/kliv-auth.js';
import { toast } from 'sonner';

interface ForumTopicFormProps {
  onSuccess?: () => void;
}

export default function ForumTopicForm({ onSuccess }: ForumTopicFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !body.trim() || !category) {
      toast.error('すべての項目を入力してください');
      return;
    }

    // 認証チェック
    const user = await auth.getUser();
    if (!user || !user.userUuid) {
      toast.error('ログインしていません。右上の「ログイン」ボタンからログインしてください。');
      return;
    }
    // メール確認チェック：未承認ユーザーは投稿できない
    if (!user.emailVerified || user.emailVerified === false) {
      toast.error('メール確認が必要です。メール確認が完了していないため投稿できません。確認メールのリンクをクリックして承認してください。（迷惑メールフォルダもご確認ください）');
      return;
    }

    setIsSubmitting(true);
    try {
      await db.insert('forum_topics', {
        title: title.trim(),
        body: body.trim(),
        category,
      });
      
      toast.success('トピックを作成しました！');
      setTitle('');
      setBody('');
      setCategory('');
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create forum topic:', error);
      toast.error(error?.message || '作成に失敗しました。再度ログインしてください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          新しいトピックを作成
        </CardTitle>
        <CardDescription>
          質問、情報共有、雑談など、自由に投稿してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">カテゴリ <span className="text-red-500">*</span></Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger id="category">
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                {FORUM_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">タイトル <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="トピックのタイトル"
              required
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="body">本文 <span className="text-red-500">*</span></Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="質問や情報を詳しく書いてください..."
              required
              rows={8}
              maxLength={5000}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                作成中...
              </>
            ) : (
              'トピックを作成'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
