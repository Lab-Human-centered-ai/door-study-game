# Door Study — GitHub Pages + Google Sheets

A static browser port of the supplied Python/Pygame trust game. No build command or paid server is needed. The original Python source remains for reference; the website uses only `docs/` and does not use the old Supabase integration.

**Start with [START-HERE.md](START-HERE.md)** for the click-by-click hosting and data collection tutorial.

1. Create a private Google Sheet. Paste `google-sheets/Code.gs` into Extensions → Apps Script.
2. Run `setup`, then deploy a Web app as **Me**, accessible to **Anyone**.
3. Paste its `/exec` URL into `docs/config.js`.
4. Upload `docs/` to a public GitHub repository. In Settings → Pages, publish **main /docs**.
5. Play TEST-001 and confirm the save status AND records in the Sheet before recruitment.

The game logs prompt exposure, exact wording, suggestion, chosen door, correctness, compliance, reaction time, health, score, maze completion, visibility changes, and session summaries. Random prompt assignment is per session. Uploads are batched, persisted locally, deduplicated, and acknowledged by a separate receipt request. Sessions without an end event remain incomplete; browser closure cannot guarantee delivery.

Local preview: `python3 -m http.server 8765 --directory docs`, then open http://localhost:8765. With no endpoint, this is a local-data-only demo. Open through HTTP instead of double-clicking the HTML file.

Developer checks: `node --test tests/*.test.cjs` (Node 20+). These cover game rules and simulated collection failures; a real Google account deployment must still pass the tutorial's incognito smoke test.

## Files

- `docs/`: all website files and original portrait assets.
- `google-sheets/Code.gs`: paste-ready private collector.
- `START-HERE.md`: setup, analysis, configuration, limitations, troubleshooting.
- `tests/`: deterministic rules, session flow, and storage/retry regression checks.

Only publish `docs/`. Keep research data and downloads out of the public repository. GitHub Pages is free for public repositories on GitHub Free; Apps Script has quotas. See the linked official references in the tutorial.
