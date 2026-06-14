import db from '@/lib/shared/kliv-database';

// 唯一の管理者判定。user_profiles.role === 'admin' のみを正とする。
export async function checkIsAdmin(user: any): Promise<boolean> {
  if (!user?.userUuid) return false;
  const profiles = await db.query('user_profiles', {
    user_uuid: `eq.${user.userUuid}`,
    _deleted: 'eq.0',
  });
  return profiles[0]?.role === 'admin';
}