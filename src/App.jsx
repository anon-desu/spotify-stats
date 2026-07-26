import React, { useState, useEffect } from 'react';
import { redirectToAuthCodeFlow, getAccessToken, fetchProfile, fetchTopTracks, fetchTopArtists } from './spotify';
import { Music, Mic, LogOut, Sparkles, PieChart as PieIcon, ChevronDown, ChevronUp } from 'lucide-react';

// 大厂极简美学配色方案（5 个高对比核心色 + 1 个深灰“其他”色）
const ELEGANT_COLORS = [
  '#1DB954', // Spotify 标志绿
  '#3B82F6', // 极简蓝
  '#8B5CF6', // 优雅紫
  '#EC4899', // 时尚粉
  '#F59E0B', // 暖色黄
  '#374151'  // 高级深灰 (用于“其他”尾部)
];

// 大厂风极简环形饼图组件 (支持扇区悬浮高亮、中心点击重置、图例展开)
function DonutChart({ data, title, centerText }) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return null;

  let currentAngle = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // 图例列表：默认展开前 5 项，点击“展开”可查看全部
  const visibleLegendItems = expanded ? data : data.slice(0, 5);
  const hiddenCount = data.length - 5;

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="bg-[#181818]/90 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl flex flex-col items-center shadow-xl w-full transition-all">
      <h3 className="text-sm font-bold text-gray-200 mb-2 w-full text-left flex items-center gap-2 truncate">
        <PieIcon size={16} className="text-green-400 shrink-0" />
        <span className="truncate">{title}</span>
      </h3>
      
      {/* 饼图核心区域 */}
      <div className="relative w-48 h-48 flex items-center justify-center my-3">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 overflow-visible">
          {/* 灰色背景底轨 */}
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#262626" strokeWidth="10" />
          
          {data.map((item, idx) => {
            const pct = item.value / total;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -currentAngle;
            currentAngle += pct * circumference;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
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

        {/* 中心点击区域：点击中心可取消高亮 */}
        <div 
          onClick={() => setHoveredIdx(null)}
          className="absolute inset-8 rounded-full flex flex-col items-center justify-center text-center px-2 cursor-pointer selection:bg-transparent"
        >
          {activeItem ? (
            <>
              <span className="text-[11px] text-green-400 font-bold truncate max-w-[110px]">{activeItem.label}</span>
              <span className="text-xl font-extrabold text-white mt-0.5">
                {Math.round((activeItem.value / total) * 100)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">统计范围</span>
              <span className="text-xs font-extrabold text-white mt-0.5">{centerText}</span>
            </>
          )}
        </div>
      </div>

      {/* 图例列表 */}
      <div className="w-full space-y-1.5 mt-2 pt-3 border-t border-gray-800/80">
        {visibleLegendItems.map((item) => {
          const actualIdx = data.findIndex(d => d.label === item.label);
          const pct = Math.round((item.value / total) * 100);
          const isHovered = hoveredIdx === actualIdx;

          return (
            <div 
              key={item.label}
              onMouseEnter={() => setHoveredIdx(actualIdx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(hoveredIdx === actualIdx ? null : actualIdx)}
              className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition cursor-pointer ${
                isHovered ? 'bg-gray-800/90 font-bold text-white' : 'hover:bg-gray-800/40 text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2 truncate max-w-[200px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </div>
              <span className="font-bold text-green-400 ml-2">{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* 展开 / 收起 按钮 */}
      {data.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-gray-400 hover:text-green-400 bg-gray-800/50 hover:bg-gray-800 px-3 py-1.5 rounded-full transition w-full text-center border border-gray-700/50 flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>收起列表 <ChevronUp size={14} /></>
          ) : (
            <>展开全部 (余 {hiddenCount} 项) <ChevronDown size={14} /></>
          )}
        </button>
      )}
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

  // 1. 歌手数据构建（大厂风：Top 5 核心歌手 + 1 个深灰“其他歌手”扇区）
  const artistCounts = {};
  topTracks.forEach(track => {
    track.artists.forEach(a => {
      artistCounts[a.name] = (artistCounts[a.name] || 0) + 1;
    });
  });

  const sortedArtists = Object.entries(artistCounts)
    .map(([name, count]) => ({ label: name, value: count }))
    .sort((a, b) => b.value - a.value);

  const top5Artists = sortedArtists.slice(0, 5);
  const otherArtistsCount = sortedArtists.slice(5).reduce((acc, cur) => acc + cur.value, 0);

  const artistPieData = [
    ...top5Artists.map((a, idx) => ({
      label: a.label,
      value: a.value,
      color: ELEGANT_COLORS[idx]
    })),
    ...(otherArtistsCount > 0 ? [{
      label: `其他歌手 (余${sortedArtists.length - 5}位)`,
      value: otherArtistsCount,
      color: ELEGANT_COLORS[5]
    }] : []),
    ...sortedArtists.slice(5).map((a) => ({
      label: a.label,
      value: a.value,
      color: ELEGANT_COLORS[5]
    }))
  ].filter((item, index, self) => index === self.findIndex((t) => t.label === item.label));

  // 2. 歌曲数据构建（大厂风：Top 5 核心单曲 + 1 个深灰“其他歌曲”扇区）
  const sortedSongs = topTracks.map((track, idx) => ({
    label: track.name,
    value: Math.max(50 - idx, 1)
  }));

  const top5Songs = sortedSongs.slice(0, 5);
  const otherSongsWeight = sortedSongs.slice(5).reduce((acc, cur) => acc + cur.value, 0);

  const songPieData = [
    ...top5Songs.map((s, idx) => ({
      label: s.label,
      value: s.value,
      color: ELEGANT_COLORS[idx]
    })),
    ...(otherSongsWeight > 0 ? [{
      label: `其他 Top 6-50 歌曲`,
      value: otherSongsWeight,
      color: ELEGANT_COLORS[5]
    }] : []),
    ...sortedSongs.slice(5).map((s) => ({
      label: s.label,
      value: s.value,
      color: ELEGANT_COLORS[5]
    }))
  ].filter((item, index, self) => index === self.findIndex((t) => t.label === item.label));

  // 3. 曲风分布数据
  const genreCounts = {};
  topArtists.forEach(artist => {
    artist.genres?.forEach(g => {
      const formatted = g.charAt(0).toUpperCase() + g.slice(1);
      genreCounts[formatted] = (genreCounts[formatted] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-6 text-center">
        <div className="bg-green-500 p-4 rounded-full mb-6 text-black shadow-lg shadow-green-500/20">
          <Music size={48} />
        </div>
        <h1 className="text-3xl font-extrabold mb-2">My Spotify Stats</h1>
        <p className="text-gray-400 mb-8 max-w-xs text-sm">
          探索你的听歌偏好、热门歌曲与曲风分布图表。
        </p>
        <button
          onClick={redirectToAuthCodeFlow}
          className="bg-green-500 hover:bg-green-400 text-black font-bold py-3.5 px-8 rounded-full transition transform active:scale-95 shadow-md"
        >
          使用 Spotify 登录
        </button>
      </div>
    );
  }

  if (loading && !profile) return <div className="flex h-screen items-center justify-center text-green-500 font-bold">加载音乐分析中...</div>;

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 max-w-6xl mx-auto pb-16">
      {/* 头部个人信息 */}
      {profile && (
        <div className="flex items-center justify-between border-b border-gray-800 pb-5 mb-6">
          <div className="flex items-center space-x-3">
            {profile.images?.[0]?.url && (
              <img src={profile.images[0].url} alt="" className="w-12 h-12 rounded-full border-2 border-green-500/80 object-cover" />
            )}
            <div>
              <h1 className="text-xl font-bold flex items-center gap-1.5">
                {profile.display_name}
              </h1>
              <p className="text-gray-400 text-xs">Spotify 听歌偏好仪表盘</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2.5 bg-gray-800/80 hover:bg-gray-700 rounded-full text-gray-300 transition">
            <LogOut size={18} />
          </button>
        </div>
      )}

      {/* 时间切片选择 */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: 'short_term', label: '近 4 周' },
          { key: 'medium_term', label: '近 6 个月' },
          { key: 'long_term', label: '所有时间' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTimeRange(item.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              timeRange === item.key ? 'bg-green-500 text-black shadow-md shadow-green-500/20' : 'bg-gray-800/80 text-gray-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 音乐品味概览卡片 */}
      <div className="bg-gradient-to-r from-green-950/50 via-gray-900 to-gray-900 border border-green-500/30 rounded-2xl p-5 mb-8 shadow-xl">
        <div className="flex items-center space-x-2 text-green-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles size={16} />
          <span>音乐品味概览</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-left">
          <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
            <p className="text-gray-400 text-[11px]">最爱歌曲样本</p>
            <p className="text-lg font-extrabold text-white mt-1">{topTracks.length} <span className="text-xs font-normal text-gray-400">首</span></p>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
            <p className="text-gray-400 text-[11px]">覆盖歌手总数</p>
            <p className="text-lg font-extrabold text-white mt-1">{Object.keys(artistCounts).length} <span className="text-xs font-normal text-gray-400">位</span></p>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
            <p className="text-gray-400 text-[11px]">第一偏好曲风</p>
            <p className="text-sm font-bold text-green-400 mt-1 truncate">{sortedGenres[0]?.label || 'J-Pop'}</p>
          </div>
        </div>
      </div>

      {/* 2 个大厂风极简饼图 (完美平分电脑端两列网格，消除右侧空白) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
        <DonutChart data={songPieData} title="最喜爱歌曲权值占比" centerText={`Top ${topTracks.length} 歌曲`} />
        <DonutChart data={artistPieData} title="常听歌手占比" centerText={`共 ${Object.keys(artistCounts).length} 位歌手`} />
      </div>

      {/* Top 榜单列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 歌曲列表 */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-400">
            <Music size={18} /> 最爱歌曲 Top 10
          </h2>
          <div className="space-y-2.5">
            {topTracks.slice(0, 10).map((track, idx) => (
              <div key={track.id} className="flex items-center justify-between bg-[#181818] hover:bg-[#222] p-3 rounded-xl border border-gray-800/60 transition">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className="w-5 text-center text-gray-500 font-extrabold text-xs">{idx + 1}</span>
                  <img src={track.album?.images?.[2]?.url} alt="" className="w-11 h-11 rounded-md object-cover shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-xs text-white truncate">{track.name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artists.map(a => a.name).join(', ')}</p>
                  </div>
                </div>
                
                <div className="shrink-0 ml-3 text-right">
                  <span className="text-xs text-gray-400 font-mono">
                    {Math.floor(track.duration_ms / 60000)}:{Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 歌手列表 */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-400">
            <Mic size={18} /> 最爱歌手 Top 10
          </h2>
          <div className="space-y-2.5">
            {topArtists.slice(0, 10).map((artist, idx) => (
              <div key={artist.id} className="flex items-center space-x-3 bg-[#181818] hover:bg-[#222] p-3 rounded-xl border border-gray-800/60 transition">
                <span className="w-5 text-center text-gray-500 font-extrabold text-xs">{idx + 1}</span>
                <img src={artist.images?.[2]?.url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 border border-gray-700" />
                <div className="truncate">
                  <p className="font-semibold text-xs text-white truncate">{artist.name}</p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{artist.genres?.slice(0, 2).join(' / ') || '歌手'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
