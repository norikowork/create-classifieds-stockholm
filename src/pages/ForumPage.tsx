import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Search, Clock, User, Reply, Home, Briefcase, GraduationCap, Car, Heart, Stethoscope, Baby, ShoppingBag, Plane, Calendar, Users, Wrench, DollarSign, FileText, Coffee } from 'lucide-react';
import ForumTopicForm from '@/components/ForumTopicForm';
import { FORUM_CATEGORIES } from '@/constants/forumCategories';
import db from '@/lib/shared/kliv-database.js';
import auth from '@/lib/shared/kliv-auth.js';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface ForumTopic {
  _row_id: number;
  title: string;
  body: string;
  category: string;
  _created_at: number;
  _created_by: string;
}

// カテゴリ情報とアイコンのマッピング
const categoryInfo: Record<string, { icon: any; color: string }> = {
  '生活・習慣': { icon: Home, color: 'bg-blue-500' },
  'ビザ・移民': { icon: FileText, color: 'bg-purple-500' },
  '住まい・DIY': { icon: Home, color: 'bg-green-500' },
  '学校・習い事': { icon: GraduationCap, color: 'bg-indigo-500' },
  '仕事・転職': { icon: Briefcase, color: 'bg-orange-500' },
  '交通手段・乗り物': { icon: Car, color: 'bg-red-500' },
  '美容・健康': { icon: Heart, color: 'bg-pink-500' },
  '税金・金融・郵便': { icon: DollarSign, color: 'bg-yellow-500' },
  '医療・福祉': { icon: Stethoscope, color: 'bg-teal-500' },
  '出産・子育て・教育': { icon: Baby, color: 'bg-rose-500' },
  '食・買い物': { icon: ShoppingBag, color: 'bg-amber-500' },
  '旅行・宿泊': { icon: Plane, color: 'bg-cyan-500' },
  'イベント・サークル': { icon: Calendar, color: 'bg-lime-500' },
  'その他': { icon: Coffee, color: 'bg-gray-500' },
};

export default function ForumPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [replyCounts, setReplyCounts] = useState<Record<number, number>>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Filter states
  const categoryFilter = searchParams.get('category') || '';
  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    loadTopics();
    loadUser();
  }, []);

  useEffect(() => {
    filterTopics();
  }, [topics, categoryFilter, searchQuery]);

  const loadUser = async () => {
    const currentUser = await auth.getUser();
    setUser(currentUser);
  };

  const loadTopics = async () => {
    try {
      setLoading(true);
      const data = await db.query('forum_topics', {
        order: '_created_at.desc',
        limit: '100',
      });
      setTopics(data);
      
      // Load reply counts
      const counts: Record<number, number> = {};
      for (const topic of data) {
        const count = await db.count('forum_replies', {
          topic_id: `eq.${topic._row_id}`,
        });
        counts[topic._row_id] = count;
      }
      setReplyCounts(counts);

      // Calculate category counts
      const catCounts: Record<string, number> = {};
      FORUM_CATEGORIES.forEach(cat => {
        catCounts[cat] = data.filter(t => t.category === cat).length;
      });
      setCategoryCounts(catCounts);
    } catch (error) {
      console.error('Failed to load topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTopics = () => {
    let filtered = [...topics];

    if (categoryFilter) {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) || 
        t.body.toLowerCase().includes(query)
      );
    }

    setFilteredTopics(filtered);
  };

  const handleTopicCreated = () => {
    setShowForm(false);
    loadTopics();
  };

  const updateFilters = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    setSearchParams(params);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 bg-gray-50 py-8">
        <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">掲示板</h1>
          <p className="text-gray-600">
            ストックホルム生活の質問、情報共有、雑談など
          </p>
        </div>

        {/* Show Form Button */}
        {!showForm && (
          <div className="mb-6">
            <Button 
              onClick={() => setShowForm(true)}
              size="lg"
              className="w-full sm:w-auto"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              新しいトピックを作成
            </Button>
          </div>
        )}

        {/* Create Topic Form */}
        {showForm && (
          <div className="mb-8">
            <ForumTopicForm onSuccess={handleTopicCreated} />
            <Button 
              variant="outline" 
              onClick={() => setShowForm(false)}
              className="mt-4"
            >
              キャンセル
            </Button>
          </div>
        )}

        {/* Categories Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">カテゴリから探す</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {FORUM_CATEGORIES.map((category) => {
              const info = categoryInfo[category];
              const IconComponent = info?.icon || MessageSquare;
              const count = categoryCounts[category] || 0;
              const isActive = categoryFilter === category;
              
              return (
                <button
                  key={category}
                  onClick={() => updateFilters({ category: isActive ? '' : category })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isActive 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`p-2 rounded-full ${info?.color || 'bg-gray-500'} text-white mb-2`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 line-clamp-2">
                      {category}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {count}件
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="キーワードで検索..."
                    value={searchQuery}
                    onChange={(e) => updateFilters({ q: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <Select 
                  value={categoryFilter} 
                  onValueChange={(value) => updateFilters({ category: value === 'all' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="すべてのカテゴリ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのカテゴリ</SelectItem>
                    {FORUM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Topics List */}
        <div className="space-y-4">
          {filteredTopics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>トピックがありません。最初のトピックを作成してください！</p>
              </CardContent>
            </Card>
          ) : (
            filteredTopics.map((topic) => (
              <Link key={topic._row_id} to={`/forum/${topic._row_id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-2 line-clamp-2">
                          {topic.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {topic.body}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{topic.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDistanceToNow(new Date(topic._created_at * 1000), { 
                          addSuffix: true, 
                          locale: ja 
                        })}
                      </div>
                      <div className="flex items-center">
                        <Reply className="w-4 h-4 mr-1" />
                        {replyCounts[topic._row_id] || 0} 件の返信
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
