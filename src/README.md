# 工廠 LIVE — source handoff

Base: deployed `index.html` = github.com/sunny-chen-shouen/factory-live `main` @ `1261763`.
This zip rebuilds that exact file (plus nothing else changed).

## Layout
- `app/` — source. Concatenated in this order by build.py:
  qrlib.js, calc.js, api.js, i18n.js, core.js, views_team.js, views_screen.js, views_host.js, fx.js, main.js
  + style.css and index.src.html (template with `/*STYLE*/`, `/*SCRIPT*/`, and the FL_CONFIG line).
- `sql/` — 001 = full schema + RPCs (applied), 002 = search_path fix (applied).
- `test/` — calc_test.js (math), keys_test.js (i18n keys/params), sql_test.mjs (PGlite),
  e2e_flow.py / e2e_qa.py (Playwright, LocalApi mock — NOT proof for production).

## Build
    python3 build.py                      # local/mock mode (empty config → LocalApi, localStorage)
    python3 build.py <SUPABASE_URL> <PUBLISHABLE_KEY>   # production build → dist/index.html
Production values: URL https://qafavlcilrgnhaoeneka.supabase.co ; key = the project's
publishable key (Supabase dashboard → API keys, or read it from the live index.html FL_CONFIG line).
Deploy = copy dist/index.html to repo root on main.

## Test
    node test/keys_test.js && node test/calc_test.js
    cd test && npm i && node sql_test.mjs          # needs @electric-sql/pglite
    (cd dist && python3 -m http.server 8765) &  python3 test/e2e_flow.py   # mock build only

## Known root cause (open)
Postgres lowercased `p_L` → `p_l` in 5 RPCs (fl_report, fl_submit, fl_confirm, fl_host_run,
fl_host_decide). Frontend `app/api.js` sends `p_L`. Fix in api.js (5 keys) — LocalApi ignores names, so mock tests pass anyway.
