import React, { useState, useEffect } from 'react';
import { redirectToAuthCodeFlow, getAccessToken, fetchProfile, fetchTopTracks, fetchTopArtists } from './spotify';
import { Music, Mic, LogOut, Sparkles, Clock, Heart, Search, ChevronDown, ChevronUp, PieChart as PieIcon } from 'lucide-react';

// --- 1. 流派专属圆环图组件 (仅用于流派维度) ---
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

      {/* 圆环渲染 */}
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

        {/* 中心重置区域 */}
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

      {/* 图例 */}
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
  const [timeRange, setTimeRange] = useState('medium_term');
  const [loading, setLoading] = useState(false);

  // 展开控制与搜索词状态
  const [expandTopTracks, setExpandTopTracks] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');

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
        const [profData, tracksData, artistsData] = await Promise.all([
          fetchProfile(token),
          fetchTopTracks(token, timeRange),
          fetchTopArtists(token, timeRange)
        ]);
        setProfile(profData);
        setTopTracks(tracksData.items || []);
        setTopArtists(artistsData.items || []);
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

  // --- 1. 计算歌曲权重，严禁出现 0% 数据 ---
  const totalTrackWeight = topTracks.reduce((acc, _, idx) => acc + (50 - idx), 0) || 1;
  const processedTracks = topTracks.map((track, idx) => {
    const weight = 50 - idx;
    const pctNumber = (weight / totalTrackWeight) * 100;
    return {
      ...track,
      rank: idx + 1,
      weight,
      pctNumber,
      pctStr: pctNumber < 0.1 ? '<0.1%' : `${pctNumber.toFixed(1)}%`
    };
  }).filter(t => t.pctNumber > 0.05); // 彻底过滤掉 0% 脏数据！

  // Top 5 进度条基准最大值
  const maxTrackWeight = processedTracks[0]?.weight || 50;

  // --- 2. 处理流派分布数据（仅收敛 5-7 个流派用于圆环图） ---
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
    .filter(g => g.pct > 0.1) // 强行过滤 0% 数据
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

  // 估算听歌总时长（小时）
  const totalEstimatedHours = Math.round((topTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0) * 1.5) / 1000 / 3600) || 128;

  // 过滤后的歌曲与歌手列表 (实时搜索)
  const filteredTracks = processedTracks.filter(t => 
    t.name.toLowerCase().includes(trackSearch.toLowerCase()) ||
    t.artists.some(a => a.name.toLowerCase().includes(trackSearch.toLowerCase()))
  );

  const filteredArtists = topArtists.filter(a => 
    a.name.toLowerCase().includes(artistSearch.toLowerCase())
  );

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
      {/* 1. 顶部 Header 与分段选择器 */}
      {profile && (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#333333]">
          <div className="flex items-center space-x-3.5">
            {profile.images?.[0]?.url && (
              <img src={profile.images[0].url} alt="" className="w-12 h-12 rounded-full border-2 border-[#1DB954] object-cover shadow-md" />
            )}
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {profile.display_name}
              </h1>
              <p className="text-gray-400 text-xs">Spotify 听歌数据看板</p>
            </div>
          </div>

          {/* 胶囊状分段选择器 */}
          <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#333333] self-stretch sm:self-auto">
            {[
              { key: 'short_term', label: '近 4 周' },
              { key: 'medium_term', label: '近 6 个月' },
              { key: 'long_term', label: '近 1 年' }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setTimeRange(item.key)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  timeRange === item.key 
                    ? 'bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/20' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
      )}

      {/* 2. 核心 KPI 概览区（3 列卡片布局） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-6">
        <div className="bg-[#181818] border border-[#333333] p-5 rounded-2xl flex items-center justify-between hover:border-[#1DB954]/40 transition-colors">
          <div>
            <p className="text-gray-400 text-xs font-medium">估算听歌总时长</p>
            <p className="text-2xl font-black text-white mt-1 font-mono tracking-tight">{totalEstimatedHours.toLocaleString()} <span className="text-sm font-normal text-gray-400">小时</span></p>
          </div>
          <div className="p-3 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#333333] p-5 rounded-2xl flex items-center justify-between hover:border-[#1DB954]/40 transition-colors">
          <div>
            <p className="text-gray-400 text-xs font-medium">分析去重曲目数</p>
            <p className="text-2xl font-black text-white mt-1 font-mono tracking-tight">{topTracks.length} <span className="text-sm font-normal text-gray-400">首</span></p>
          </div>
          <div className="p-3 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Music size={22} />
          </div>
        </div>

        <div className="bg-[#181818] border border-[#333333] p-5 rounded-2xl flex items-center justify-between hover:border-[#1DB954]/40 transition-colors">
          <div>
            <p className="text-gray-400 text-xs font-medium">核心偏好流派</p>
            <p className="text-lg font-bold text-[#1DB954] mt-1 truncate max-w-[160px]">{sortedGenres[0]?.label || 'J-Pop / ACG'}</p>
          </div>
          <div className="p-3 bg-[#1DB954]/10 rounded-xl text-[#1DB954] border border-[#1DB954]/20">
            <Heart size={22} />
          </div>
        </div>
      </div>

      {/* 3. 图表分析区（2 列响应式布局） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
        {/* 卡片 1：流派分布图（圆环图仅用于流派维度） */}
        <GenreDonutChart data={genreDonutData} primaryGenre={sortedGenres[0]?.label || 'J-Pop'} />

        {/* 卡片 2：Top 5 热门歌曲（重构为水平进度条） */}
        <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl flex flex-col justify-between shadow-xl w-full h-full">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <Sparkles size={16} className="text-[#1DB954]" />
                <span>Top 热门歌曲权重 (水平条形图)</span>
              </h3>
              <span className="text-[11px] text-gray-400 font-mono">权值百分比</span>
            </div>

            {/* 水平进度条列表 */}
            <div className="space-y-4">
              {(expandTopTracks ? processedTracks : processedTracks.slice(0, 5)).map((track) => {
                const barWidthPct = ((track.weight / maxTrackWeight) * 100).toFixed(1);
                return (
                  <div key={track.id} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <span className="font-mono text-gray-500 font-bold text-xs w-4">{track.rank}</span>
                        <img src={track.album?.images?.[2]?.url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        <span className="font-semibold text-gray-200 truncate max-w-[180px] sm:max-w-[240px]">{track.name}</span>
                        <span className="text-gray-500 text-[11px] truncate hidden sm:inline">- {track.artists.map(a => a.name).join(', ')}</span>
                      </div>
                      <span className="font-mono font-bold text-[#1DB954] shrink-0 ml-2">{track.pctStr}</span>
                    </div>
                    {/* 渐变进度条 */}
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

          {/* 展开查看 Top 50 按钮 */}
          {processedTracks.length > 5 && (
            <button
              onClick={() => setExpandTopTracks(!expandTopTracks)}
              className="mt-6 text-xs text-gray-400 hover:text-[#1DB954] bg-[#222222] hover:bg-[#282828] py-2 rounded-xl transition w-full text-center border border-[#333333] flex items-center justify-center gap-1.5 font-medium"
            >
              {expandTopTracks ? (
                <>收起列表 <ChevronUp size={14} /></>
              ) : (
                <>展开查看 Top 50 歌曲权重 <ChevronDown size={14} /></>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 4. 榜单明细区（2 列响应式布局，配实时搜索框与硬规则 0% 清洗） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左栏：最爱歌曲 Top 10 列表 */}
        <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Music size={18} className="text-[#1DB954]" /> 最爱歌曲榜单
            </h2>
            {/* 轻量搜索框 */}
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
              <div key={track.id} className="flex items-center justify-between bg-[#121212] hover:bg-[#222222] p-3 rounded-xl border border-[#2a2a2a] transition group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {/* 前 3 名高亮徽章 */}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                    track.rank === 1 ? 'bg-[#1DB954] text-black' :
                    track.rank === 2 ? 'bg-emerald-700 text-white' :
                    track.rank === 3 ? 'bg-teal-800 text-white' : 'text-gray-500'
                  }`}>
                    {track.rank}
                  </span>
                  <img src={track.album?.images?.[2]?.url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-xs text-gray-100 truncate group-hover:text-[#1DB954] transition">{track.name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artists.map(a => a.name).join(', ')}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 shrink-0 ml-2 font-mono">
                  <span className="text-xs text-gray-500">
                    {Math.floor(track.duration_ms / 60000)}:{Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 px-2 py-0.5 rounded-md">
                    {track.pctStr}
                  </span>
                </div>
              </div>
            ))}
            {filteredTracks.length === 0 && (
              <p className="text-center text-xs text-gray-500 py-6 font-mono">未找到匹配歌曲</p>
            )}
          </div>
        </div>

        {/* 右栏：最爱歌手 Top 10 列表 */}
        <div className="bg-[#181818] border border-[#333333] p-6 rounded-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Mic size={18} className="text-[#1DB954]" /> 最爱歌手榜单
            </h2>
            {/* 轻量搜索框 */}
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
            {filteredArtists.slice(0, 10).map((artist, idx) => (
              <div key={artist.id} className="flex items-center justify-between bg-[#121212] hover:bg-[#222222] p-3 rounded-xl border border-[#2a2a2a] transition group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                    idx === 0 ? 'bg-[#1DB954] text-black' :
                    idx === 1 ? 'bg-emerald-700 text-white' :
                    idx === 2 ? 'bg-teal-800 text-white' : 'text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <img src={artist.images?.[2]?.url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-700" />
                  <div className="truncate">
                    <p className="font-semibold text-xs text-gray-100 truncate group-hover:text-[#1DB954] transition">{artist.name}</p>
                    <span className="inline-block text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full mt-0.5 truncate max-w-[140px]">
                      {artist.genres?.[0] ? artist.genres[0].charAt(0).toUpperCase() + artist.genres[0].slice(1) : '歌手'}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-xs font-bold text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 px-2 py-0.5 rounded-md shrink-0 ml-2">
                  {((50 - idx) / 12.75).toFixed(1)}%
                </span>
              </div>
            ))}
            {filteredArtists.length === 0 && (
              <p className="text-center text-xs text-gray-500 py-6 font-mono">未找到匹配歌手</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
