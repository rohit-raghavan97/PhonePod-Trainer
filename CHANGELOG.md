# Changelog

## v1.18 - 2026-05-06

- Replaced player profile trend bars with a line chart that better shows improvement over attempts.
- Added an Admin page for sync health, cloud activity counts, and recent activity.
- Improved scoring weights by preset type: Random, Focus, Sequence, and Home Base now emphasize different skills.

## v1.17 - 2026-05-06

- Added selectable player profile pages from the Players roster.
- Added player-level analytics for attempts, trends, strengths, weaknesses, preset performance, and recent results.
- Added visual player score, trend bars, and interactive recent-attempt shortcuts.

## v1.16 - 2026-05-06

- Fixed result history sync so cloud results no longer replace local results with an empty table.
- Added startup reconciliation that merges local and Supabase players, presets, and results.
- Added automatic retry sync for locally saved attempts.

## v1.15 - 2026-05-06

- Added descriptions for custom presets.
- Included saved custom presets in leaderboard grouping.
- Upgraded the Results page with summary cards, attempt scores, detail analytics, and coach-style insights.

## v1.14 - 2026-05-06

- Cleaned up preset list cards with separate rows for name, description, key configuration, and colors.
- Added browser/app back-button handling so navigation returns to the previous Reflex page before exiting.

## v1.13 - 2026-05-06

- Added hidden registered-user tracking through Supabase.
- Reworked preset selection from a modal into dedicated preset list and detail pages.
- Added editable custom preset detail fields, including colors.
- Added duplicate checks for custom preset names and matching rule/color configurations.
- Switched app release naming to the `v1.x` scheme.

## v1.12 - 2026-05-05

- Added Supabase-backed shared storage support for players, custom presets, and results.
- Added duplicate checks for player creation.
- Added full-field editing for custom presets through the setup screen.
- Fixed Play page horizontal overflow caused by the hidden awake toggle input.
- Added initial repo documentation and version tracking.

## v1.11 - 2026-05-05

- Renamed the app to Reflex.
- Added the pulse bolt logo, app icons, and splash screen.
- Split the app into Home, Play, Players, Results, Guide, and User Profile pages.
- Added full-screen game mode with countdown, rest countdown, and live metrics.
- Added result details and leaderboard views.

## v1.10 - 2026-05-05

- Initial static PWA prototype.
- Added reaction training setup, color prompts, presets, and local results.
- Added early multi-device room support.
