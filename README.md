# CallyKo🎀🐾 — YouTube Channel Snapshot Dashboard

## What this is

This is a local analytics dashboard for the locked YouTube channel [CallyKo🎀🐾 (@Callyko17)](https://www.youtube.com/@Callyko17/videos).

It records a **daily browser-based snapshot** of only the channel information that is publicly visible. It does not use the YouTube Data API, does not search for similar channels, and never mixes in data from another channel.

The dashboard is designed for a trial channel with fewer than five videos. It works from saved files, so the latest dashboard remains viewable even if the laptop is offline.

## What happens when the laptop is opened

After the one-time Task Scheduler setup below, Windows starts the snapshot command when the user signs in:

1. The collector checks the saved spreadsheet for a completed snapshot dated today (Malaysia time).
2. If one already exists, it stops. No duplicate records are created.
3. Otherwise, it opens the locked public YouTube channel in a browser session and reads the visible channel and video information.
4. It saves one channel-level record and one record for each public video.
5. It calculates changes against the most recent earlier snapshot and refreshes the dashboard’s saved data.
6. The dashboard shows the newly saved values the next time it is opened or refreshed.

If YouTube cannot be read—for example, because of an internet outage or a temporary YouTube page issue—the run is recorded as **Failed** with a reason. No prior data is overwritten and no values are guessed. The next run can retry that failed daily record without creating a second record for the same day.

## What is collected

For the channel:

- Snapshot date and time
- Subscriber count when public
- Number of public videos
- Public channel description
- Latest upload title, link, date and view count

For each public video:

- Title and URL
- Displayed publish date and duration
- Current displayed view count
- Position in the channel’s video list
- Whether it is newly detected compared with the earlier saved snapshot

## Saved files

| File | Purpose |
| --- | --- |
| `data/youtube-snapshots.xlsx` | The master spreadsheet. It preserves historical records in `Daily Snapshots`, `Video Snapshots`, and `Dashboard Data`. |
| `data/dashboard-data.json` | The offline export consumed by the dashboard. |
| `scripts/daily-snapshot.mjs` | The browser-only daily collection job. |

## One-time setup

Open PowerShell in this project folder and run:

```powershell
npm install
npx playwright install chromium
```

To confirm the first snapshot manually:

```powershell
npm run snapshot
```

To open the dashboard locally:

```powershell
npm run dev
```

Open the `Local` address printed in PowerShell, normally `http://127.0.0.1:5173/`.

## Make it run when the laptop is opened

Use Windows **Task Scheduler** once:

1. Open **Task Scheduler** → **Create Task**.
2. Name it `CallyKo Daily YouTube Snapshot`.
3. On **Triggers**, select **At log on** for the laptop user.
4. On **Actions**, select **Start a program** and enter:

   - **Program/script:** `C:\Program Files\nodejs\npm.cmd`
   - **Add arguments:** `run snapshot`
   - **Start in:** the full project folder, for example `C:\Users\Ahmad Syafi\OneDrive\Documents\ChatGPT\analytic-snapshot`

5. Save the task.

The task may start each time the user signs in, but the collector itself permits only one completed snapshot per Malaysia calendar day. This is what prevents duplicate records.

## Reading the dashboard

The dashboard shows the locked channel URL at the top, the latest saved snapshot time, KPI cards, trend charts and a video table. It uses clear empty states whenever a public value is unavailable. When nothing changes from the prior snapshot, it shows **“No changes since previous snapshot.”**

## Important safeguards

- The channel URL is fixed to `https://www.youtube.com/@Callyko17/videos`.
- The collector verifies the channel handle before saving data.
- No YouTube API or continuously live dashboard feed is used.
- Existing historical snapshots are retained.
- The saved dashboard remains available offline.
