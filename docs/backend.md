# Backend Setup

Reflex uses Supabase for shared global data. Without Supabase config, it falls back to local browser storage.

## Tables

The schema is in `supabase-schema.sql` and creates:

- `players`
- `custom_presets`
- `results`

It also enables Row Level Security and creates public policies for the current shared-use prototype.

## Configure Supabase

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the full contents of `supabase-schema.sql`.
4. Copy the Project URL.
5. Copy the publishable key or legacy anon public key.
6. Put both values into `backend-config.js`.

Example:

```js
window.REFLEX_SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-publishable-or-anon-public-key"
};
```

Never put a Supabase secret key or service-role key in this frontend app.

## Current Security Model

The current prototype intentionally allows anyone with the app link to read and write shared players, custom presets, and results. Before a public launch beyond a trusted friend group, add authentication and tighten the RLS policies.
