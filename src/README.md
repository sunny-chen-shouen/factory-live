# 工廠 LIVE — maintained source

Edit src/app/ and rebuild; root index.html is generated for GitHub Pages.
Source baseline: main 1261763, handoff f6698cc0efc4d2af318ea38d22fca46438219730.

## Build (from src/)

    python3 build.py                          # local-storage rehearsal backend
    python3 build.py <SUPABASE_URL> <PUBLISHABLE_KEY>  # production -> dist/index.html

Copy the production build to the repository root when publishing. Preserve the
existing public connection settings; never include a service-role/secret key.
No database migration is required for this QA repair.

## Verify (Node 24+)

    cd test
    npm ci
    npm test

Covers calculations, real SQL argument names versus RPC JSON, DOM regressions,
draft persistence, bilingual text, pagination, and PostgreSQL rules. The older
Playwright scripts use LocalApi; passing those is not production proof.

Explicit live integration (creates its own three-factory QA room):

    npm run test:live

Reads public connection settings from root index.html. Local fixtures are ignored
by Git. Also test the deployed UI in separate teacher/student/projector tabs at
390px / 1280x720 / 1920x1080.

## Classroom behavior

- Actual reported tables are paired in order; an odd final three count in a cycle.
  A single factory needs a TA to verify and enter counts.
- Only confirmed or teacher-approved trials feed estimates.
- Missing decisions/results remain unknown; prepaid first-period rent is visible.
- Forecasts concern exits across the whole active class.
- Reasons autosave as local drafts, keyed by room and team. They are explicitly
  not submitted to the teacher and are not in CSV exports.
- The teacher can reveal/hide the short-run vs long-run explanation at debrief.
- Up to 20 factories remain visible on one projection screen.
- Market parameters stay hidden from students/projector until the teacher
  explicitly announces them. Editing parameters withdraws that announcement.
- Projector means use one complete-data cohort across tested headcounts, with
  the cohort size labelled. Paired marginal analysis stays in teacher data.
- Projection ledgers compare all factories with shutdown/exit; the debrief
  foregrounds the lesson formula and labels forecast frequencies.
- Teacher URLs containing a different room code require fresh sign-in before
  loading that room. Boot, rendering and stale click/change dispatch are fenced.
- Ledger 2 compares each factory with its own alternative: exits use estimated
  renewal, renewers use zero. Unknown alternatives are excluded from comparisons.
- Automatic Ledger 2 examples favour opening today and correctly exiting next;
  manual featured choices are scoped to their ledger period.
- Both class ledgers plot actual minus the reference option around a common
  difference-zero centre. In Ledger 1, profit zero is at difference F and is
  labelled separately from shutdown at the centre. Ledger 2 groups renewal
  and exit choices and sorts by gain within each group.
- Before market publication, the projector keeps trial curves and cohort means
  visible while prices, wages and rent remain hidden.

## RPC regression

Historical SQL declares unquoted p_L, which PostgreSQL folds to p_l. JSON must
send p_l for report, submit, confirm, host count and host decision endpoints.
api_contract_test.js validates JSON arguments against the SQL declarations;
the permissive LocalApi mock would not detect this mismatch.

## Extended rounds (2026-11-27)

New teacher-created rooms use extended_rounds=true. Existing rooms keep the
original two-period flow. Apply sql/003_extended_rounds.sql after 001 and 002.

- Unscored practice: 30s. Four trial headcounts: 30s each. Three scored rounds: 60s each.
- The initial lease prepays 2F for the first two scored rounds. Each round allocates F
  exactly once and pays w per hired worker anew. The second round changes workers
  without another lease payment. Final renewal costs F for one final round; exit is 0.
- Internal decision/run slots 0,1,2 display as rounds 1,2,3. Legacy slots 1,2 retain
  their original meanings in legacy rooms. First-round decisions stay hidden until run0.
- Raw trial counts remain raw. Planning scales trial output by scored/trial duration,
  marks it as an estimate and prefers verified scored-round output at the same L.
  Only verified actual scored output enters profit. Timings lock once trials start.
- CSV preserves raw trial counts, identifies each extended round explicitly, and adds
  durations, the first-round results and the prepaid lease payment.
- npm test includes extended_rounds_test.mjs: actual-only scoring, all 84 bilingual
  role/phase views, independent choices, secret decisions and real PostgreSQL rules.
