# Reflex Feature Guide

## Training Modes

- Random Reaction: shows random active colors for general reaction speed.
- Focus: asks the player to tap only the target color and avoid distractors.
- Sequence: repeats a color sequence for rhythm, recall, and coordination.
- Home Base: returns the player to a home color between task prompts.

## Presets

- Default presets are standardized and can be used for fair leaderboards.
- Custom presets can be saved, loaded, edited across all setup fields, and deleted.
- When Supabase is configured, custom presets are shared globally.

## Players

- Players are stored as a roster and sorted alphabetically.
- Duplicate names are blocked using a case-insensitive, whitespace-normalized check.
- When Supabase is configured, players are shared globally.

## Results

- Each completed attempt records player, mode, preset, hits, misses, false hits, accuracy, average reaction, best reaction, total time, and the full configuration.
- Results can be selected for detailed review.
- Default preset attempts are eligible for leaderboards.
- When Supabase is configured, results are shared globally.

## Multi-Device Rooms

- A host phone creates a room.
- Other phones join as pod screens through the room code or join link.
- The host controls the drill while connected phones display prompts and send taps back to the host.

## PWA Behavior

- The app can be installed to the home screen.
- The service worker caches core files for app-like loading.
- The cache name in `sw.js` must be bumped after frontend asset changes.
