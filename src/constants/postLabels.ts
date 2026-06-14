/**
 * 投稿のステータスと種別の表示ラベル
 */

// 投稿ステータスの表示ラベル
export const statusLabels = {
  'active': '公開中',
  'sold': '完了',
  'expired': '期限切れ',
  'flagged': '報告済み',
  'removed': '削除'
} as const;

// 投稿種別の表示ラベル（無料/有料）
export const postTypeLabels = {
  'free': '無料',
  'paid': '有料'
} as const;
