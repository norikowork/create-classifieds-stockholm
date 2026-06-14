import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Shield, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Footer from '@/components/Footer';

const Help = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ホームに戻る
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">使い方ガイド & FAQ</h1>

        {/* Introduction Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <MessageSquare className="w-6 h-6 mr-2 text-blue-600" />
              はじめに
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-700">
              Sverige.JP では、投稿者への連絡方法が2つあります。
            </p>
            <div className="space-y-2 ml-4">
              <div className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 mr-3 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">サイト内メッセージ</p>
                  <p className="text-sm text-gray-600">
                    メールアドレスを相手に知られずにやり取りできます（おすすめ）
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-green-600 mt-2 mr-3 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">メールで連絡</p>
                  <p className="text-sm text-gray-600">
                    あなたのメールアドレスが相手に伝わります
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Shield className="w-6 h-6 mr-2 text-green-600" />
              安全に使うために
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              知らない相手とやり取りするときは、まず「サイト内メッセージ」を使いましょう。メールアドレスを教えずに会話でき、不安な相手には返信しない・ブロックするという選択もできます。何度かやり取りして信用できたら、メッセージ画面の「メールアドレスを伝える」ボタンで、相手にだけ自分のメールアドレスを伝えてメールに切り替えられます。
            </p>
          </CardContent>
        </Card>

        {/* Contact Settings Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Settings className="w-6 h-6 mr-2 text-purple-600" />
              連絡の受け取り方を変える
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              自分の投稿への連絡を「メールで受け取る（初期設定）」か「メールを隠す（サイト内メッセージのみ）」かは、プロフィール画面の「連絡の受け取り方」から変更できます。メールを知られたくない場合は「メールを隠す」を選んでください。
            </p>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">よくある質問（FAQ）</h2>
        <Card>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible>
              <AccordionItem value="q1">
                <AccordionTrigger>メールアドレスは相手に知られますか？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700 leading-relaxed">
                    「メールを隠す」設定にすれば知られません。サイト内メッセージでやり取りでき、信用できたら自分から「メアドを伝える」で開示できます。初期設定は「メールで受け取る」で、プロフィールから変更できます。
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q2">
                <AccordionTrigger>サイト内メッセージはどこで読めますか？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700 leading-relaxed">
                    上部メニューの「メッセージ」から読めます。新着があると登録メールにお知らせが届きます（相手のメールアドレスは載りません）。
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q3">
                <AccordionTrigger>メッセージは何通まで保存できますか？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700 leading-relaxed">
                    無料プランは100通までです。上限に達したら、メッセージ画面で古い会話を削除してください。将来、有料プラン（月30kr）で上限を増やせる予定です。
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q4">
                <AccordionTrigger>知らない人と連絡するのが不安です</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700 leading-relaxed">
                    まずサイト内メッセージを使いましょう。メールアドレスを教えずにやり取りでき、不安なら返信しない・ブロックすることもできます。信用できたらメールに切り替えられます。
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q5">
                <AccordionTrigger>ブロックされた人は連絡できますか？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700 leading-relaxed">
                    いいえ。利用停止（ブロック）されたアカウントはログインも投稿もできません。
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q6">
                <AccordionTrigger>連絡の受け取り方を変えるには？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-700 leading-relaxed">
                    プロフィール →「連絡の受け取り方」→「メールで受け取る」か「メールを隠す」を選んで保存してください。
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Help;
