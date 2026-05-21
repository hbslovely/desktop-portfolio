# Desktop Portfolio

A Windows-style desktop experience built with **Angular 17**, bundling productivity tools, mini-apps, and family-life utilities in a single portfolio site. The UI mimics a familiar desktop shell (icons, windows, taskbar, Explorer) while apps run as routed or in-window Angular components.

## Highlights

- **Desktop shell** — draggable icons, multi-window layout, Explorer file tree, rich text editor, calculator, paint, and more
- **Life & family apps** — feeding tracker, expense manager, calendar (lunar), booking, weight/medical history via Google Sheets
- **Finance & data** — stock charts, FireAnt integration, business management, neural-network experiments
- **Reference & media** — Yu-Gi-Oh! card browser, Angular docs reader, news/weather, OCR, image search
- **Real-time** — optional signaling server for peer features; local API server for stock and file operations

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 17, PrimeNG, Chart.js, D3, TensorFlow.js |
| Styling | SCSS, PrimeIcons |
| Backend (local) | Node.js API server (`server/`) |
| Data | Google Sheets API, Google Apps Script |
| Deploy | Vercel (static + serverless) |

## Prerequisites

- **Node.js** 18+ and npm
- **Angular CLI** 17 (`npm install -g @angular/cli@17` optional; project includes local CLI)
- Google Cloud credentials for Sheets / OAuth where required (see [docs](./docs/README.md))

## Quick start

Install dependencies for the root app and the API server:

```bash
npm install
cd server && npm install && cd ..
```

Run the full local stack (Angular on port **3006** + API on **3001**):

```bash
npm run dev
```

Open [http://localhost:3006](http://localhost:3006).

Other useful scripts:

```bash
npm run dev:angular      # Frontend only (with proxy)
npm run dev:api          # API server only
npm run build            # Production build → dist/
npm test                 # Unit tests (Karma/Jasmine)
```

For proxy details, environment variables, and troubleshooting, see **[docs/getting-started/LOCAL_SETUP.md](./docs/getting-started/LOCAL_SETUP.md)**.

## Project structure

```
desktop-portfolio/
├── src/                    # Angular application
│   ├── app/
│   │   ├── components/     # Desktop shell & mini-apps
│   │   ├── pages/          # Full-page routes (e.g. feeding)
│   │   ├── services/       # API, Sheets, app logic
│   │   └── config/         # Desktop icons & app registry
│   └── assets/             # Static assets, Explorer JSON, images
├── server/                 # Local Node API (stocks, GitHub sync, …)
├── signaling-server/       # WebRTC signaling (optional)
├── docs/                   # Project documentation (see docs/README.md)
├── scripts/                # Maintenance scripts (e.g. Yu-Gi-Oh images)
└── proxy.conf.json         # Dev proxy to API & external services
```

## Documentation

All guides live under **[docs/](./docs/README.md)**:

| Section | Topics |
|---------|--------|
| [Getting started](./docs/getting-started/) | Local setup, quick deploy, feature guides |
| [Deployment](./docs/deployment/) | Vercel, checklists, troubleshooting |
| [API](./docs/api/) | REST API setup and debugging |
| [Integrations](./docs/integrations/) | Google Apps Script, GitHub App, FireAnt |
| [Feeding](./docs/feeding/) | Baby feeding tracker & Sheets setup |
| [Apps](./docs/apps/) | Per-app notes (Yu-Gi-Oh, Angular Love, editor, …) |
| [Infrastructure](./docs/infrastructure/) | Docker notes |

Submodule READMEs:

- [server/README.md](./server/README.md) — local API server
- [signaling-server/README.md](./signaling-server/README.md) — signaling service

## Environment variables

Copy or create `.env.local` at the project root (and `server/.env.local` for the API). Common keys include:

```env
NG_APP_GOOGLE_SHEETS_API_KEY=
NG_APP_GOOGLE_CLIENT_ID=
NG_APP_GOOGLE_APPS_SCRIPT_URL=
NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL=
NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL=
NG_APP_WEATHER_API_KEY=
NG_APP_NEWS_API_TOKEN=
GITHUB_TOKEN=
```

See [LOCAL_SETUP.md](./docs/getting-started/LOCAL_SETUP.md) and integration docs under [docs/integrations/](./docs/integrations/) for service-specific setup.

## Deployment

Production builds use `ng build --configuration production`. Vercel deployment steps and checklists:

- [docs/deployment/VERCEL_DEPLOYMENT.md](./docs/deployment/VERCEL_DEPLOYMENT.md)
- [docs/deployment/DEPLOYMENT_CHECKLIST.md](./docs/deployment/DEPLOYMENT_CHECKLIST.md)

## Contributing

1. Create a feature branch from `master`
2. Run `npm run build` and `npm test` before opening a PR
3. Update relevant docs under `docs/` when behaviour or setup changes

## License

Private project — all rights reserved unless otherwise noted in repository settings.
