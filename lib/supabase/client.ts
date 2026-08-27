// ⚠️ CLAUDE.md 5장에서 [공유] 로 지정된 파일이다.
//    수정이 필요하면 작업을 멈추고 사람에게 알린다.
//    (최초 생성: track() 의 event_log 기록에 클라이언트가 필요해 만들었다)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 없습니다. .env.local 을 확인하세요.',
  );
}

// 앱은 anon Key만 사용한다. service_role Key를 앱에 두지 않는다. (CLAUDE.md 1장)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native에는 URL 세션 감지가 없다.
    detectSessionInUrl: false,
  },
});
