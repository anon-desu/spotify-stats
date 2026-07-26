import React, { useState, useEffect } from 'react';
import { redirectToAuthCodeFlow, getAccessToken, fetchProfile, fetchTopTracks, fetchTopArtists, fetchRecentlyPlayed } from './spotify';
import { Music, Mic, Clock, LogOut } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('spotify_token') || null);
  const [profile, setProfile] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [timeRange, setTimeRange] = useState('medium_term');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const args = new URLSearchParams(window.location.search);
    const code = args.get('code');

    if (code && !token) {
      getAccessToken(code).then((accessToken) => {
        if (accessToken) {
          localStorage.setItem('spotify_token', accessToken);
          setToken(accessToken);
          window.history.replaceState({}, document.title, "/");
        }
      });
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    async function loadData() {
      setLoading(true);
      try {
        const [profData, tracksData, artistsData, recentData] = await Promise.all([
          fetchProfile(token),
          fetchTopTracks(token, timeRange),
          fetchTopArtists(token, timeRange),
          fetchRecentlyPlayed(token)
        ]);
        setProfile(profData);
        setTopTracks(tracksData.items || []);
        setTopArtists(artistsData.items || []);
        setRecentTracks(recentData.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, timeRange]);

  const handleLogout = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('verifier');
    setToken(null);
  };

  const totalRecentMinutes = Math.round(
    recentTracks.reduce((acc, item) => acc + item.track.duration_ms, 0) / 1000 / 60
  );

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 text-center">
        <div className="bg-green-500 p-4 rounded-full mb-6 text-black">
          <Music size={48} />
        </div>
        <h1 className="text-3xl font-extrabold mb-2">My Spotify Stats</h1>
        <p className="text-gray-400 mb-8 max-w-xs text-sm">
          探索你的听歌偏好、热门歌曲排行榜与歌手统计。
        </p>
        <button
          onClick={redirectToAuthCodeFlow}
          className="bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-8 rounded-full transition transform active:scale-95"
        >
          使用 Spotify 登录
        </button>
      </div>
    );
  }

  if (loading && !profile) return <div className="flex h-screen items-center justify-center text-green-500">加载数据中...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 max-w-5xl mx-auto">
      {profile && (
        <div className="flex items-center justify-between border-b border-gray-800 pb-6 mb-6">
          <div className="flex items-center space-x-3">
            {profile.images?.[0]?.url && (
              <img src={profile.images[0].url} alt="" className="w-12 h-12 rounded-full border border-green-500" />
            )}
            <div>
              <h1 className="text-xl font-bold">{profile.display_name}</h1>
              <p className="text-gray-400 text-xs">Spotify 听歌记录分析</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-gray-800 rounded-full text-gray-300">
            <LogOut size={18} />
          </button>
        </div>
      )}

      {/* 切换时间范围 */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'short_term', label: '近 4 周' },
          { key: 'medium_term', label: '近 6 个月' },
          { key: 'long_term', label: '所有时间' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTimeRange(item.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${
              timeRange === item.key ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 听歌时长估算卡片 */}
      <div className="bg-gradient-to-r from-green-900/40 to-gray-900 border border-green-500/20 rounded-xl p-4 mb-8 flex items-center space-x-4">
        <div className="p-3 bg-green-500/20 rounded-lg text-green-400">
          <Clock size={24} />
        </div>
        <div>
          <h3 className="text-gray-400 text-xs">最近 20 首听歌时长</h3>
          <p className="text-2xl font-bold text-white">{totalRecentMinutes} <span className="text-sm font-normal text-gray-400">分钟</span></p>
        </div>
      </div>

      {/* 榜单展示 */}
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-green-400">
            <Music size={18} /> 最爱歌曲 Top 10
          </h2>
          <div className="space-y-2">
            {topTracks.map((track, idx) => (
              <div key={track.id} className="flex items-center justify-between bg-[#181818] p-2.5 rounded-lg">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className="w-4 text-center text-gray-500 font-bold text-xs">{idx + 1}</span>
                  <img src={track.album?.images?.[2]?.url} alt="" className="w-10 h-10 rounded shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-xs truncate">{track.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-green-400">
            <Mic size={18} /> 最爱歌手 Top 10
          </h2>
          <div className="space-y-2">
            {topArtists.map((artist, idx) => (
              <div key={artist.id} className="flex items-center space-x-3 bg-[#181818] p-2.5 rounded-lg">
                <span className="w-4 text-center text-gray-500 font-bold text-xs">{idx + 1}</span>
                <img src={artist.images?.[2]?.url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                <p className="font-semibold text-xs truncate">{artist.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
