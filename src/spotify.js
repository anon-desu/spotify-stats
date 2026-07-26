const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = window.location.origin;

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
  params.append("redirect_uri", REDIRECT_URI);
  params.append("scope", "user-read-private user-read-email user-top-read user-read-recently-played playlist-read-private playlist-read-collaborative");
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
  params.append("redirect_uri", REDIRECT_URI);
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
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('verifier');
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

export async function fetchUserPlaylists(token) {
  const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", { headers: { Authorization: `Bearer ${token}` } });
  if (handleTokenExpiration(res)) return { items: [] };
  return res.json();
}

// 高兼容性歌单获取端点
export async function fetchPlaylistTracks(token, playlistId) {
  try {
    // 方式 1：直连获取全量 Playlist 对象（最稳定）
    let res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('spotify_token');
      localStorage.removeItem('verifier');
      window.location.reload();
      return { items: [] };
    }

    let data = await res.json();
    if (data && data.tracks && data.tracks.items) {
      return { items: data.tracks.items };
    }

    // 方式 2：子路径兜底
    res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('spotify_token');
      localStorage.removeItem('verifier');
      window.location.reload();
      return { items: [] };
    }
    data = await res.json();
    return data || { items: [] };

  } catch (e) {
    console.error("Fetch playlist error:", e);
    return { items: [] };
  }
}

export async function fetchArtistsByIds(token, artistIds) {
  if (!artistIds || artistIds.length === 0) return { artists: [] };
  const idsParam = artistIds.slice(0, 50).join(',');
  const res = await fetch(`https://api.spotify.com/v1/artists?ids=${idsParam}`, { headers: { Authorization: `Bearer ${token}` } });
  if (handleTokenExpiration(res)) return { artists: [] };
  return res.json();
}
