# Door Study — GitHub Pages + Google Sheets

The game logs prompt exposure, exact wording, suggestion, chosen door, correctness, compliance, reaction time, health, score, maze completion, visibility changes, and session summaries. Random prompt assignment is per session. Uploads are batched, persisted locally, deduplicated, and acknowledged directly by the collector, with a separate receipt request as fallback. Sessions without an end event remain incomplete; browser closure cannot guarantee delivery.

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

## Follow-up (web-1.5.0)

Music is preloaded from a 3.3 MB AAC copy (with the original WAV as fallback). Start becomes available after images and music are ready, and the run begins only after the browser confirms playback. Playback failure leaves the participant on the welcome screen with a retry message. The complete assistant image extends beneath the hallway scene; knees align with its bottom edge, and the portrait wrapper no longer clips the legs above the door controls.


## Save reliability update (web-1.6.0)

Events are persisted locally first and scheduled for automatic upload within 250 ms. Successful collector acknowledgments clear the corresponding batch immediately. If the POST response is unavailable, a separate receipt check confirms whether Google already saved it. Unconfirmed batches remain in the outbox and retry after 2, 4, 8, then at most 15 seconds; reconnecting or pressing Retry triggers an immediate attempt. Pending batches also resume on the next visit. Small requests use fetch keepalive for page exits, although browser closure cannot guarantee delivery.

Pursuit acceleration is recorded as a supported `heartbeat` with `details.action = "pursuit_accelerated"`. Older queued `pursuit_accelerated` events are repaired on load while preserving event and batch IDs, because the deployed collector rejects unknown event types. The local `docs/code.gs` is now plain Apps Script source instead of RTF; its collector behavior is unchanged and no collector redeployment is required for these client fixes.

Live verification on 2026-10-11 confirmed both test sessions in Door Game Results, including final session summaries and no duplicate event rows after repeat uploads. Exclude participant codes `TEST_AUTOSAVE_20261011` and `TEST_AUTOSAVE_FAST_20261011` from research analysis. The final test confirmed its full outbox in 7.6 seconds (two batches), compared with 24.3 seconds using separate receipts for every batch. These are observed timings, not a delivery-time guarantee. Local recovery tests covered lost responses, failed requests, retry scheduling, reload recovery, and old-event repair.

## Demographics update (web-1.7.0)

The start screen requires gender (man, woman, other), integer age in years (1–120), and consent. This range is input validation, not an REB eligibility rule. It displays REB 2026-058 and explains that demographics are recorded with a random participant code. Participant-supplied codes have been removed. Emailing a backup reveals the sender's address, so the screen does not promise complete anonymity.

Events and Sessions now append participant_age and participant_gender. Batches with demographics validate their values and consistency across events; older queued batches remain supported with blank demographic columns. Existing columns and reaction-time records are preserved.

Deployment: replace the source in the existing Google Apps Script project with docs/code.gs, run setup() against the existing spreadsheet to append headers, then update the existing web-app deployment to a new version (retain its /exec URL). Deploy this collector before publishing the updated docs/ app through the repository's GitHub Pages workflow. The local source changes alone do not update the deployed Apps Script collector.

## Active collector (web-1.7.2)

The canonical collector source is `docs/code.gs`; it targets spreadsheet `1e5ppc5OfJoeXG6h5lsV6Rc16XbAywZOiMMkgWikqMKA`. Use only that source in the Apps Script project. The legacy `docs/code copy.gs` is a backup, not deployment source.

The configured web-app endpoint is https://script.google.com/macros/s/AKfycbw5VSDQ23w5JIwQNCahVXcwdwtiWe-bIf0r90BMNdk7qE7CKrHgUoZyv65WnY8DSh4M/exec. The client requires collector schema `demographics-v2` on POST acknowledgments or JSONP receipts. Deploy the current game.js, logger.js, config.js, index.html, and style.css together.

Run setup() once in the new Apps Script project, then deploy as a web app executing as the owner with access for Anyone. Sessions and Events capture demographics even when the run ends in the maze; Decisions contains only actual door choices. Missing choice fields for maze-only runs are expected. REB is displayed on the consent screen, not stored as a data column.

## Save recovery (web-1.7.7)

Slow uploads no longer stop after three attempts or 45 seconds. Upload/receipt confirmation has a 45-second request budget; JSONP receipts allow 15 seconds. Failed batches remain durable and retry with capped backoff. After 60 seconds a backup option appears while automatic saving continues. Receipt confirmation still gates SAVE COMPLETE. Assets use a version query to refresh cached client code.

Live verification used participant_id TEST_SAVE_REPAIR_20261016 (exclude from analysis): the collector acknowledged its write after 10.7 seconds, and a subsequent matching receipt confirmed it after 13.8 seconds. These are observed timings, not a delivery guarantee.
