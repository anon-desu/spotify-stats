const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

// 安全获取重定向地址（防止打包阶段访问 window 报错）
const getRedirectUri = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

function generateCodeVerifier(length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function redirectToAuthCodeFlow() {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("response_type", "code");
  params.append("redirect_uri", getRedirectUri());
  params.append("scope", "user-read-private user-read-email user-top-read user-read-recently-played");
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

export async function fetchProfile(token) {
  const res = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } });
  if (handleTokenExpiration(res)) return null;
  return res.json();
}

export async function fetchTopTracks(token, timeRange = 'medium_term') {
  const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

export async function fetchTopArtists(token, timeRange = 'medium_term') {
  const res = await fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 兼容性防崩溃导出
export async function fetchLikedSongs() { return { items: [] }; }
export async function fetchArtistsByIds() { return { artists: [] }; }
