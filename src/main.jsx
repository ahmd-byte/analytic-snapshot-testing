import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const CHANNEL_URL = 'https://www.youtube.com/@Callyko17/videos'
const empty = { channel: { name: 'CallyKo🎀🐾', url: CHANNEL_URL, handle: '@Callyko17', trial: true }, latestSnapshot: null, latestStatus: 'Not run', metrics: null, series: [], videos: [] }
const format = (value) => value === null || value === undefined || value === '' ? 'Not public' : new Intl.NumberFormat('en-US').format(value)
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value)) : 'No saved snapshot yet'

function LineChart({ title, data, dataKey, emptyText, color = '#9b87f5' }) {
  const values = data.map((item) => item[dataKey]).filter((item) => typeof item === 'number')
  if (!values.length) return <section className="chart card"><div className="chart-head"><h2>{title}</h2></div><div className="empty-chart">{emptyText}</div></section>
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1
  const points = data.filter((item) => typeof item[dataKey] === 'number').map((item, i, list) => `${12 + (i * 276) / Math.max(list.length - 1, 1)},${92 - ((item[dataKey] - min) / range) * 66}`).join(' ')
  return <section className="chart card"><div className="chart-head"><h2>{title}</h2><span>{format(values.at(-1))}</span></div><svg viewBox="0 0 300 110" role="img" aria-label={title}><path className="grid" d="M12 25H288M12 58H288M12 92H288"/><polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.split(' ').map((point) => { const [cx, cy] = point.split(','); return <circle key={point} cx={cx} cy={cy} r="3" fill={color} /> })}</svg><div className="axis"><span>{data[0]?.date}</span><span>{data.at(-1)?.date}</span></div></section>
}

function BarChart({ data }) {
  if (!data.length) return <section className="chart card"><div className="chart-head"><h2>Views by video</h2></div><div className="empty-chart">Video data will appear after the first completed public snapshot.</div></section>
  const max = Math.max(...data.map((video) => video.views), 1)
  return <section className="chart card"><div className="chart-head"><h2>Views by video</h2><span>Saved snapshot</span></div><div className="bars">{data.slice(0, 6).map((video) => <div className="bar-row" key={video.url}><span title={video.title}>{video.title}</span><div className="bar-track"><i style={{ width: `${(video.views / max) * 100}%` }} /></div><b>{format(video.views)}</b></div>)}</div></section>
}

function App() {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/data/dashboard-data.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : empty).catch(() => empty).then((payload) => { setData(payload); setLoading(false) }) }, [])
  const m = data.metrics
  const cards = [
    ['Subscribers', m?.subscribers, 'Public channel count'], ['Total videos', m?.totalVideos, data.channel.trial ? 'Trial channel · under 5 videos' : 'Saved snapshot'],
    ['Total current views', m?.totalViews, 'Across saved videos'], ['Avg. views / video', m?.averageViews, 'Based on current snapshot'],
    ['Latest video views', m?.latestVideoViews, 'Most recent upload'], ['Videos added', m?.addedVideos, 'Since prior snapshot']
  ]
  return <main><aside><div className="brand"><span>◒</span> snapshot</div><nav><a className="active">Overview</a><a>Daily history</a><a>Video library</a></nav><div className="side-note"><strong>Offline-ready</strong><br/>This view uses only locally saved spreadsheet exports.</div></aside><div className="page"><header><div><p className="eyebrow">YOUTUBE CHANNEL SNAPSHOT</p><h1>{data.channel.name}</h1><a className="channel-link" href={CHANNEL_URL} target="_blank">{data.channel.handle} ↗</a></div><div className="snapshot"><span>Latest saved snapshot</span><strong>{dateTime(data.latestSnapshot)}</strong><small className={data.latestStatus === 'Failed' ? 'failed' : ''}>{loading ? 'Loading saved data…' : data.latestStatus}</small></div></header>
  <section className="notice"><span>✦</span><div><strong>Trial channel</strong><p>This locked channel has fewer than five videos. Metrics remain snapshot-based and never use guessed values.</p></div></section>
  {data.latestStatus === 'Failed' && <section className="failure"><strong>Today’s collection could not read public YouTube data.</strong> {data.latestFailure || 'The failure was logged; older snapshots remain available.'}</section>}
  {data.noChanges && <section className="no-change">No changes since previous snapshot.</section>}
  <section className="kpis">{cards.map(([label, value, caption]) => <article className="kpi card" key={label}><span>{label}</span><strong>{format(value)}</strong><small>{caption}</small></article>)}</section>
  <section className="charts"><LineChart title="Subscriber growth" data={data.series} dataKey="subscribers" emptyText="Subscriber count is not publicly visible in saved snapshots."/><LineChart title="Total views over time" data={data.series} dataKey="totalViews" emptyText="Complete a public snapshot to begin tracking total views." color="#62d8c1"/><BarChart data={data.videos}/><LineChart title="Upload activity" data={data.series} dataKey="uploads" emptyText="Upload activity is calculated after the first completed snapshot." color="#ffb86c"/></section>
  <section className="table-section card"><div className="table-head"><div><p className="eyebrow">LATEST SAVED DATA</p><h2>Video analytics</h2></div><span>{data.videos.length} videos</span></div>{data.videos.length ? <div className="table-wrap"><table><thead><tr><th>Title</th><th>Publish date</th><th>Duration</th><th>Current views</th><th>Change</th><th>Status</th></tr></thead><tbody>{data.videos.map((video) => <tr key={video.url}><td><a href={video.url} target="_blank">{video.title}</a></td><td>{video.publishDate || 'Not public'}</td><td>{video.duration || 'Not public'}</td><td>{format(video.views)}</td><td className={video.viewChange > 0 ? 'positive' : ''}>{video.viewChange === null ? '—' : `${video.viewChange > 0 ? '+' : ''}${format(video.viewChange)}`}</td><td>{video.isNew ? <em>New today</em> : 'Tracked'}</td></tr>)}</tbody></table></div> : <div className="table-empty">No video records are saved yet. Run the daily browser snapshot when public channel data is reachable.</div>}</section>
  <footer>Locked source: <a href={CHANNEL_URL} target="_blank">{CHANNEL_URL}</a> · Stored spreadsheet data only · No YouTube Data API</footer></div></main>
}

createRoot(document.querySelector('#root')).render(<App />)
