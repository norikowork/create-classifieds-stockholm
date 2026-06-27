import db from '@/lib/shared/kliv-database.js';

/**
 * 投稿者名を解決するヘルパー関数
 * 優先順位: display_name → email → デフォルト
 */
export const resolveAuthorName = async (userUuid: string, userProfiles?: any[]): Promise<string> => {
  if (!userUuid) {
    return '不明';
  }

  // userProfilesが渡されていない場合は検索
  let profiles = userProfiles;
  if (!profiles) {
    try {
      profiles = await db.query('user_profiles', {
        user_uuid: `eq.${userUuid}`,
        _deleted: 'eq.0'
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return '不明';
    }
  }

  const profile = profiles?.find(p => p.user_uuid === userUuid);
  if (profile) {
    return profile.display_name || profile.email || '不明';
  }

  return '不明';
};

/**
 * 複数の投稿に投稿者名を追加するヘルパー関数
 */
export const addAuthorNamesToPosts = async (posts: any[], userProfiles?: any[]): Promise<any[]> => {
  if (!posts || posts.length === 0) {
    return posts;
  }

  // userProfilesが渡されていない場合は全ユーザープロファイルを取得
  let profiles = userProfiles;
  if (!profiles) {
    try {
      profiles = await db.query('user_profiles', {
        _deleted: 'eq.0'
      });
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      return posts.map(post => ({
        ...post,
        creatorDisplayName: '不明',
        creatorId: post._created_by?.substring(0, 8) || '(IDなし)'
      }));
    }
  }

  // プロファイルマップを作成
  const profileMap = new Map();
  profiles?.forEach((profile: any) => {
    profileMap.set(profile.user_uuid, profile);
  });

  return posts.map(post => {
    const creatorProfile = profileMap.get(post._created_by);
    const displayName = creatorProfile?.display_name || creatorProfile?.email || '不明';
    const creatorId = post._created_by ? post._created_by.substring(0, 8) : '(IDなし)';

    return {
      ...post,
      creatorDisplayName: displayName,
      creatorId: creatorId
    };
  });
};
