import { Home, Mail, Phone, MapPin, Globe, Github, Facebook, Twitter,Instagram,Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Home className="w-8 h-8 text-blue-400" />
              <h3 className="text-xl font-bold">Sverige.JP</h3>
            </div>
            <p className="text-gray-300 mb-4">
              スウェーデン日本コミュニティサイト
            </p>
            <p className="text-gray-400 text-sm">
              スウェーデン在住の日本人のための情報交換プラットフォーム。イベント、求人、
              買取・販売、 housingなど生活に役立つ情報を共有しましょう。
            </p>
            <div className="flex space-x-4 mt-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">リンク</h4>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-gray-300 hover:text-white transition-colors">
                  ホーム
                </a>
              </li>
              <li>
                <a href="/profile" className="text-gray-300 hover:text-white transition-colors">
                  プロフィール
                </a>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-lg font-semibold mb-4">カテゴリー</h4>
            <ul className="space-y-2">
              <li>
                <a href="/?category=cat-for-sale" className="text-gray-300 hover:text-white transition-colors">
                  販売
                </a>
              </li>
              <li>
                <a href="/?category=cat-wanted" className="text-gray-300 hover:text-white transition-colors">
                  探しています
                </a>
              </li>
              <li>
                <a href="/?category=cat-job-seeking" className="text-gray-300 hover:text-white transition-colors">
                  求職
                </a>
              </li>
              <li>
                <a href="/?category=cat-housing" className="text-gray-300 hover:text-white transition-colors">
                  住居
                </a>
              </li>
              <li>
                <a href="/?category=cat-events" className="text-gray-300 hover:text-white transition-colors">
                  イベント
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm">
              © 2024 Sverige.JP. All rights reserved.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                プライバシー
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                利用規約
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                お問い合わせ
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;