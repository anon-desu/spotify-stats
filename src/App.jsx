import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  redirectToAuthCodeFlow, 
  getAccessToken, 
  fetchProfile, 
  fetchTopTracks, 
  fetchTopArtists,
  fetchRecentlyPlayed,
  fetchLikedSongs,
  fetchCurrentlyPlaying
} from './spotify';
import { 
  Music, 
  Mic, 
  LogOut, 
  Sparkles, 
  Heart, 
  Search, 
  PieChart as PieIcon, 
  Github, 
  User, 
  Clock, 
  Radio, 
  ExternalLink, 
  Flame, 
  Disc,
  RefreshCw
} from 'lucide-react';

// 格式化歌曲时长 (毫秒 -> mm:ss)
function formatDuration(ms) {
  if (!ms) return '0:00';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// 格式化相对播放时间
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return new Date(isoString).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

// 真实流派分布甜甜圈图
function GenreDonutChart({ data, primaryGenre }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return null;

  let currentAngle = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] p-6 rounded-2xl flex flex-col items-center shadow-xl w-full">
      <div className="flex items-center justify-between w-full mb-2">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <PieIcon size={16} className="text-[#1DB954]" />
          <span>核心流派偏好分布</span>
        </h3>
        <span className="text-[11px] text-gray-400 font-mono">Top 歌手流派统计</span>
      </div>

      <div className="relative w-44 h-44 flex items-center justify-center my-3">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 overflow-visible">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#222222" strokeWidth="10" />
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
                strokeWidth={isHovered ? "13" : "9"}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.3,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
              />
            );
          })}
        </svg>

        <div 
          onClick={() => setHoveredIdx(null)}
          className="absolute inset-6 rounded-full flex flex-col items-center justify-center text-center px-2 cursor-pointer select-none"
        >
          {activeItem ? (
            <>
              <span className="text-[11px] text-[#1DB954] font-bold truncate max-w-[100px]">{activeItem.label}</span>
              <span className="text-base font-extrabold text-white mt-0.5 font-mono">
                {((activeItem.value / total) * 100).toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">主要流派</span>
              <span className="text-xs font-extrabold text-[#1DB954] mt-0.5 truncate max-w-[100px]">{primaryGenre}</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full space-y-1.5 mt-2 pt-3 border-t border-[#282828] max-h-48 overflow-y-auto pr-1 custom-scrollbar">
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
  const [token, setToken] = useState(() => localStorage.getItem('spotify_token') || null);
  const [profile, setProfile] = useState(null);
  
  // 核心数据状态
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [likedSongsTotal, setLikedSongsTotal] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);

  // 控制状态
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'history'
  const [timeRange, setTimeRange] = useState('medium_term');
  const [loading, setLoading] = useState(false);
  const [refreshingNowPlaying, setRefreshingNowPlaying] = useState(false);

  // 搜索关键字
  const [trackSearch, setTrackSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userMenuRef = useRef(null);

  // 点击外部关闭用户浮窗
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // OAuth 回调 Code 换取 Access Token
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

  // 获取正在播放状态
  const checkCurrentlyPlaying = async () => {
    if (!token) return;
    setRefreshingNowPlaying(true);
    try {
      const nowData = await fetchCurrentlyPlaying(token);
      setCurrentlyPlaying(nowData?.is_playing ? nowData : null);
    } catch {
      setCurrentlyPlaying(null);
    } finally {
      setRefreshingNowPlaying(false);
    }
  };

  // 初始加载主要数据
  useEffect(() => {
    if (!token) return;
    let isCancelled = false;

    async function loadAllData() {
      setLoading(true);
      try {
        const [profData, tracksData, artistsData, recentData, likedData] = await Promise.all([
          fetchProfile(token),
          fetchTopTracks(token, timeRange, 50),
          fetchTopArtists(token, timeRange, 50),
          fetchRecentlyPlayed(token, 30),
          fetchLikedSongs(token, 1, 0)
        ]);

        if (isCancelled) return;
        if (profData) setProfile(profData);
        setTopTracks(tracksData?.items || []);
        setTopArtists(artistsData?.items || []);
        setRecentlyPlayed(recentData?.items || []);
        setLikedSongsTotal(likedData?.total || 0);

        checkCurrentlyPlaying();
      } catch (err) {
        console.error("加载 Spotify 数据失败:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadAllData();
    return () => { isCancelled = true; };
  }, [token, timeRange]);

  const handleForceReAuth = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('verifier');
    setToken(null);
    setShowUserMenu(false);
    redirectToAuthCodeFlow();
  };

  // 高性能流派数据聚合计算
  const { genreDonutData, primaryGenre } = useMemo(() => {
    const genreCounts = {};
    topArtists.forEach(artist => {
      artist.genres?.forEach(g => {
        const formatted = g.charAt(0).toUpperCase() + g.slice(1);
        genreCounts[formatted] = (genreCounts[formatted] || 0) + 1;
      });
    });

    const totalCount = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(genreCounts)
      .map(([label, value]) => ({ label, value, pct: (value / totalCount) * 100 }))
      .sort((a, b) => b.value - a.value);

    const GENRE_COLORS = ['#1DB954', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#10B981', '#6366F1'];
    const top = sorted.slice(0, 6);
    const otherSum = sorted.slice(6).reduce((acc, cur) => acc + cur.value, 0);

    const donut = [
      ...top.map((g, idx) => ({
        label: g.label,
        value: g.value,
        color: GENRE_COLORS[idx % GENRE_COLORS.length]
      })),
      ...(otherSum > 0 ? [{ label: '其他音乐流派', value: otherSum, color: '#374151' }] : [])
    ];

    return {
      genreDonutData: donut,
      primaryGenre: sorted[0]?.label || '流行 / 综合'
    };
  }, [topArtists]);

  // 高性能过滤搜索
  const filteredTracks = useMemo(() => {
    if (!trackSearch.trim()) return topTracks;
    const q = trackSearch.toLowerCase();
    return topTracks.filter(t => 
      t.name?.toLowerCase().includes(q) ||
      t.artists?.some(a => a.name?.toLowerCase().includes(q)) ||
      t.album?.name?.toLowerCase().includes(q)
    );
  }, [topTracks, trackSearch]);

  const filteredArtists = useMemo(() => {
    if (!artistSearch.trim()) return topArtists;
    const q = artistSearch.toLowerCase();
    return topArtists.filter(a => 
      a.name?.toLowerCase().includes(q) ||
      a.genres?.some(g => g.toLowerCase().includes(q))
    );
  }, [topArtists, artistSearch]);

  // 未登录界面
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 text-center">
        <div className="bg-[#1DB954] p-5 rounded-full mb-6 text-black shadow-xl shadow-[#1DB954]/20 animate-pulse">
          <Music size={44} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">My Spotify Stats</h1>
        <p className="text-gray-400 mb-8 max-w-sm text-xs sm:text-sm leading-relaxed">
          基于 Spotify 官方 Web API 规范构建，深入解析你的常听歌曲、喜好流派与听歌足迹。
        </p>
        <button
          onClick={redirectToAuthCodeFlow}
          className="bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold py-3.5 px-8 rounded-full transition transform active:scale-95 shadow-lg shadow-[#1DB954]/20 flex items-center gap-2"
        >
          <Sparkles size={18} />
          <span>关联 Spotify 账号</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 max-w-6xl mx-auto pb-20 selection:bg-[#1DB954] selection:text-black">
      {/* 顶部导航 */}
      {profile && (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#282828]">
          <div className="relative" ref={userMenuRef}>
            <div 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 bg-[#181818] hover:bg-[#202020] border border-[#2a2a2a] px-3.5 py-1.5 rounded-full cursor-pointer transition shadow-md select-none group"
            >
              {profile.images?.[0]?.url ? (
                <img src={profile.images[0].url} alt="" className="w-8 h-8 rounded-full border border-[#1DB954] object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1DB954]/20 border border-[#1DB954] flex items-center justify-center text-[#1DB954]">
                  <User size={16} />
                </div>
              )}
              <div className="pr-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-bold text-white group-hover:text-[#1DB954] transition truncate max-w-[140px]">
                    {profile.display_name}
                  </h1>
                  <span className="text-[9px] uppercase font-mono bg-[#1DB954]/20 text-[#1DB954] px-1.5 py-0.2 rounded font-semibold">
                    {profile.product || 'Account'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">{profile.country ? `地区: ${profile.country}` : '已同步官方数据'}</p>
              </div>
            </div>

            {showUserMenu && (
              <div className="absolute left-0 mt-2 w-56 bg-[#181818] border border-[#2f2f2f] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2 border-b border-[#282828] mb-1">
                  <p className="text-xs font-bold text-white truncate">{profile.display_name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{profile.email || '已连接 Spotify'}</p>
                </div>
                <button
                  onClick={handleForceReAuth}
                  className="flex items-center space-x-2 w-full text-left text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-xl transition"
                >
                  <LogOut size={14} />
                  <span>更新授权并重新登录</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* 时间跨度过滤 (仅在 ranking Tab 生效) */}
            {activeTab === 'ranking' && (
              <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#2a2a2a]">
                {[
                  { key: 'short_term', label: '近 4 周' },
                  { key: 'medium_term', label: '近 6 个月' },
                  { key: 'long_term', label: '长期累积' }
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
              className="p-2.5 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-gray-300 hover:text-white rounded-full transition shadow-md"
              title="GitHub 源代码"
            >
              <Github size={17} />
            </a>
          </div>
        </header>
      )}

      {/* 扩展功能 1: 正在播放 (Now Playing) 动态卡片 */}
      {currentlyPlaying?.item && (
        <div className="mt-5 bg-gradient-to-r from-[#181818] via-[#1a1f1a] to-[#181818] border border-[#1DB954]/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3.5 overflow-hidden">
            <div className="relative shrink-0">
              <img 
                src={currentlyPlaying.item.album?.images?.?.url || currentlyPlaying.item.album?.images?.[0]?.url} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover shadow-md"
              />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#1DB954]"></span>
              </span>
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-wider text-[#1DB954] uppercase flex items-center gap-1">
                  <Radio size={12} className="animate-pulse" /> 正在播放
                </span>
                {currentlyPlaying.device?.name && (
                  <span className="text-[10px] text-gray-500 font-mono">· {currentlyPlaying.device.name}</span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">{currentlyPlaying.item.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{currentlyPlaying.item.artists?.map(a => a.name).join(', ')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0 ml-3">
            <button
              onClick={checkCurrentlyPlaying}
              className="p-2 text-gray-400 hover:text-[#1DB954] transition"
              title="刷新播放状态"
            >
              <RefreshCw size={14} className={refreshingNowPlaying ? "animate-spin text-[#1DB954]" : ""} />
            </button>
            <a
              href={currentlyPlaying.item.external_urls?.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954] hover:text-emerald-300 p-2 transition"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}

      {/* 核心 KPI 真实数据指标看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium">常听单曲库</p>
            <p className="text-xl font-black text-white mt-1 font-mono">{topTracks.length} <span className="text-xs font-normal text-gray-500">首</span></p>
          </div>
          <div className="p-2.5 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Music size={18} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium">已收藏红心歌曲</p>
            <p className="text-xl font-black text-white mt-1 font-mono">{likedSongsTotal} <span className="text-xs font-normal text-gray-500">首</span></p>
          </div>
          <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
            <Heart size={18} />
          </div>
        </div>

        <div className="w-full space-y-1.5 mt-2 pt-3 border-t border-[#282828] max-h-48 overflow-y-auto pr-1 custom-scrollbar">
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
  const [token, setToken] = useState(() => localStorage.getItem('spotify_token') || null);
  const [profile, setProfile] = useState(null);
  
  // 核心数据状态
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [likedSongsTotal, setLikedSongsTotal] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);

  // 控制状态
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'history'
  const [timeRange, setTimeRange] = useState('medium_term');
  const [loading, setLoading] = useState(false);
  const [refreshingNowPlaying, setRefreshingNowPlaying] = useState(false);

  // 搜索关键字
  const [trackSearch, setTrackSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userMenuRef = useRef(null);

  // 点击外部关闭用户浮窗
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // OAuth 回调 Code 换取 Access Token
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

  // 获取正在播放状态
  const checkCurrentlyPlaying = async () => {
    if (!token) return;
    setRefreshingNowPlaying(true);
    try {
      const nowData = await fetchCurrentlyPlaying(token);
      setCurrentlyPlaying(nowData?.is_playing ? nowData : null);
    } catch {
      setCurrentlyPlaying(null);
    } finally {
      setRefreshingNowPlaying(false);
    }
  };

  // 初始加载主要数据
  useEffect(() => {
    if (!token) return;
    let isCancelled = false;

    async function loadAllData() {
      setLoading(true);
      try {
        const [profData, tracksData, artistsData, recentData, likedData] = await Promise.all([
          fetchProfile(token),
          fetchTopTracks(token, timeRange, 50),
          fetchTopArtists(token, timeRange, 50),
          fetchRecentlyPlayed(token, 30),
          fetchLikedSongs(token, 1, 0)
        ]);

        if (isCancelled) return;
        if (profData) setProfile(profData);
        setTopTracks(tracksData?.items || []);
        setTopArtists(artistsData?.items || []);
        setRecentlyPlayed(recentData?.items || []);
        setLikedSongsTotal(likedData?.total || 0);

        checkCurrentlyPlaying();
      } catch (err) {
        console.error("加载 Spotify 数据失败:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadAllData();
    return () => { isCancelled = true; };
  }, [token, timeRange]);

  const handleForceReAuth = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('verifier');
    setToken(null);
    setShowUserMenu(false);
    redirectToAuthCodeFlow();
  };

  // 高性能流派数据聚合计算
  const { genreDonutData, primaryGenre } = useMemo(() => {
    const genreCounts = {};
    topArtists.forEach(artist => {
      artist.genres?.forEach(g => {
        const formatted = g.charAt(0).toUpperCase() + g.slice(1);
        genreCounts[formatted] = (genreCounts[formatted] || 0) + 1;
      });
    });

    const totalCount = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(genreCounts)
      .map(([label, value]) => ({ label, value, pct: (value / totalCount) * 100 }))
      .sort((a, b) => b.value - a.value);

    const GENRE_COLORS = ['#1DB954', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#10B981', '#6366F1'];
    const top = sorted.slice(0, 6);
    const otherSum = sorted.slice(6).reduce((acc, cur) => acc + cur.value, 0);

    const donut = [
      ...top.map((g, idx) => ({
        label: g.label,
        value: g.value,
        color: GENRE_COLORS[idx % GENRE_COLORS.length]
      })),
      ...(otherSum > 0 ? [{ label: '其他音乐流派', value: otherSum, color: '#374151' }] : [])
    ];

    return {
      genreDonutData: donut,
      primaryGenre: sorted[0]?.label || '流行 / 综合'
    };
  }, [topArtists]);

  // 高性能过滤搜索
  const filteredTracks = useMemo(() => {
    if (!trackSearch.trim()) return topTracks;
    const q = trackSearch.toLowerCase();
    return topTracks.filter(t => 
      t.name?.toLowerCase().includes(q) ||
      t.artists?.some(a => a.name?.toLowerCase().includes(q)) ||
      t.album?.name?.toLowerCase().includes(q)
    );
  }, [topTracks, trackSearch]);

  const filteredArtists = useMemo(() => {
    if (!artistSearch.trim()) return topArtists;
    const q = artistSearch.toLowerCase();
    return topArtists.filter(a => 
      a.name?.toLowerCase().includes(q) ||
      a.genres?.some(g => g.toLowerCase().includes(q))
    );
  }, [topArtists, artistSearch]);

  // 未登录界面
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 text-center">
        <div className="bg-[#1DB954] p-5 rounded-full mb-6 text-black shadow-xl shadow-[#1DB954]/20 animate-pulse">
          <Music size={44} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">My Spotify Stats</h1>
        <p className="text-gray-400 mb-8 max-w-sm text-xs sm:text-sm leading-relaxed">
          基于 Spotify 官方 Web API 规范构建，深入解析你的常听歌曲、喜好流派与听歌足迹。
        </p>
        <button
          onClick={redirectToAuthCodeFlow}
          className="bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold py-3.5 px-8 rounded-full transition transform active:scale-95 shadow-lg shadow-[#1DB954]/20 flex items-center gap-2"
        >
          <Sparkles size={18} />
          <span>关联 Spotify 账号</span>
        </button>
      </div>
    );
      }
      return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 max-w-6xl mx-auto pb-20 selection:bg-[#1DB954] selection:text-black">
      {/* 顶部导航 */}
      {profile && (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#282828]">
          <div className="relative" ref={userMenuRef}>
            <div 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 bg-[#181818] hover:bg-[#202020] border border-[#2a2a2a] px-3.5 py-1.5 rounded-full cursor-pointer transition shadow-md select-none group"
            >
              {profile.images?.[0]?.url ? (
                <img src={profile.images[0].url} alt="" className="w-8 h-8 rounded-full border border-[#1DB954] object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1DB954]/20 border border-[#1DB954] flex items-center justify-center text-[#1DB954]">
                  <User size={16} />
                </div>
              )}
              <div className="pr-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-bold text-white group-hover:text-[#1DB954] transition truncate max-w-[140px]">
                    {profile.display_name}
                  </h1>
                  <span className="text-[9px] uppercase font-mono bg-[#1DB954]/20 text-[#1DB954] px-1.5 py-0.2 rounded font-semibold">
                    {profile.product || 'Account'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">{profile.country ? `地区: ${profile.country}` : '已同步官方数据'}</p>
              </div>
            </div>

            {showUserMenu && (
              <div className="absolute left-0 mt-2 w-56 bg-[#181818] border border-[#2f2f2f] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2 border-b border-[#282828] mb-1">
                  <p className="text-xs font-bold text-white truncate">{profile.display_name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{profile.email || '已连接 Spotify'}</p>
                </div>
                <button
                  onClick={handleForceReAuth}
                  className="flex items-center space-x-2 w-full text-left text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-xl transition"
                >
                  <LogOut size={14} />
                  <span>更新授权并重新登录</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* 时间跨度过滤 (仅在 ranking Tab 生效) */}
            {activeTab === 'ranking' && (
              <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#2a2a2a]">
                {[
                  { key: 'short_term', label: '近 4 周' },
                  { key: 'medium_term', label: '近 6 个月' },
                  { key: 'long_term', label: '长期累积' }
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
              className="p-2.5 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-gray-300 hover:text-white rounded-full transition shadow-md"
              title="GitHub 源代码"
            >
              <Github size={17} />
            </a>
          </div>
        </header>
      )}

      {/* 扩展功能 1: 正在播放 (Now Playing) 动态卡片 */}
      {currentlyPlaying?.item && (
        <div className="mt-5 bg-gradient-to-r from-[#181818] via-[#1a1f1a] to-[#181818] border border-[#1DB954]/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3.5 overflow-hidden">
            <div className="relative shrink-0">
              <img 
                src={currentlyPlaying.item.album?.images?.?.url || currentlyPlaying.item.album?.images?.[0]?.url} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover shadow-md"
              />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#1DB954]"></span>
              </span>
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-wider text-[#1DB954] uppercase flex items-center gap-1">
                  <Radio size={12} className="animate-pulse" /> 正在播放
                </span>
                {currentlyPlaying.device?.name && (
                  <span className="text-[10px] text-gray-500 font-mono">· {currentlyPlaying.device.name}</span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">{currentlyPlaying.item.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{currentlyPlaying.item.artists?.map(a => a.name).join(', ')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0 ml-3">
            <button
              onClick={checkCurrentlyPlaying}
              className="p-2 text-gray-400 hover:text-[#1DB954] transition"
              title="刷新播放状态"
            >
              <RefreshCw size={14} className={refreshingNowPlaying ? "animate-spin text-[#1DB954]" : ""} />
            </button>
            <a
              href={currentlyPlaying.item.external_urls?.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954] hover:text-emerald-300 p-2 transition"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}

      {/* 核心 KPI 真实数据指标看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium">常听单曲库</p>
            <p className="text-xl font-black text-white mt-1 font-mono">{topTracks.length} <span className="text-xs font-normal text-gray-500">首</span></p>
          </div>
          <div className="p-2.5 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Music size={18} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium">已收藏红心歌曲</p>
            <p className="text-xl font-black text-white mt-1 font-mono">{likedSongsTotal} <span className="text-xs font-normal text-gray-500">首</span></p>
          </div>
          <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
            <Heart size={18} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium">常听歌手</p>
            <p className="text-xl font-black text-white mt-1 font-mono">{topArtists.length} <span className="text-xs font-normal text-gray-500">位</span></p>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <Mic size={18} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-gray-400 text-xs font-medium">主导流派</p>
            <p className="text-base font-bold text-[#1DB954] mt-1 truncate">{primaryGenre}</p>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20 shrink-0">
            <Sparkles size={18} />
          </div>
        </div>
      </div>

      {/* Tab 栏切换（排行榜 vs 播放足迹） */}
      <div className="flex border-b border-[#282828] mb-6 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'ranking' 
              ? 'border-[#1DB954] text-[#1DB954]' 
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Music size={16} />
          <span>常听排行与画像</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'history' 
              ? 'border-[#1DB954] text-[#1DB954]' 
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Clock size={16} />
          <span>近期播放足迹 ({recentlyPlayed.length})</span>
        </button>
      </div>

      {/* 数据加载状态 */}
      {loading ? (
        <div className="space-y-4 py-12">
          <div className="flex items-center justify-center space-x-2 text-[#1DB954] font-mono text-sm">
            <RefreshCw size={16} className="animate-spin" />
            <span>正在同步 Spotify 官方真实数据...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse pt-4">
            <div className="h-44 bg-[#181818] rounded-2xl border border-[#2a2a2a]" />
            <div className="h-44 bg-[#181818] rounded-2xl border border-[#2a2a2a]" />
          </div>
        </div>
      ) : activeTab === 'ranking' ? (
        <>
          {/* 流派偏好分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start">
            <div className="lg:col-span-1">
              <GenreDonutChart data={genreDonutData} primaryGenre={primaryGenre} />
            </div>

            {/* 官方准确热度榜单（替换伪造权重条形图） */}
            <div className="lg:col-span-2 bg-[#181818] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <Flame size={16} className="text-[#1DB954]" />
                  <span>常听单曲官方热度指数 (Popularity)</span>
                </h3>
                <span className="text-[11px] text-gray-400 font-mono">官方指数 0–100</span>
              </div>

              <div className="space-y-3">
                {topTracks.slice(0, 6).map((track, idx) => (
                  <div key={track.id} className="space-y-1 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <span className="font-mono text-gray-500 font-bold w-4">{idx + 1}</span>
                        <img 
                          src={track.album?.images?.?.url || track.album?.images?.[0]?.url} 
                          alt="" 
                          className="w-7 h-7 rounded object-cover shrink-0 bg-gray-800" 
                        />
                        <span className="font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-[320px]">
                          {track.name}
                        </span>
                        <span className="text-gray-500 text-[11px] truncate hidden sm:inline">
                          · {track.artists?.map(a => a.name).join(', ')}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#1DB954]">{track.popularity}/100</span>
                    </div>
                    <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#1DB954] to-emerald-400 h-full rounded-full transition-all duration-500 group-hover:brightness-125"
                        style={{ width: `${track.popularity || 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 歌曲与歌手双栏明细 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左栏：歌曲榜 */}
            <div className="bg-[#181818] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <Music size={18} className="text-[#1DB954]" /> 最爱单曲明细
                </h2>
                <div className="relative w-full sm:w-44">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="搜索歌曲 / 专辑..."
                    value={trackSearch}
                    onChange={(e) => setTrackSearch(e.target.value)}
                    className="w-full bg-[#121212] border border-[#2a2a2a] focus:border-[#1DB954] rounded-full pl-8 pr-3 py-1 text-xs text-gray-200 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTracks.map((track, idx) => (
                  <div key={track.id} className="flex items-center justify-between bg-[#121212] hover:bg-[#1f1f1f] p-3 rounded-xl border border-[#242424] transition group">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        idx === 0 ? 'bg-[#1DB954] text-black' :
                        idx === 1 ? 'bg-emerald-700 text-white' :
                        idx === 2 ? 'bg-teal-800 text-white' : 'text-gray-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <img src={track.album?.images?.?.url || track.album?.images?.[0]?.url} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-gray-800" />
                      <div className="truncate">
                        <p className="font-semibold text-xs text-gray-100 truncate group-hover:text-[#1DB954] transition">{track.name}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artists?.map(a => a.name).join(', ')}</p>
                      </div>
                    </div>
                    
                    <div className="shrink-0 ml-3 font-mono text-right flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-400">
                        {formatDuration(track.duration_ms)}
                      </span>
                      {track.external_urls?.spotify && (
                        <a 
                          href={track.external_urls.spotify} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-[#1DB954] transition"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {filteredTracks.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-500 font-mono">未检索到匹配的单曲</div>
                )}
              </div>
            </div>

            {/* 右栏：歌手榜 */}
            <div className="bg-[#181818] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <Mic size={18} className="text-[#1DB954]" /> 最爱歌手明细
                </h2>
                <div className="relative w-full sm:w-44">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="搜索歌手 / 流派..."
                    value={artistSearch}
                    onChange={(e) => setArtistSearch(e.target.value)}
                    className="w-full bg-[#121212] border border-[#2a2a2a] focus:border-[#1DB954] rounded-full pl-8 pr-3 py-1 text-xs text-gray-200 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredArtists.map((artist, idx) => {
                  const imgUrl = artist.images?.?.url || artist.images?.[0]?.url;
                  return (
                    <div key={artist.id} className="flex items-center justify-between bg-[#121212] hover:bg-[#1f1f1f] p-3 rounded-xl border border-[#242424] transition group">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          idx === 0 ? 'bg-[#1DB954] text-black' :
                          idx === 1 ? 'bg-emerald-700 text-white' :
                          idx === 2 ? 'bg-teal-800 text-white' : 'text-gray-500'
                        }`}>
                          {idx + 1}
                        </span>

                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-700 bg-gray-800" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center text-[#1DB954] font-bold text-xs shrink-0 font-mono">
                            {artist.name ? artist.name.charAt(0) : <Mic size={16} />}
                          </div>
                        )}

                        <div className="truncate">
                          <p className="font-semibold text-xs text-gray-100 truncate group-hover:text-[#1DB954] transition">{artist.name}</p>
                          <span className="inline-block text-[10px] text-gray-400 bg-[#222222] px-2 py-0.5 rounded-full mt-0.5 truncate max-w-[150px]">
                            {artist.genres?.[0] ? artist.genres[0].charAt(0).toUpperCase() + artist.genres[0].slice(1) : '歌手'}
                          </span>
                        </div>
                      </div>

                      {artist.followers?.total !== undefined && (
                        <span className="text-[11px] font-mono text-gray-400 shrink-0">
                          {Number(artist.followers.total).toLocaleString()} 粉丝
                        </span>
                      )}
                    </div>
                  );
                })}

                {filteredArtists.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-500 font-mono">未检索到匹配的歌手</div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* 扩展功能 2: 最近播放足迹 (带真实 played_at 时间戳) */
        <div className="bg-[#181818] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Clock size={18} className="text-[#1DB954]" /> 最近收听足迹 (Recently Played)
            </h2>
            <span className="text-xs text-gray-400 font-mono">真实时间戳记录</span>
          </div>

          <div className="space-y-3">
            {recentlyPlayed.map((item, idx) => {
              const track = item.track;
              if (!track) return null;
              return (
                <div key={`${track.id}-${item.played_at}-${idx}`} className="flex items-center justify-between bg-[#121212] hover:bg-[#1f1f1f] p-3.5 rounded-xl border border-[#242424] transition">
                  <div className="flex items-center space-x-3.5 overflow-hidden">
                    <img 
                      src={track.album?.images?.?.url || track.album?.images?.[0]?.url} 
                      alt="" 
                      className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-800" 
                    />
                    <div className="truncate">
                      <p className="font-semibold text-xs text-gray-100 truncate">{track.name}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {track.artists?.map(a => a.name).join(', ')} · <span className="text-gray-500">{track.album?.name}</span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3 text-right">
                    <p className="text-xs font-mono font-bold text-[#1DB954]">
                      {formatRelativeTime(item.played_at)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                      {formatDuration(track.duration_ms)}
                    </p>
                  </div>
                </div>
              );
            })}

            {recentlyPlayed.length === 0 && (
              <div className="text-center py-12 text-xs text-gray-500 font-mono">
                暂未获取到最近播放记录，请检查是否已在当前设备授权收听。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
     }
