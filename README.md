# Door Study — GitHub Pages + Google Sheets

The game logs prompt exposure, exact wording, suggestion, chosen door, correctness, compliance, reaction time, health, score, maze completion, visibility changes, and session summaries. Random prompt assignment is per session. Uploads are batched, persisted locally, deduplicated, and acknowledged by a separate receipt request. Sessions without an end event remain incomplete; browser closure cannot guarantee delivery.

Local preview: `python3 -m http.server 8765 --directory docs`, then open http://localhost:8765. With no endpoint, this is a local-data-only demo. Open through HTTP instead of double-clicking the HTML file.

Online game: https://lab-human-centered-ai.github.io/door-study-game/

## Files

- `docs/`: all website files and original portrait assets.

## UI update (web-1.1.0)

The welcome screen introduces the objective as a short narrative while preserving explicit consent. Pursuit now runs 35% faster (`650 / 1.35` ms per step). Guide portraits are enlarged, the corridor keeps its original colors, and the hallway countdown highlights the final ten seconds. Digital Pursuit loops from Start through the entire run, with a mute toggle, and stops when the run ends. The final screen highlights the wait-for-save instruction and changes to a completion message only after the logger confirms receipt from Google Sheets.
