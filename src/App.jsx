import React, { useState, useEffect, useRef } from 'react';
import { 
  redirectToAuthCodeFlow, 
  getAccessToken, 
  fetchProfile, 
  fetchTopTracks, 
  fetchTopArtists,
  fetchUserPlaylists,
  fetchPlaylistTracks,
  fetchArtistsByIds
} from './spotify';
import { Music, Mic, LogOut, Sparkles, Heart, Search, ChevronDown, ChevronUp, PieChart as PieIcon, RefreshCw, Github, User, ListMusic, ShieldAlert } from 'lucide-react';

function GenreDonutChart({ data, primaryGenre }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return null;

  let currentAngle = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl flex flex-col items-center shadow-xl w-full">
      <div className="flex items-center justify-between w-full mb-2">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <PieIcon size={16} className="text-[#1DB954]" />
          <span>核心流派偏好分布</span>
        </h3>
        <span className="text-[11px] text-gray-400 font-mono">共 {data.length} 种流派</span>
      </div>

      <div className="relative w-48 h-48 flex items-center justify-center my-3">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 overflow-visible">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#262626" strokeWidth="10" />
          {data.map((item, idx) => {
            const pct = item.value / total;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -currentAngle;
            currentAngle += pct * circumference;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isHovered ? "14" : "10"}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.35,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setHoveredIdx(hoveredIdx === idx ? null : idx);
                }}
              />
            );
          })}
        </svg>

        <div 
          onClick={() => setHoveredIdx(null)}
          className="absolute inset-8 rounded-full flex flex-col items-center justify-center text-center px-2 cursor-pointer select-none"
        >
          {activeItem ? (
            <>
              <span className="text-[11px] text-[#1DB954] font-bold truncate max-w-[110px]">{activeItem.label}</span>
              <span className="text-lg font-extrabold text-white mt-0.5 font-mono">
                {((activeItem.value / total) * 100).toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">主要流派</span>
              <span className="text-xs font-extrabold text-[#1DB954] mt-0.5 truncate max-w-[110px]">{primaryGenre}</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full space-y-2 mt-2 pt-3 border-t border-[#333333]">
        {data.map((item, idx) => {
          const pct = ((item.value / total) * 100).toFixed(1);
          const isHovered = hoveredIdx === idx;

          return (
            <div 
              key={item.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
              className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition cursor-pointer ${
                isHovered ? 'bg-[#262626] font-bold text-white' : 'hover:bg-[#222222] text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </div>
              <span className="font-mono font-bold text-[#1DB954] ml-2">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('spotify_token') || null);
  const [profile, setProfile] = useState(null);
  
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('ALL');

  const [timeRange, setTimeRange] = useState('medium_term');
  const [loading, setLoading] = useState(false);

  const [expandTopTracks, setExpandTopTracks] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    async function initUser() {
      try {
        const [profData, playlistData] = await Promise.all([
          fetchProfile(token),
          fetchUserPlaylists(token)
        ]);
        if (profData) setProfile(profData);
        setPlaylists(playlistData?.items || []);
      } catch (err) {
        console.error(err);
      }
    }
    initUser();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    async function loadData() {
      setLoading(true);
      try {
        if (selectedPlaylist === 'ALL') {
          const [tracksData, artistsData] = await Promise.all([
            fetchTopTracks(token, timeRange),
            fetchTopArtists(token, timeRange)
          ]);
          setTopTracks(tracksData?.items || []);
          setTopArtists(artistsData?.items || []);
        } else {
          // 深度容错解析歌单曲目
          const playlistTracksData = await fetchPlaylistTracks(token, selectedPlaylist);
          const rawItems = playlistTracksData?.items || playlistTracksData?.tracks?.items || [];
          
          const extractedTracks = rawItems
            .map(item => item.track || item)
            .filter(t => t && t.name);
            
          setTopTracks(extractedTracks);

          // 提取歌手
          const artistMap = {};
          extractedTracks.forEach(t => {
            t.artists?.forEach(a => {
              if (a.name) {
                if (!artistMap[a.name]) {
                  artistMap[a.name] = { id: a.id || a.name, name: a.name, count: 0, images: [], genres: ['J-Pop / ACG'] };
                }
                artistMap[a.name].count += 1;
              }
            });
          });

          const directArtists = Object.values(artistMap).sort((a, b) => b.count - a.count);

          const artistIds = directArtists.map(a => a.id).filter(id => id && id.length > 5);
          if (artistIds.length > 0) {
            try {
              const enrichedData = await fetchArtistsByIds(token, artistIds);
              const enrichedMap = {};
              enrichedData?.artists?.forEach(art => {
                if (art) enrichedMap[art.id] = art;
              });

              const mergedArtists = directArtists.map(a => ({
                ...a,
                images: enrichedMap[a.id]?.images || [],
                genres: enrichedMap[a.id]?.genres?.length ? enrichedMap[a.id].genres : ['J-Pop']
              }));
              setTopArtists(mergedArtists);
            } catch (e) {
              setTopArtists(directArtists);
            }
          } else {
            setTopArtists(directArtists);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, timeRange, selectedPlaylist]);

  const handleForceReAuth = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('verifier');
    setToken(null);
    setShowUserMenu(false);
    redirectToAuthCodeFlow();
  };

  const totalTrackWeight = topTracks.reduce((acc, _, idx) => acc + (50 - idx), 0) || 1;
  const processedTracks = topTracks.map((track, idx) => {
    const originalRank = idx + 1;
    const weight = Math.max(50 - idx, 1);
    const pctNumber = (weight / totalTrackWeight) * 100;
    return {
      ...track,
      originalRank,
      weight,
      pctNumber,
      pctStr: pctNumber < 0.1 ? '<0.1%' : `${pctNumber.toFixed(1)}%`
    };
  }).filter(t => t.pctNumber > 0.05);

  const maxTrackWeight = processedTracks[0]?.weight || 50;

  const processedArtists = topArtists.map((artist, idx) => {
    const originalRank = idx + 1;
    const pctNumber = Math.max((50 - idx) / 12.75, 0.1);
    return {
      ...artist,
      originalRank,
      pctStr: `${pctNumber.toFixed(1)}%`
    };
  });

  const genreCounts = {};
  topArtists.forEach(artist => {
    artist.genres?.forEach(g => {
      const formatted = g.charAt(0).toUpperCase() + g.slice(1);
      genreCounts[formatted] = (genreCounts[formatted] || 0) + 1;
    });
  });

  const totalGenreCount = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
  const sortedGenres = Object.entries(genreCounts)
    .map(([label, value]) => ({ label, value, pct: (value / totalGenreCount) * 100 }))
    .filter(g => g.pct > 0.1)
    .sort((a, b) => b.value - a.value);

  const GENRE_COLORS = ['#1DB954', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#374151'];

  const topGenres = sortedGenres.slice(0, 6);
  const otherGenresCount = sortedGenres.slice(6).reduce((acc, cur) => acc + cur.value, 0);

  const genreDonutData = [
    ...topGenres.map((g, idx) => ({
      label: g.label,
      value: g.value,
      color: GENRE_COLORS[idx % GENRE_COLORS.length]
    })),
    ...(otherGenresCount > 0 ? [{
      label: '其他音乐流派',
      value: otherGenresCount,
      color: '#374151'
    }] : [])
  ];

  const filteredTracks = processedTracks.filter(t => 
    (t.name || '').toLowerCase().includes(trackSearch.toLowerCase()) ||
    t.artists?.some(a => (a.name || '').toLowerCase().includes(trackSearch.toLowerCase()))
  );

  const filteredArtists = processedArtists.filter(a => 
    (a.name || '').toLowerCase().includes(artistSearch.toLowerCase())
  );

  const currentSelectedPlaylistObj = playlists.find(p => p.id === selectedPlaylist);
  const isSelectedOfficial = currentSelectedPlaylistObj && profile && currentSelectedPlaylistObj.owner?.id !== profile.id;

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 text-center">
        <div className="bg-[#1DB954] p-4 rounded-full mb-6 text-black shadow-lg shadow-[#1DB954]/20">
          <Music size={48} />
        </div>
        <h1 className="text-3xl font-extrabold mb-2">My Spotify Stats</h1>
        <p className="text-gray-400 mb-8 max-w-xs text-sm">
          个人听歌数据深度分析与数据可视化看板。
        </p>
        <button
          onClick={redirectToAuthCodeFlow}
          className="bg-[#1DB954] hover:bg-green-400 text-black font-bold py-3.5 px-8 rounded-full transition transform active:scale-95 shadow-md"
        >
          使用 Spotify 登录
        </button>
      </div>
    );
  }

  if (loading && !profile) return <div className="flex h-screen items-center justify-center text-[#1DB954] font-bold font-mono">加载数据中...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 max-w-6xl mx-auto pb-16 selection:bg-[#1DB954] selection:text-black">
      {/* 1. 顶部 Header */}
      {profile && (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#333333]">
          <div className="relative" ref={userMenuRef}>
            <div 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 bg-[#181818] hover:bg-[#222222] border border-[#333333] px-3.5 py-1.5 rounded-full cursor-pointer transition shadow-md select-none group"
            >
              {profile.images?.[0]?.url ? (
                <img src={profile.images[0].url} alt="" className="w-8 h-8 rounded-full border border-[#1DB954] object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1DB954]/20 border border-[#1DB954] flex items-center justify-center text-[#1DB954]">
                  <User size={16} />
                </div>
              )}
              <div className="pr-1">
                <h1 className="text-xs font-bold text-white flex items-center gap-1 group-hover:text-[#1DB954] transition">
                  {profile.display_name}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </h1>
                <p className="text-[10px] text-gray-400">Spotify 听歌看板</p>
              </div>
            </div>

            {showUserMenu && (
              <div className="absolute left-0 mt-2 w-52 bg-[#181818] border border-[#333333] rounded-2xl shadow-2xl p-2.5 z-50">
                <div className="p-2 border-b border-[#2a2a2a] mb-1">
                  <p className="text-xs font-bold text-white truncate">{profile.display_name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{profile.email || 'Spotify 已授权账号'}</p>
                </div>
                <button
                  onClick={handleForceReAuth}
                  className="flex items-center space-x-2 w-full text-left text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-xl transition"
                >
                  <LogOut size={14} />
                  <span>退出当前账号</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center bg-[#181818] border border-[#333333] rounded-full px-3 py-1.5 text-xs text-gray-300">
              <ListMusic size={14} className="text-[#1DB954] mr-1.5 shrink-0" />
              <select
                value={selectedPlaylist}
                onChange={(e) => setSelectedPlaylist(e.target.value)}
                className="bg-transparent text-white outline-none cursor-pointer text-xs max-w-[150px] sm:max-w-[190px] truncate"
              >
                <option value="ALL" className="bg-[#181818] text-white">🌐 账号总体偏好</option>
                {playlists.map(p => {
                  const isMine = profile && p.owner?.id === profile.id;
                  return (
                    <option key={p.id} value={p.id} className="bg-[#181818] text-white">
                      {isMine ? '👤 个人: ' : '🔒 官方: '}{p.name}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedPlaylist === 'ALL' && (
              <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#333333]">
                {[
                  { key: 'short_term', label: '近 4 周' },
                  { key: 'medium_term', label: '近 6 个月' },
                  { key: 'long_term', label: '近 1 年' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTimeRange(item.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      timeRange === item.key 
                        ? 'bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/20' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <a
              href="https://github.com/anon-desu/spotify-stats"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-[#181818] hover:bg-[#222222] border border-[#333333] text-gray-300 hover:text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-md hover:scale-105 shrink-0 ml-auto sm:ml-0"
              title="GitHub 源代码"
            >
              <Github size={18} />
            </a>
          </div>
        </header>
      )}

      {selectedPlaylist !== 'ALL' && isSelectedOfficial && topTracks.length === 0 && !loading && (
        <div className="my-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <ShieldAlert size={20} className="shrink-0 text-amber-400" />
            <span>
              <strong>Spotify 官方 API 限制通知：</strong>由于你的应用处于未审核开发模式，Spotify 官方禁止 API 读取公共/官方编辑歌单。请在下拉菜单中切换为你<strong>自己创建的歌单 (`👤 个人歌单`)</strong> 即可完美显示！
            </span>
          </div>
        </div>
      )}

      {/* 2. 核心 KPI 概览区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-6">
        <div className="bg-[#181818] border border-[#333333] p-5 rounded-2xl flex items-center justify-between hover:border-[#1DB954]/40 transition-colors shadow-lg">
          <div>
            <p className="text-gray-400 text-xs font-medium">
              {selectedPlaylist === 'ALL' ? '精选热听曲目' : '当前歌单收录曲目'}
            </p>
            <p className="text-2xl font-black text-white mt-1 font-mono tracking-tight">{topTracks.length} <span className="text-sm font-normal text-gray-400">首</span></p>
          </div>
          <div className="p-3 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Music size={22} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#333333] p-5 rounded-2xl flex items-center justify-between hover:border-[#1DB954]/40 transition-colors shadow-lg">
          <div>
            <p className="text-gray-400 text-xs font-medium">核心偏好流派</p>
            <p className="text-lg font-bold text-[#1DB954] mt-1 truncate max-w-[180px] sm:max-w-[260px]">{sortedGenres[0]?.label || 'J-Pop / ACG'}</p>
          </div>
          <div className="p-3 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Heart size={22} />
          </div>
        </div>
      </div>

      {/* 3. 图表分析区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
        <GenreDonutChart data={genreDonutData} primaryGenre={sortedGenres[0]?.label || 'J-Pop'} />

        <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl flex flex-col justify-between shadow-xl w-full h-full min-h-[360px]">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <Sparkles size={16} className="text-[#1DB954]" />
                <span>Top 热门歌曲权重 (水平条形图)</span>
              </h3>
              <span className="text-[11px] text-gray-400 font-mono">权值百分比</span>
            </div>

            <div className="space-y-4">
              {(expandTopTracks ? processedTracks : processedTracks.slice(0, 5)).map((track) => {
                const barWidthPct = ((track.weight / maxTrackWeight) * 100).toFixed(1);
                return (
                  <div key={track.id || track.name} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <span className="font-mono text-gray-500 font-bold text-xs w-4">{track.originalRank}</span>
                        <img src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-gray-800" />
                        <span className="font-semibold text-gray-200 truncate max-w-[180px] sm:max-w-[240px]">{track.name}</span>
                        <span className="text-gray-500 text-[11px] truncate hidden sm:inline">- {track.artists?.map(a => a.name).join(', ')}</span>
                      </div>
                      <span className="font-mono font-bold text-[#1DB954] shrink-0 ml-2">{track.pctStr}</span>
                    </div>
                    <div className="w-full bg-[#262626] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#1DB954] to-emerald-400 h-full rounded-full transition-all duration-500 group-hover:brightness-125"
                        style={{ width: `${barWidthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {processedTracks.length > 5 && (
            <button
              onClick={() => setExpandTopTracks(!expandTopTracks)}
              className="mt-6 text-xs text-gray-400 hover:text-[#1DB954] bg-[#222222] hover:bg-[#282828] py-2 rounded-xl transition w-full text-center border border-[#333333] flex items-center justify-center gap-1.5 font-medium"
            >
              {expandTopTracks ? (
                <>收起列表 <ChevronUp size={14} /></>
              ) : (
                <>展开查看全量歌曲权重 <ChevronDown size={14} /></>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 4. 榜单明细区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Music size={18} className="text-[#1DB954]" /> 最爱歌曲榜单
            </h2>
            <div className="relative w-full sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索歌曲或歌手..."
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                className="w-full bg-[#121212] border border-[#333333] focus:border-[#1DB954] rounded-full pl-8 pr-3 py-1 text-xs text-gray-200 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredTracks.slice(0, 10).map((track) => (
              <div key={track.id || track.name} className="flex items-center justify-between bg-[#121212] hover:bg-[#222222] p-3 rounded-xl border border-[#2a2a2a] transition group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                    track.originalRank === 1 ? 'bg-[#1DB954] text-black' :
                    track.originalRank === 2 ? 'bg-emerald-700 text-white' :
                    track.originalRank === 3 ? 'bg-teal-800 text-white' : 'text-gray-500'
                  }`}>
                    {track.originalRank}
                  </span>
                  <img src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-gray-800" />
                  <div className="truncate">
                    <p className="font-semibold text-xs text-gray-100 truncate group-hover:text-[#1DB954] transition">{track.name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artists?.map(a => a.name).join(', ')}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 shrink-0 ml-2 font-mono">
                  <span className="text-xs text-gray-500">
                    {Math.floor((track.duration_ms || 0) / 60000)}:{Math.floor(((track.duration_ms || 0) % 60000) / 1000).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 px-2 py-0.5 rounded-md">
                    {track.pctStr}
                  </span>
                </div>
              </div>
            ))}

            {filteredTracks.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500 font-mono mb-3">暂无匹配歌曲数据</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Mic size={18} className="text-[#1DB954]" /> 最爱歌手榜单
            </h2>
            <div className="relative w-full sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索歌手..."
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                className="w-full bg-[#121212] border border-[#333333] focus:border-[#1DB954] rounded-full pl-8 pr-3 py-1 text-xs text-gray-200 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredArtists.slice(0, 10).map((artist) => (
              <div key={artist.id || artist.name} className="flex items-center justify-between bg-[#121212] hover:bg-[#222222] p-3 rounded-xl border border-[#2a2a2a] transition group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                    artist.originalRank === 1 ? 'bg-[#1DB954] text-black' :
                    artist.originalRank === 2 ? 'bg-emerald-700 text-white' :
                    artist.originalRank === 3 ? 'bg-teal-800 text-white' : 'text-gray-500'
                  }`}>
                    {artist.originalRank}
                  </span>
                  <img src={artist.images?.[2]?.url || artist.images?.[0]?.url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-700 bg-gray-800" />
                  <div className="truncate">
                    <p className="font-semibold text-xs text-gray-100 truncate group-hover:text-[#1DB954] transition">{artist.name}</p>
                    <span className="inline-block text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full mt-0.5 truncate max-w-[140px]">
                      {artist.genres?.[0] ? artist.genres[0].charAt(0).toUpperCase() + artist.genres[0].slice(1) : '歌手'}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-xs font-bold text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 px-2 py-0.5 rounded-md shrink-0 ml-2">
                  {artist.pctStr}
                </span>
              </div>
            ))}

            {filteredArtists.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500 font-mono mb-3">暂无匹配歌手数据</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
                    }
