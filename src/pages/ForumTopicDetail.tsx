import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MessageSquare, Clock, User, Reply, Loader2, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import Footer from '@/components/Footer';
import db from '@/lib/shared/kliv-database.js';
import auth from '@/lib/shared/kliv-auth.js';
import { toast } from 'sonner';

interface ForumTopic {
  _row_id: number;
  title: string;
  body: string;
  category: string;
  _created_at: number;
  _created_by: string;
  user_name?: string;
}

interface ForumReply {
  _row_id: number;
  topic_id: number;
  body: string;
  _created_at: number;
  _created_by: string;
  user_name?: string;
}

export default function ForumTopicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadTopic();
    loadReplies();
    loadUser();
  }, [id]);

  const loadUser = async () => {
    const currentUser = await auth.getUser();
    setUser(currentUser);
  };

  const loadTopic = async () => {
    if (!id) return;
    try {
      const data = await db.get('forum_topics', parseInt(id));
      if (data) {
        setTopic(data);
      } else {
        toast.error('トピックが見つかりません');
        navigate('/forum');
      }
    } catch (error) {
      console.error('Failed to load topic:', error);
      toast.error('読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async () => {
    if (!id) return;
    try {
      const topicId = parseInt(id);
      const data = await db.query('forum_replies', {
        topic_id: `eq.${topicId}`,
        order: '_created_at.asc',
      });
      console.log('Loaded replies for topic', topicId, ':', data);
      setReplies(data);
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!replyBody.trim()) {
      toast.error('返信内容を入力してください');
      return;
    }

    if (!user) {
      toast.error('返信するにはログインしてください');
      return;
    }

    setIsSubmitting(true);
    try {
      const topicId = parseInt(id!);
      await db.insert('forum_replies', {
        topic_id: topicId,
        body: replyBody.trim(),
      });
      
      toast.success('返信を投稿しました！');
      setReplyBody('');
      loadReplies();
    } catch (error) {
      console.error('Failed to submit reply:', error);
      toast.error('投稿に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!user) return;
    
    if (!confirm('この返信を削除しますか？')) {
      return;
    }

    try {
      await db.delete('forum_replies', { _row_id: `eq.${replyId}` });
      toast.success('返信を削除しました');
      loadReplies();
    } catch (error) {
      console.error('Failed to delete reply:', error);
      toast.error('削除に失敗しました');
    }
  };

  const handleDeleteTopic = async () => {
    if (!user) return;
    
    if (!confirm('このトピックを削除しますか？すべての返信も削除されます。')) {
      return;
    }

    try {
      await db.delete('forum_topics', { _row_id: `eq.${topic!._row_id}` });
      toast.success('トピックを削除しました');
      navigate('/forum');
    } catch (error) {
      console.error('Failed to delete topic:', error);
      toast.error('削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 bg-gray-50 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <p className="text-gray-500">読み込み中...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 bg-gray-50 py-8">
          <div className="container mx-auto px-4">
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p>トピックが見つかりません</p>
                <Link to="/forum">
                  <Button className="mt-4">情報・掲示板に戻る</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <Link to="/forum">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            情報・掲示板に戻る
          </Button>
        </Link>

        {/* Topic */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{topic.category}</Badge>
                </div>
                <CardTitle className="text-2xl mb-2">{topic.title}</CardTitle>
                <CardDescription className="flex items-center text-sm">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatDistanceToNow(new Date(topic._created_at * 1000), { 
                    addSuffix: true, 
                    locale: ja 
                  })}
                </CardDescription>
              </div>
              {user && topic._created_by === user.userUuid && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteTopic}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none whitespace-pre-wrap">
              {topic.body}
            </div>
          </CardContent>
        </Card>

        {/* Replies Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center">
            <Reply className="w-5 h-5 mr-2" />
            返信 ({replies.length})
          </h2>

          {/* Reply Form */}
          {user ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">返信を投稿</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitReply} className="space-y-4">
                  <div>
                    <Label htmlFor="reply">返信内容</Label>
                    <Textarea
                      id="reply"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="返信を入力してください..."
                      rows={4}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !replyBody.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        投稿中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        返信を投稿
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p>返信するにはログインしてください</p>
                <p className="text-sm mt-2">
                  ※ ログイン機能は近日公開予定です
                </p>
              </CardContent>
            </Card>
          )}

          {/* Replies List */}
          {replies.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>まだ返信がありません。最初の返信を投稿してください！</p>
              </CardContent>
            </Card>
          ) : (
            replies.map((reply) => (
              <Card key={reply._row_id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {formatDistanceToNow(new Date(reply._created_at * 1000), { 
                          addSuffix: true, 
                          locale: ja 
                        })}
                      </div>
                      <div className="prose max-w-none whitespace-pre-wrap">
                        {reply.body}
                      </div>
                    </div>
                    {user && reply._created_by === user.userUuid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReply(reply._row_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
