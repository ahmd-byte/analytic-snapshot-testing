import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import XLSX from 'xlsx'
import { chromium } from 'playwright'

const LOCKED_URL = 'https://www.youtube.com/@Callyko17/videos'
const LOCKED_HANDLE = '@Callyko17'
const LOCKED_NAME = 'CallyKo🎀🐾'
const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'data')
const WORKBOOK_PATH = path.join(DATA_DIR, 'youtube-snapshots.xlsx')
const EXPORT_PATH = path.join(DATA_DIR, 'dashboard-data.json')

const dailyHeaders = ['Snapshot date', 'Snapshot date and time', 'Channel name', 'Channel URL', 'Subscriber count', 'Total video count', 'Channel description', 'Latest upload title', 'Latest upload URL', 'Latest upload date', 'Latest upload views', 'Total current views', 'Average views per video', 'Videos added since previous snapshot', 'Run status', 'Failure reason', 'Run completed']
const videoHeaders = ['Snapshot date', 'Snapshot date and time', 'Video title', 'Video URL', 'Publish date', 'Duration', 'Current view count', 'Video position in channel list', 'Newly detected today']
const dashboardHeaders = ['Snapshot date and time', 'Metric', 'Value', 'Note']

const number = (value) => {
  if (typeof value === 'number') return value
  const raw = String(value ?? '').replace(/,/g, '').trim()
  const match = raw.match(/([\d.]+)\s*([KMB])?/i)
  if (!match) return null
  const unit = (match[2] || '').toUpperCase()
  return Math.round(Number(match[1]) * (unit === 'B' ? 1e9 : unit === 'M' ? 1e6 : unit === 'K' ? 1e3 : 1))
}

function localDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function readSheet(workbook, name, headers) {
  const sheet = workbook.Sheets[name]
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : []
}

function writeSheet(workbook, name, rows, headers) {
  workbook.Sheets[name] = XLSX.utils.json_to_sheet(rows, { header: headers })
  if (!workbook.SheetNames.includes(name)) workbook.SheetNames.push(name)
}

function openWorkbook() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  return fs.existsSync(WORKBOOK_PATH) ? XLSX.readFile(WORKBOOK_PATH) : XLSX.utils.book_new()
}

function buildDashboard(daily, videos) {
  const successful = daily.filter((row) => row['Run status'] === 'Completed').sort((a, b) => String(a['Snapshot date and time']).localeCompare(String(b['Snapshot date and time'])))
  const latest = successful.at(-1) || null
  const latestTime = latest?.['Snapshot date and time'] || null
  const currentVideos = latestTime ? videos.filter((row) => row['Snapshot date and time'] === latestTime) : []
  const prior = successful.length > 1 ? successful.at(-2) : null
  const priorVideos = prior ? videos.filter((row) => row['Snapshot date and time'] === prior['Snapshot date and time']) : []
  const priorByUrl = new Map(priorVideos.map((row) => [row['Video URL'], row]))
  const videoRows = currentVideos.map((row) => ({
    title: row['Video title'], url: row['Video URL'], publishDate: row['Publish date'], duration: row.Duration,
    views: Number(row['Current view count']) || 0, position: Number(row['Video position in channel list']) || 0,
    isNew: row['Newly detected today'] === 'Yes', viewChange: priorByUrl.has(row['Video URL']) ? (Number(row['Current view count']) || 0) - (Number(priorByUrl.get(row['Video URL'])['Current view count']) || 0) : null
  })).sort((a, b) => a.position - b.position)
  const totalViews = videoRows.reduce((sum, video) => sum + video.views, 0)
  const metrics = latest ? {
    subscribers: latest['Subscriber count'] === '' ? null : Number(latest['Subscriber count']),
    totalVideos: Number(latest['Total video count']) || videoRows.length,
    totalViews, averageViews: videoRows.length ? Math.round(totalViews / videoRows.length) : null,
    latestVideoViews: latest['Latest upload views'] === '' ? null : Number(latest['Latest upload views']),
    addedVideos: Number(latest['Videos added since previous snapshot']) || 0
  } : null
  return {
    channel: { name: LOCKED_NAME, url: LOCKED_URL, handle: LOCKED_HANDLE, trial: true },
    generatedAt: new Date().toISOString(), latestSnapshot: latestTime,
    latestStatus: daily.at(-1)?.['Run status'] || 'Not run', latestFailure: daily.at(-1)?.['Failure reason'] || null,
    metrics, noChanges: Boolean(latest && prior && metrics.addedVideos === 0 && videoRows.every((video) => video.viewChange === 0)),
    series: successful.map((row) => ({ date: row['Snapshot date'], timestamp: row['Snapshot date and time'], subscribers: row['Subscriber count'] === '' ? null : Number(row['Subscriber count']), totalViews: Number(row['Total current views']) || 0, uploads: Number(row['Videos added since previous snapshot']) || 0 })),
    videos: videoRows
  }
}

function save(workbook, daily, videos) {
  const dashboard = buildDashboard(daily, videos)
  const metricsRows = dashboard.metrics ? Object.entries(dashboard.metrics).map(([Metric, Value]) => ({ 'Snapshot date and time': dashboard.latestSnapshot, Metric, Value: Value ?? '', Note: Value === null ? 'Not publicly visible' : '' })) : []
  writeSheet(workbook, 'Daily Snapshots', daily, dailyHeaders)
  writeSheet(workbook, 'Video Snapshots', videos, videoHeaders)
  writeSheet(workbook, 'Dashboard Data', metricsRows, dashboardHeaders)
  XLSX.writeFile(workbook, WORKBOOK_PATH)
  fs.writeFileSync(EXPORT_PATH, JSON.stringify(dashboard, null, 2))
}

