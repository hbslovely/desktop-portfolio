# Professional GitHub profile setup

## Accounts

| Account | README path | Setup guide |
| --- | --- | --- |
| [hbslovely](https://github.com/hbslovely) | [`README.md`](./README.md) | This file (below) |
| [hpphat92](https://github.com/hpphat92) | [`hpphat92/README.md`](./hpphat92/README.md) | [`hpphat92/SETUP.md`](./hpphat92/SETUP.md) |

---

# `hbslovely` profile

Apply these steps while logged into GitHub as **hbslovely** (browser or `gh auth login`).

## 1. Profile README (shows at top of github.com/hbslovely)

GitHub renders `README.md` from a public repo named **`hbslovely`** (same as your username).

```bash
mkdir -p ~/github-profile-hbslovely && cd ~/github-profile-hbslovely
gh auth login   # choose account hbslovely if needed
gh repo create hbslovely/hbslovely --public --description "GitHub profile"
cp /path/to/desktop-portfolio/docs/github-profile/README.md ./README.md
git init && git add README.md && git commit -m "Add professional profile README"
git branch -M main
git remote add origin git@github.com:hbslovely/hbslovely.git
git push -u origin main
```

Copy `README.md` from this folder, or edit it first (email, LinkedIn, job title).

## 2. Account settings (Settings → Profile)

| Field | Suggested value |
| --- | --- |
| **Name** | Phat Hong |
| **Bio** | Software Engineer · Angular & TypeScript · Interactive portfolios & full-stack web apps |
| **URL** | https://hpphat1992.vercel.app/ |
| **Location** | Your city/country (optional) |
| **Pronouns** | Optional |

Keep bio under ~160 characters if you shorten it for mobile.

## 3. Pin repositories (Profile → Customize pins)

Pin these three for a professional first impression:

1. `desktop-portfolio`
2. `phat-hong-info`
3. `hbslovely-ide` or `commit-to-love` (only if the README/demo is polished)

Avoid pinning repos whose only description is "Our unforgotten memories" until descriptions are updated.

## 4. Repository descriptions & homepages

Run as **hbslovely** (or edit each repo → ⚙️ → Description / Website):

```bash
gh repo edit hbslovely/desktop-portfolio \
  --description "Windows-style desktop portfolio — Angular 17, PrimeNG, Node API, Vercel" \
  --homepage "https://hpphat1992-v2.vercel.app"

gh repo edit hbslovely/phat-hong-info \
  --description "Interactive CV & portfolio — Angular 19, i18n, PDF export" \
  --homepage "https://hpphat1992.vercel.app"

gh repo edit hbslovely/hbslovely-ide \
  --description "Browser-based IDE-style portfolio experiment (TypeScript)" \
  --homepage "https://hbslovely-ide.vercel.app"

gh repo edit hbslovely/hbslovely.github.io \
  --description "Personal site — GitHub Pages (TypeScript)"

gh repo edit hbslovely/commit-to-love \
  --description "Interactive love-letter / commitment experience (SCSS)" \
  --homepage "https://hbslovely.vercel.app"
```

Replace vague text like "Our unforgotten memories" with one-line technical summaries (personal projects can stay public with clear labels).

## 5. README quality on flagship repos

- `desktop-portfolio` — already strong; keep homepage URL in repo settings aligned with Vercel.
- `phat-hong-info` — already professional; ensure LICENSE and live demo link in README stay current.

## 6. Troubleshooting a broken profile README

| Symptom | Cause | Fix |
| --- | --- | --- |
| Broken image boxes under "GitHub activity" | `github-readme-stats.vercel.app` is often down or rate-limited | Use `streak-stats.demolab.com` and `github-readme-activity-graph.vercel.app` instead (see current `README.md`) |
| Profile looks plain | Add visuals that stay up: `capsule-render`, `skillicons.dev`, `readme-typing-svg.demolab.com` | Copy the latest `README.md` from this folder |
| Weird or missing badges | Shields `badge/Label-Message-Color` breaks when the label contains extra `-` or `.` | Use `img.shields.io/static/v1?label=...&message=...` URLs |
| README shows on repo but not on profile | Wrong repo name or visibility | Repo must be public and named exactly `hbslovely` |
| `---` directly under the title | Markdown horizontal rule eats spacing | Put badges in `<p align="center">` blocks with blank lines around them |

## 7. Optional polish

- Add a **profile picture** (clear headshot or minimal logo).
- Enable **GitHub Achievements** (already visible: Pull Shark, YOLO).
- Set **hbslovely/hbslovely** repo topics: `profile`, `portfolio`, `angular`, `typescript`.

## 8. What not to do

- Do not use only emoji or meme bios on a professional profile.
- Do not pin half-finished repos without a README or demo link.
- Do not leave `name`, `bio`, and `blog` empty when you have live portfolio URLs.
