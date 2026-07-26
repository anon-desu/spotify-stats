import React, { useState, useEffect } from 'react';
import { redirectToAuthCodeFlow, getAccessToken, fetchProfile, fetchTopTracks, fetchTopArtists } from './spotify';
import { Music, Mic, LogOut, Info, Sparkles, PieChart as PieIcon, Flame, Disc } from 'lucide-react';

// 环形饼图组件 (Pure SVG, 响应式)
function DonutChart({ data, title, centerText }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) return null;

  let currentAngle = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-[#181818]/90 backdrop-blur-md border border-gray-800/80 p-5 rounded-2xl flex flex-col items-center shadow-lg w-full">
      <h3 className="text-sm font-bold text-gray-200 mb-2 w-full text-left flex items-center gap-2 truncate">
        <PieIcon size={16} className="text-green-400 shrink-0" />
        <span className="truncate">{title}</span>
      </h3>
      
      <div className="relative w-44 h-44 flex items-center justify-center my-3">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          {data.map((item, idx) => {
            const pct = item.value / total;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -currentAngle;
            currentAngle += pct * circumference;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth="11"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center px-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">统计范围</span>
          <span className="text-xs font-extrabold text-white mt-0.5">{centerText}</span>
        </div>
      </div>

      {/* 图例与百分比清单 */}
      <div className="w-full space-y-2 mt-2 pt-3 border-t border-gray-800">
        {data.map((item, idx) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 truncate max-w-[170px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-gray-300 truncate">{item.label}</span>
              </div>
              <span className="font-bold text-green-400 ml-2">{pct}%</span>
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

  const COLOR_PALETTE = ['#1DB954', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#10b981', '#f43f5e', '#8b5cf6', '#eab308'];

  // --- 数据计算 1：常听歌手占比（累加至 95% 门槛，真正将剩余压至 5%） ---
  const artistCounts = {};
  topTracks.forEach(track => {
    track.artists.forEach(a => {
      artistCounts[a.name] = (artistCounts[a.name] || 0) + 1;
    });
  });

  const totalArtistCredits = Object.values(artistCounts).reduce((a, b) => a + b, 0) || 1;
  const sortedArtistEntries = Object.entries(artistCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  let cumulativePct = 0;
  const top95Artists = [];
  let othersArtistCount = 0;

  sortedArtistEntries.forEach((item) => {
    const pct = item.count / totalArtistCredits;
    // 不限制个数，一直收集歌手直到累计达到 95% 占比
    if (cumulativePct < 0.95) {
      top95Artists.push(item);
      cumulativePct += pct;
    } else {
      othersArtistCount += item.count;
    }
  });

  const artistPieData = [
    ...top95Artists.map((a, idx) => ({
      label: a.name,
      value: a.count,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length]
    })),
    ...(othersArtistCount > 0 ? [{ label: '其他歌手 (尾部剩余部分)', value: othersArtistCount, color: '#4b5563' }] : [])
  ];

  // --- 数据计算 2：最喜爱的歌曲权值占比饼图 ---
  const top5Songs = topTracks.slice(0, 5);
  const songWeights = [30, 24, 18, 14, 10]; // Top 5 单曲相对权重
  const top5SongData = top5Songs.map((track, idx) => ({
    label: track.name,
    value: songWeights[idx] || 10,
    color: COLOR_PALETTE[idx % COLOR_PALETTE.length]
  }));
  const remainingSongsWeight = Math.max(topTracks.length - 5, 0) * 2;

  const songPieData = [
    ...top5SongData,
    ...(remainingSongsWeight > 0 ? [{ label: '其他 Top 6-50 歌曲', value: remainingSongsWeight, color: '#4b5563' }] : [])
  ];

  // --- 数据计算 3：音乐风格偏好饼图 ---
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

  const topGenres = sortedGenres.slice(0, 5);
  const otherGenresCount = sortedGenres.slice(5).reduce((acc, cur) => acc + cur.value, 0);

  const genrePieData = [
    ...topGenres.map((g, idx) => ({
      label: g.label,
      value: g.value,
      color: COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length]
    })),
    ...(otherGenresCount > 0 ? [{ label: '其他音乐风格', value: otherGenresCount, color: '#4b5563' }] : [])
  ];

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
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 max-w-5xl mx-auto pb-16">
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

      {/* 音乐品味概览卡片 (删除了平均时长，保留样本量与曲风) */}
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
            <p className="text-sm font-bold text-green-400 mt-1 truncate">{topGenres[0]?.label || 'J-Pop'}</p>
          </div>
        </div>
      </div>

      {/* 3 个百分比饼图区域 (最喜爱歌曲、常听歌手、曲风偏好) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DonutChart data={songPieData} title="最喜爱歌曲权值占比" centerText={`Top ${topTracks.length} 歌曲`} />
        <DonutChart data={artistPieData} title="常听歌手占比 (前95%区间)" centerText={`共 ${Object.keys(artistCounts).length} 位歌手`} />
        <DonutChart data={genrePieData} title="最喜欢的音乐风格分布" centerText={`共 ${Object.keys(genreCounts).length} 种风格`} />
      </div>

      {/* 官方限制说明提示 */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 mb-8 flex items-start space-x-3 text-xs text-gray-400">
        <Info size={16} className="text-green-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-gray-200">播放次数与得分说明：</strong>Spotify 官方 API 出于数据隐私保护，不提供绝对播放次数（如“听了150遍”）。列表右侧为由 Spotify 官方算法计算的 <span className="text-orange-400 font-bold">🔥 热度与偏好得分 (0-100)</span>。
        </p>
      </div>

      {/* Top 榜单 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                
                {/* 推荐/热度得分：修复挤压，明确展示 "🔥 85 分" */}
                <div className="flex flex-col items-end shrink-0 ml-3">
                  <span className="flex items-center text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md">
                    <Flame size={12} className="mr-1 text-orange-500 fill-orange-500 shrink-0" />
                    <span>{track.popularity} 分</span>
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1 font-mono">
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
