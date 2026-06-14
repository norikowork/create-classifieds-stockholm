import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Send, Mail, Trash2, MessageSquare } from 'lucide-react';
import auth from '@/lib/shared/kliv-auth';
import db from '@/lib/shared/kliv-database';
import { getMessageLimit } from '@/constants/plans';
import { useToast } from '@/hooks/use-toast';

interface Message {
  _row_id: number;
  post_id: number;
  post_title: string;
  conversation_key: string;
  from_uuid: string;
  from_name: string;
  to_uuid: string;
  body: string;
  is_read: number;
  _created_at: number;
}

interface Conversation {
  conversation_key: string;
  other_uuid: string;
  other_name: string;
  post_id: number;
  post_title: string;
  lastMessage: string;
  lastTime: number;
  unreadCount: number;
  messages: Message[];
}

const Messages = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [myMessages, setMyMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [limit, setLimit] = useState<number>(100);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await auth.getUser();
        if (!currentUser || !currentUser.userUuid) {
          navigate('/');
          return;
        }
        setUser(currentUser);
        await loadData(currentUser.userUuid);
      } catch (error) {
        console.error('Auth check failed:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const loadData = async (userUuid: string) => {
    try {
      // メッセージを取得（自分が送信・受信したもの）
      const [sentMessages, receivedMessages] = await Promise.all([
        db.query('messages', { from_uuid: `eq.${userUuid}`, _deleted: 'eq.0' }),
        db.query('messages', { to_uuid: `eq.${userUuid}`, _deleted: 'eq.0' })
      ]);

      // 重複排除してマージ
      const allMessages = [...sentMessages, ...receivedMessages];
      const uniqueMessages = Array.from(
        new Map(allMessages.map(msg => [msg._row_id, msg])).values()
      );

      setMyMessages(uniqueMessages);

      // ユーザープロフィールを取得
      const profiles = await db.query('user_profiles', {
        user_uuid: `eq.${userUuid}`,
        _deleted: 'eq.0'
      });

      if (profiles.length > 0) {
        const profile = profiles[0];
        setUserProfile(profile);
        setLimit(getMessageLimit(profile));
      }

      // 会話一覧を作成
      await buildConversations(uniqueMessages, userUuid);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'エラー',
        description: 'データの読み込みに失敗しました。',
        variant: 'destructive'
      });
    }
  };

  const buildConversations = async (messages: Message[], userUuid: string) => {
    const conversationMap = new Map<string, Conversation>();

    for (const message of messages) {
      const key = message.conversation_key;
      
      if (!conversationMap.has(key)) {
        const otherUuid = message.from_uuid === userUuid ? message.to_uuid : message.from_uuid;
        
        conversationMap.set(key, {
          conversation_key: key,
          other_uuid: otherUuid,
          other_name: message.from_uuid === userUuid ? '' : message.from_name,
          post_id: message.post_id,
          post_title: message.post_title,
          lastMessage: message.body,
          lastTime: message._created_at,
          unreadCount: 0,
          messages: []
        });
      }

      const conv = conversationMap.get(key)!;
      conv.messages.push(message);
      
      // 相手の表示名を更新（まだ空の場合）
      if (message.from_uuid === userUuid && !conv.other_name) {
        conv.other_name = message.to_uuid === userUuid ? '' : message.to_uuid;
      }
    }

    // 未読件数を計算
    for (const [key, conv] of conversationMap) {
      conv.unreadCount = conv.messages.filter(
        msg => msg.to_uuid === userUuid && msg.is_read === 0
      ).length;
      
      // 最新メッセージを更新
      const sortedMessages = conv.messages.sort((a, b) => b._created_at - a._created_at);
      conv.lastMessage = sortedMessages[0].body;
      conv.lastTime = sortedMessages[0]._created_at;
    }

    // 相手の表示名を取得（必要な場合）
    await enrichConversationsWithNames(Array.from(conversationMap.values()));

    // 最新メッセージ時刻で降順ソート
    const sortedConversations = Array.from(conversationMap.values())
      .sort((a, b) => b.lastTime - a.lastTime);

    setConversations(sortedConversations);
  };

  const enrichConversationsWithNames = async (convs: Conversation[]) => {
    for (const conv of convs) {
      if (!conv.other_name) {
        try {
          const profiles = await db.query('user_profiles', {
            user_uuid: `eq.${conv.other_uuid}`,
            _deleted: 'eq.0'
          });
          
          if (profiles.length > 0 && profiles[0].display_name) {
            conv.other_name = profiles[0].display_name;
          } else {
            conv.other_name = '不明なユーザー';
          }
        } catch (error) {
          console.error('Error fetching user name:', error);
          conv.other_name = '不明なユーザー';
        }
      }
    }
  };

  const openConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);

    // 未読メッセージを既読にする
    try {
      const unreadMessages = conv.messages.filter(
        msg => msg.to_uuid === user.userUuid && msg.is_read === 0
      );

      if (unreadMessages.length > 0) {
        await db.update(
          'messages',
          { conversation_key: `eq.${conv.conversation_key}`, to_uuid: `eq.${user.userUuid}`, is_read: 'eq.0' },
          { is_read: 1 }
        );

        // ローカルのデータも更新
        setConversations(prev =>
          prev.map(c => 
            c.conversation_key === conv.conversation_key
              ? { ...c, unreadCount: 0 }
              : c
          )
        );

        setMyMessages(prev =>
          prev.map(msg =>
            msg.conversation_key === conv.conversation_key && msg.to_uuid === user.userUuid && msg.is_read === 0
              ? { ...msg, is_read: 1 }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConversation || !user) {
      return;
    }

    // 上限チェック
    if (myMessages.length >= limit) {
      const limitText = limit === Infinity ? '無制限' : `${limit}通`;
      toast({
        title: '送信できません',
        description: `メッセージが上限(${limitText})に達しています。古い会話を削除するか、有料プラン(月30kr・近日対応)をご利用ください。`,
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    try {
      const newMessage = {
        post_id: selectedConversation.post_id,
        post_title: selectedConversation.post_title,
        conversation_key: selectedConversation.conversation_key,
        from_uuid: user.userUuid,
        from_name: userProfile?.display_name || user.email || '自分',
        to_uuid: selectedConversation.other_uuid,
        body: replyText,
        is_read: 0
      };

      await db.insert('messages', newMessage);

      toast({
        title: '送信完了',
        description: 'メッセージを送信しました。',
      });

      setReplyText('');
      
      // データを再取得
      await loadData(user.userUuid);
      
      // 選択中の会話を再選択
      const updated = conversations.find(c => c.conversation_key === selectedConversation.conversation_key);
      if (updated) {
        setSelectedConversation(updated);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: '送信失敗',
        description: 'メッセージの送信に失敗しました。',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const sendEmailMessage = async () => {
    if (!selectedConversation || !user) {
      return;
    }

    // 上限チェック
    if (myMessages.length >= limit) {
      const limitText = limit === Infinity ? '無制限' : `${limit}通`;
      toast({
        title: '送信できません',
        description: `メッセージが上限(${limitText})に達しています。古い会話を削除するか、有料プラン(月30kr・近日対応)をご利用ください。`,
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    try {
      const email = userProfile?.email || user.email;
      const emailText = `📧 私のメールアドレス: ${email}（メールで連絡できます）`;

      const newMessage = {
        post_id: selectedConversation.post_id,
        post_title: selectedConversation.post_title,
        conversation_key: selectedConversation.conversation_key,
        from_uuid: user.userUuid,
        from_name: userProfile?.display_name || user.email || '自分',
        to_uuid: selectedConversation.other_uuid,
        body: emailText,
        is_read: 0
      };

      await db.insert('messages', newMessage);

      toast({
        title: '送信完了',
        description: 'メールアドレスを送信しました。',
      });

      setShowEmailDialog(false);
      
      // データを再取得
      await loadData(user.userUuid);
      
      // 選択中の会話を再選択
      const updated = conversations.find(c => c.conversation_key === selectedConversation.conversation_key);
      if (updated) {
        setSelectedConversation(updated);
      }
    } catch (error) {
      console.error('Error sending email message:', error);
      toast({
        title: '送信失敗',
        description: 'メールアドレスの送信に失敗しました。',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const deleteConversation = async () => {
    if (!selectedConversation || !user) {
      return;
    }

    try {
      // その会話で自分が関わるメッセージを論理削除
      const myMessagesInConv = myMessages.filter(
        msg => msg.conversation_key === selectedConversation.conversation_key &&
        (msg.from_uuid === user.userUuid || msg.to_uuid === user.userUuid)
      );

      for (const msg of myMessagesInConv) {
        await db.update('messages', { _row_id: `eq.${msg._row_id}` }, { _deleted: 1 });
      }

      toast({
        title: '削除完了',
        description: '会話を削除しました。',
      });

      setShowDeleteDialog(false);
      setSelectedConversation(null);
      
      // データを再取得
      await loadData(user.userUuid);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: '削除失敗',
        description: '会話の削除に失敗しました。',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'ただ今' : `${diffMinutes}分前`;
      }
      return `${diffHours}時間前`;
    } else if (diffDays === 1) {
      return '昨日';
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  };

  const limitText = limit === Infinity ? '無制限' : `${limit}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center text-gray-700 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">ホームに戻る</span>
          </Link>
          <h1 className="text-xl font-bold">メッセージ</h1>
          <div className="w-24"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 残量表示 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-gray-600" />
                <span className="font-medium">
                  メッセージ {myMessages.length} / {limitText}
                </span>
              </div>
              {myMessages.length >= limit && limit !== Infinity && (
                <Badge variant="destructive">上限に達しています</Badge>
              )}
            </div>
            {myMessages.length >= limit && (
              <AlertDescription className="mt-2 text-orange-600">
                上限に達しています。古い会話を削除するか、有料プラン(月30kr・近日対応)をご利用ください。
              </AlertDescription>
            )}
          </CardContent>
        </Card>

        {/* 会話一覧またはスレッド表示 */}
        {!selectedConversation ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold mb-4">会話一覧</h2>
            {conversations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  メッセージはありません
                </CardContent>
              </Card>
            ) : (
              conversations.map(conv => (
                <Card 
                  key={conv.conversation_key}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openConversation(conv)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {conv.other_name || conv.other_uuid}
                          </h3>
                          {conv.unreadCount > 0 && (
                            <Badge variant="destructive">{conv.unreadCount}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{conv.post_title}</p>
                        <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-xs text-gray-400">{formatTime(conv.lastTime)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* スレッドヘッダー */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedConversation.other_name || selectedConversation.other_uuid}</CardTitle>
                    <CardDescription>{selectedConversation.post_title}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedConversation(null)}
                  >
                    戻る
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* メッセージスレッド */}
            <Card>
              <CardContent className="py-4">
                <div className="space-y-4">
                  {selectedConversation.messages
                    .sort((a, b) => a._created_at - b._created_at)
                    .map(msg => (
                      <div
                        key={msg._row_id}
                        className={`flex ${msg.from_uuid === user?.userUuid ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${msg.from_uuid === user?.userUuid ? 'text-right' : 'text-left'}`}>
                          <div className={`inline-block px-4 py-2 rounded-lg ${
                            msg.from_uuid === user?.userUuid
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-900'
                          }`}>
                            <p className="text-sm">{msg.body}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{formatTime(msg._created_at)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* 返信入力 */}
            <Card>
              <CardContent className="py-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="メッセージを入力..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
                    disabled={isSending}
                  />
                  <Button onClick={sendReply} disabled={isSending || !replyText.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* アクションボタン */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowEmailDialog(true)}
                disabled={isSending}
              >
                <Mail className="w-4 h-4 mr-2" />
                メールアドレスを伝える
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isSending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                会話を削除
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* メール送信確認ダイアログ */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メールアドレスを伝える</DialogTitle>
            <DialogDescription>
              メールアドレスを相手に伝えますか?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={sendEmailMessage} disabled={isSending}>
              送信する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>会話の削除</DialogTitle>
            <DialogDescription>
              本当にこの会話を削除しますか? この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={deleteConversation} disabled={isSending}>
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

// Footerコンポーネント（簡易版）
const Footer = () => (
  <footer className="bg-white border-t border-gray-200 mt-12">
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
        <div>
          <h3 className="font-semibold mb-2">Sverige.JP</h3>
          <p className="text-gray-600">スウェーデンの日本人コミュニティ</p>
        </div>
        <div>
          <h3 className="font-semibold mb-2">リンク</h3>
          <ul className="space-y-1 text-gray-600">
            <li><Link to="/" className="hover:text-gray-900">ホーム</Link></li>
            <li><Link to="/forum" className="hover:text-gray-900">掲示板</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2">サポート</h3>
          <p className="text-gray-600">お問い合わせ: noriko@rational.ventures</p>
        </div>
      </div>
    </div>
  </footer>
);

export default Messages;
