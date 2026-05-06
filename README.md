# Reflex

Reflex is a phone-based reaction training PWA inspired by pod-style sports training lights. It supports solo drills, multi-phone pod rooms, presets, player rosters, results, and shared Supabase storage.

Live app: https://rohit-raghavan97.github.io/Reflex/

## Current Version

`v1.17`

## Main Features

- Phone screen as the active reaction pod.
- Random Reaction, Focus, Sequence, and Home Base training modes.
- Default presets for comparable leaderboard attempts.
- Custom presets with full setup editing.
- Player roster with duplicate-name checks.
- Hidden app-user tracking through Supabase.
- Results history with attempt analytics and configuration details.
- Multi-device rooms using PeerJS for host and pod phones.
- Optional Supabase backend for shared players, custom presets, and results.
- PWA install support with app icon and splash-style startup.

## Development Notes

This is a static app made from `index.html`, `styles.css`, `app.js`, and supporting assets. GitHub Pages hosts the frontend. Supabase hosts shared data when `backend-config.js` is configured.

Before pushing changes, run:

```powershell
node --check .\app.js
```

When frontend assets change, bump the service worker cache name in `sw.js` so installed PWAs refresh correctly.

## Documentation

- [Feature Guide](docs/features.md)
- [Backend Setup](docs/backend.md)
- [Changelog](CHANGELOG.md)
