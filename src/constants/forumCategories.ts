export const FORUM_CATEGORIES = [
  '生活・習慣',
  'ビザ・移民',
  '住まい・DIY',
  '学校・習い事',
  '仕事・転職',
  '交通手段・乗り物',
  '美容・健康',
  '税金・金融・郵便',
  '医療・福祉',
  '出産・子育て・教育',
  '食・買い物',
  '旅行・宿泊',
  'イベント・サークル',
  'その他',
] as const;

export type ForumCategory = typeof FORUM_CATEGORIES[number];
