/**
 * 料金プランとメッセージ上限の設定
 * 将来の課金対応の単一の基準点
 */

// 料金プランごとのメッセージ保存上限
export const MESSAGE_LIMITS: Record<string, number> = {
  free: 100,
  paid: Infinity, // 月30kr プラン: 実質無制限
};

/**
 * プロフィールから現在のメッセージ上限を返す
 * @param profile - ユーザープロフィールオブジェクト
 * @param nowSec - 現在のUNIX秒（省略時は現在時刻）
 * @returns メッセージ上限数
 */
export function getMessageLimit(profile: any, nowSec?: number): number {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  
  const isPaidActive =
    profile?.plan === 'paid' &&
    (!profile?.plan_expires_at || profile.plan_expires_at > now);
  
  return isPaidActive ? MESSAGE_LIMITS.paid : MESSAGE_LIMITS.free;
}