async function readPublicChannel() {
  const browser = await chromium.launch({ headless: true, timeout: 25000 })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    await page.goto(LOCKED_URL, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForSelector('ytd-rich-grid-media, ytd-grid-video-renderer, #channel-header', { timeout: 12000 })
    const data = await page.evaluate(() => {
      const text = (selector, root = document) => root.querySelector(selector)?.textContent?.trim() || ''
      const cards = [...document.querySelectorAll('ytd-rich-grid-media, ytd-grid-video-renderer')]
      const videos = cards.map((card, index) => {
        const titleEl = card.querySelector('#video-title-link, a#video-title')
        const meta = [...card.querySelectorAll('#metadata-line span, #metadata-line yt-formatted-string')].map((item) => item.textContent.trim()).filter(Boolean)
        const details = card.querySelector('#details')?.textContent || ''
        const duration = text('ytd-thumbnail-overlay-time-status-renderer span', card)
        return { title: titleEl?.textContent?.trim() || '', url: titleEl?.href || '', publishDate: meta.find((item) => /ago$|streamed|premiered|\d{4}/i.test(item)) || '', viewsText: meta.find((item) => /views?/i.test(item)) || (details.match(/[\d,.]+[KMB]?\s+views?/i)?.[0] || ''), duration, position: index + 1 }
      }).filter((video) => video.title && video.url)
      return { name: text('#channel-name #text, #channel-name'), handle: text('#channel-handle'), subscribersText: text('#subscriber-count'), description: text('#description-container, #description'), videos }
    })
    if (data.handle.toLowerCase() !== '@callyko17' && !page.url().toLowerCase().includes('@callyko17')) throw new Error('Locked channel verification failed; the loaded page was not @Callyko17.')
    if (!data.videos.length) throw new Error('No public videos were readable from the locked channel page.')
    return data
  } finally { await browser.close() }
}

const workbook = openWorkbook()
const daily = readSheet(workbook, 'Daily Snapshots', dailyHeaders)
const videos = readSheet(workbook, 'Video Snapshots', videoHeaders)
const today = localDay()
if (daily.some((row) => row['Snapshot date'] === today)) {
  save(workbook, daily, videos)
  console.log(`Snapshot already exists for ${today}; no duplicate created.`)
  process.exit(0)
}

const timestamp = new Date().toISOString()
try {
  const captured = await readPublicChannel()
  const previous = daily.filter((row) => row['Run status'] === 'Completed').sort((a, b) => String(a['Snapshot date and time']).localeCompare(String(b['Snapshot date and time']))).at(-1)
  const previousUrls = new Set(previous ? videos.filter((row) => row['Snapshot date and time'] === previous['Snapshot date and time']).map((row) => row['Video URL']) : [])
  const capturedVideos = captured.videos.map((video) => ({
    'Snapshot date': today, 'Snapshot date and time': timestamp, 'Video title': video.title, 'Video URL': video.url,
    'Publish date': video.publishDate || '', Duration: video.duration || '', 'Current view count': number(video.viewsText) ?? '',
    'Video position in channel list': video.position, 'Newly detected today': previousUrls.has(video.url) ? 'No' : 'Yes'
  }))
  const latest = capturedVideos[0]
  const totalViews = capturedVideos.reduce((sum, video) => sum + (Number(video['Current view count']) || 0), 0)
  const added = capturedVideos.filter((video) => video['Newly detected today'] === 'Yes').length
  daily.push({ 'Snapshot date': today, 'Snapshot date and time': timestamp, 'Channel name': captured.name || LOCKED_NAME, 'Channel URL': LOCKED_URL, 'Subscriber count': number(captured.subscribersText) ?? '', 'Total video count': capturedVideos.length, 'Channel description': captured.description || '', 'Latest upload title': latest['Video title'], 'Latest upload URL': latest['Video URL'], 'Latest upload date': latest['Publish date'], 'Latest upload views': latest['Current view count'], 'Total current views': totalViews, 'Average views per video': capturedVideos.length ? Math.round(totalViews / capturedVideos.length) : '', 'Videos added since previous snapshot': previous ? added : 0, 'Run status': 'Completed', 'Failure reason': '', 'Run completed': 'Yes' })
  videos.push(...capturedVideos)
  save(workbook, daily, videos)
  console.log(`Saved ${capturedVideos.length} public video records for ${today}.`)
} catch (error) {
  daily.push({ 'Snapshot date': today, 'Snapshot date and time': timestamp, 'Channel name': LOCKED_NAME, 'Channel URL': LOCKED_URL, 'Subscriber count': '', 'Total video count': '', 'Channel description': '', 'Latest upload title': '', 'Latest upload URL': '', 'Latest upload date': '', 'Latest upload views': '', 'Total current views': '', 'Average views per video': '', 'Videos added since previous snapshot': '', 'Run status': 'Failed', 'Failure reason': error instanceof Error ? error.message : String(error), 'Run completed': 'No' })
  save(workbook, daily, videos)
  console.error(`Snapshot failed and was logged: ${error instanceof Error ? error.message : String(error)}`)
}
