# CallyKo🎀🐾 — Channel Snapshot Analytics

Local, offline-friendly dashboard for the locked YouTube channel [`@Callyko17`](https://www.youtube.com/@Callyko17/videos). It never calls the YouTube Data API. Instead, `npm run snapshot` opens the public channel in a browser, saves daily public data to `data/youtube-snapshots.xlsx`, and exports `data/dashboard-data.json` for the dashboard.

## Run

```powershell
npm install
npx playwright install chromium
npm run snapshot
npm run dev
```

The collector is idempotent: if a snapshot (successful or failed) already exists for the current local calendar date, it exits without duplicate rows. It keeps all historic records. Browser failures are logged in **Daily Snapshots** with `Run status = Failed` and a reason; old data is untouched.

To run it automatically when the laptop starts, create a Windows Task Scheduler task that runs `npm run snapshot` at logon with this repository as its working directory. The dashboard is intentionally fed from the saved JSON export, so it continues to display its most recently saved state when offline.
