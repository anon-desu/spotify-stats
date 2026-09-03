const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

// 听歌分析相关权限扩展（涵盖个人画像、常听项、近期播放、收藏曲库、歌单、关注歌手与实时状态）
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-follow-read',
  'user-read-playback-state',
  'user-read-currently-playing'
].join(' ');

// 安全获取重定向地址（防止打包阶段访问 window 报错）
const getRedirectUri = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

function generateCodeVerifier(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function redirectToAuthCodeFlow() {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("response_type", "code");
  params.append("redirect_uri", getRedirectUri());
  params.append("scope", SCOPES);
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function getAccessToken(code) {
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", getRedirectUri());
  params.append("code_verifier", verifier);

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const data = await result.json();
  return data.access_token;
}

function handleTokenExpiration(res) {
  if (res.status === 401) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('spotify_token');
      localStorage.removeItem('verifier');
    }
    return true;
  }
  return false;
}

// 1. 用户基础画像
export async function fetchProfile(token) {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return null;
  return res.json();
}

// 2. 常听单曲 (time_range: short_term 4周 / medium_term 6个月 / long_term 长期)
export async function fetchTopTracks(token, timeRange = 'medium_term', limit = 50) {
  const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 3. 常听歌手
export async function fetchTopArtists(token, timeRange = 'medium_term', limit = 50) {
  const res = await fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 4. 最近播放记录（包含 played_at 时间戳，用于时段统计）
export async function fetchRecentlyPlayed(token, limit = 50) {
  const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 5. 收藏的单曲 (Liked Songs)
export async function fetchLikedSongs(token, limit = 50, offset = 0) {
  const res = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 6. 批量获取歌手详情（获取流派 genres、知名度 popularity 等）
export async function fetchArtistsByIds(token, ids = []) {
  if (!ids.length) return { artists: [] };
  const cleanIds = ids.slice(0, 50).join(',');
  const res = await fetch(`https://api.spotify.com/v1/artists?ids=${cleanIds}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { artists: [] };
  return res.json();
}

// 7. 批量获取音轨特征 (节奏能量、舞蹈度、情绪明暗等音频指标)
export async function fetchAudioFeatures(token, trackIds = []) {
  if (!trackIds.length) return { audio_features: [] };
  const idsParam = trackIds.slice(0, 100).join(',');
  const res = await fetch(`https://api.spotify.com/v1/audio-features?ids=${idsParam}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { audio_features: [] };
  return res.json();
}

// 8. 获取用户创建/收藏的歌单
export async function fetchUserPlaylists(token, limit = 50, offset = 0) {
  const res = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 9. 获取当前正在播放内容 (Now Playing)
export async function fetchCurrentlyPlaying(token) {
  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204 || handleTokenExpiration(res)) return null;
  return res.json();
}

// 10. 获取关注的歌手
export async function fetchFollowedArtists(token, limit = 50) {
  const res = await fetch(`https://api.spotify.com/v1/me/following?type=artist&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (handleTokenExpiration(res)) return { artists: { items: [] } };
  return res.json();
}
