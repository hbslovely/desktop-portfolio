# GitHub profile setup — [hpphat92](https://github.com/hpphat92)

This account is your **primary professional** profile (Backbase, Ho Chi Minh City, 47+ repos). The visual README lives in **`hpphat92/hpphat92`**, same pattern as [hbslovely](https://github.com/hbslovely).

## Publish the README

```bash
cd /path/to/hpphat92   # clone: git@github.com:hpphat92/hpphat92.git
cp /Users/phat@backbase.com/Projects/desktop-portfolio/docs/github-profile/hpphat92/README.md ./README.md
git add README.md
git commit -m "Professional profile README with visuals"
git push origin main
```

Or edit [hpphat92/hpphat92 README](https://github.com/hpphat92/hpphat92/edit/main/README.md) in the browser and paste from `docs/github-profile/hpphat92/README.md`.

## Profile settings (Settings → Profile)

| Field | Suggested value |
| --- | --- |
| **Name** | Phát Hồng |
| **Bio** | Software Engineer @ Backbase · Angular & TypeScript · [hpphat1992.vercel.app](https://hpphat1992.vercel.app) |
| **Company** | Backbase |
| **Location** | Ho Chi Minh City, Viet Nam |
| **Website** | https://hpphat1992.vercel.app/ |

## Pin repositories

Recommended pins for a professional first view:

1. `hbslovely/desktop-portfolio` (if you can pin cross-user — otherwise pin from account that owns it on **hbslovely** only)
2. `my-todo-reactjs`
3. `hpphat92.github.io`
4. `WebComponent-Jul2020` or `unit-test-integ`

On **hpphat92**, pin your best repos **on this account**; keep flagship demos discoverable via the profile README links to **@hbslovely**.

## Two accounts — how they differ

| | [hpphat92](https://github.com/hpphat92) | [hbslovely](https://github.com/hbslovely) |
| --- | --- | --- |
| **Tone** | Career / Backbase / long GitHub history | Portfolio & showcase projects |
| **Header color** | Teal → blue → purple | Blue → purple |
| **Featured** | Flagship on @hbslovely + repos on @hpphat92 | desktop-portfolio, phat-hong-info |

## Optional repo description updates

```bash
gh auth login   # account: hpphat92

gh repo edit hpphat92/my-todo-reactjs \
  --description "React todo application — learning project"

gh repo edit hpphat92/hpphat92.github.io \
  --description "Personal site — GitHub Pages (TypeScript)" \
  --homepage "https://hpphat1992.vercel.app"

gh repo edit hpphat92/WebComponent-Jul2020 \
  --description "Web Components talk — sample code (July 2020)"
```

## Troubleshooting

Same as the [hbslovely setup](../SETUP.md): avoid `github-readme-stats.vercel.app` (often 503). This README uses `streak-stats.demolab.com`, `github-readme-activity-graph`, `skillicons.dev`, and `capsule-render` instead.
