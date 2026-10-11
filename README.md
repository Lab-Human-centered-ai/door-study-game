# Door Study — GitHub Pages + Google Sheets

The game logs prompt exposure, exact wording, suggestion, chosen door, correctness, compliance, reaction time, health, score, maze completion, visibility changes, and session summaries. Random prompt assignment is per session. Uploads are batched, persisted locally, deduplicated, and acknowledged by a separate receipt request. Sessions without an end event remain incomplete; browser closure cannot guarantee delivery.

Local preview: `python3 -m http.server 8765 --directory docs`, then open http://localhost:8765. With no endpoint, this is a local-data-only demo. Open through HTTP instead of double-clicking the HTML file.

Online game: https://lab-human-centered-ai.github.io/door-study-game/

## Files

- `docs/`: all website files and original portrait assets.

## UI update (web-1.1.0)

The welcome screen introduces the objective as a short narrative while preserving explicit consent. Pursuit now runs 35% faster (`650 / 1.35` ms per step). Guide portraits are enlarged, the corridor keeps its original colors, and the hallway countdown highlights the final ten seconds. Digital Pursuit loops from Start through the entire run, with a mute toggle, and stops when the run ends. The final screen highlights the wait-for-save instruction and changes to a completion message only after the logger confirms receipt from Google Sheets.

## Follow-up (web-1.2.0)

Guide portraits retain their full height at the enlarged size, with vertical scrolling on smaller screens. The introduction uses rhyme without describing advice accuracy. Pursuit now uses a 320 ms step delay, about 50% faster than web-1.1.0. The final save screen counts down the actual upload/receipt timeout and the 15-second retry wait, rather than estimating successful completion. Failed saves offer a backup download and ask participants to email it to lab.human.centered.ai@gmail.com. Confirmed batches drain immediately; success still requires a matching receipt for every queued batch.

## Follow-up (web-1.3.0)

The introduction returns to a concise maze-and-chase narrative. The guide is framed around the knees, with viewport-based sizing that keeps door choices and the end-run control visible on standard laptop screens. Pursuit starts at 320 ms per step. Once the player's remaining route to the exit is at most half the initial shortest-path length, the pursuer ramps to 120 ms per step over two seconds. Acceleration stays active through backtracking and resets for each maze. A `pursuit_accelerated` event records the transition for study analysis.

## Follow-up (web-1.4.0)

The game retains three hallways with 90, 60, and 40 second limits after their mazes. Digital Pursuit loops until the run ends. The supplied swipe effect plays once when the player is caught or health reaches zero, but not on completion, timeout, or quitting. The audio toggle mutes both music and effects, and a new run resets both tracks.
