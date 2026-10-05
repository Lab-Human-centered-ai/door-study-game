# Put your game online and collect results — step by step

Think of this as three pieces:

- **GitHub Pages is the playground.** It shows the game to players.
- **Google Sheets is your notebook.** It holds the results privately.
- **Apps Script is the helper.** It carries game records into the notebook.

You need a Google account and a GitHub account. No paid server, credit card, Python installation, or API key is needed for this setup. Allow about 20–30 minutes the first time. The free services have limits; this setup is intended for a small research study, not unlimited traffic.

## 1. Make your notebook

1. Open [Google Sheets](https://sheets.google.com) and create a **Blank spreadsheet**.
2. Name it **Door Game Results**.
3. Keep its sharing setting **Restricted**. Players do not need access to the spreadsheet.
4. In its top menu, click **Extensions → Apps Script**. A new editor opens.

## 2. Give the notebook its helper

1. In this downloaded project, open **google-sheets/Code.gs** in a text editor. Copy the entire file.
2. In the Apps Script editor, delete the example `myFunction` code. Paste the code you copied.
3. Click **Save**. Give the project a name such as **Door Game Collector**.
4. Near the top, choose **setup** from the function dropdown. Click **Run**.
5. Google asks you to authorize your own script. Check that the project is yours and allow its spreadsheet access. If your own script is shown as unverified, Google's flow may offer **Advanced → Go to Door Game Collector → Allow**. If a work/school policy blocks it, use an account that allows public web apps or ask your administrator.
6. Return to your spreadsheet. You should now see **Events**, **Sessions**, and **Receipts** tabs. You can leave the original empty Sheet1 alone.

Do not rename the new tabs or edit their first-row headings. The helper uses those names to find the correct boxes.

## 3. Give the helper a receiving address

1. Return to Apps Script.
2. Click **Deploy → New deployment**.
3. Click the gear beside **Select type**, then choose **Web app**.
4. Set **Execute as** to **Me**.
5. Set **Who has access** to **Anyone**. Choose the option that lets people use it without signing into Google, not “Anyone with a Google account.”
6. Click **Deploy**, and finish any authorization Google requests.
7. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/LONG_ID/exec`. Use the one ending in **/exec**, not **/dev**.
8. Open that URL in a private/incognito browser window where you are not signed in. It should show a small message containing `"ready":true`. A sign-in page means the access setting is wrong.

Only the receiving helper is public. Your spreadsheet remains private. This is an anonymous collection endpoint, so somebody who discovers its URL can submit fabricated data. There is no secret API key to put in the game; any key placed in a public browser game would be visible to players. Use participant codes and inspect suspicious runs.

## 4. Connect the game to that address

1. Open **docs/config.js** in a plain-text/code editor.
2. At the top, find:

   ```js
   endpoint: "",
   ```

3. Paste your helper's address inside the quotation marks:

   ```js
   endpoint: "https://script.google.com/macros/s/YOUR_LONG_ID/exec",
   ```

4. Save. Keep the quotation marks and comma.

That is the only required code edit. Do not paste a spreadsheet sharing link here. Without this address, the game runs in preview mode and keeps data only in the player's browser.

## 5. Put the playground on GitHub

1. Sign in at [GitHub](https://github.com).
2. Click **+ → New repository**. Name it **door-study-game**.
3. Choose **Public** so you can use GitHub Pages with a free GitHub account. Check **Add a README file**, then click **Create repository**.
4. Click **Add file → Upload files**.
5. From this project folder, drag the entire **docs** folder into the upload area. Also upload **START-HERE.md** if you want these instructions in your repository.
6. Click **Commit changes**.
7. In the repository, click the uploaded **docs** folder. Make sure it contains **index.html**, **config.js**, **core.js**, **game.js**, **logger.js**, **style.css**, and **assets**. The images inside assets are required.

Upload the **docs folder itself**, so the repository has `docs/index.html`. Do not upload the outer project folder, and do not upload just a ZIP file. You do not need the old Python files, build folders, Supabase connection, or executables. Never upload collected player records to your public repository.

## 6. Turn the playground on

1. In your GitHub repository, click **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose branch **main** and folder **/docs**.
4. Click **Save**.
5. Wait a few minutes. Refresh the Pages settings screen. It will display your website address, typically `https://YOUR-USERNAME.github.io/door-study-game/`.
6. Open that address. This is the link you will give players.

If you get a 404, check that the publishing folder is **/docs**, and that `docs/index.html` really exists on the **main** branch. The repository's **Actions** tab shows whether publishing has finished or failed.

## 7. Do a tiny test before inviting anyone

1. Open the published game in a private/incognito window.
2. Enter participant code **TEST-001**.
3. Tick the agreement box and click **Start game**.
4. Use arrow keys or touch buttons to reach the blue maze exit. The red pursuer starts when you move.
5. Make at least two door choices. Click **End this run**.
6. Leave the page open until it says **Saved to Google Sheets**. This can take several retry cycles with a slow connection.
7. Open your spreadsheet. **Sessions** should contain one row for TEST-001. **Events** should contain `prompt_shown` and `decision` rows, including the exact prompt and reaction times. The session's status should be `quit`.
8. Check that an incorrect decision has a smaller `health_after` than `health_before`, and a correct choice adds 10 points.
9. Repeat on a phone and in a browser where you are signed out of Google. Exclude all TEST participant codes from analysis.

A successful local preview does not prove the Google deployment works. This test is the final check after you connect your own account.

## 8. Invite players and find your results

Send the **GitHub Pages game link**, not the Sheet link or Apps Script link. Ask players to wait for the save confirmation at the end. If they have a participant code, they can enter it at the start. With no code, each run gets a new random code; repeat players cannot be linked automatically.

In the Sheet:

| Tab | What it is for |
| --- | --- |
| Sessions | One row per run: participant code, prompt condition, agent order, score, health, decisions, correct/followed counts, mean reaction time, elapsed time, status and last update. |
| Events | The detailed story: every prompt exposure and decision, maze start/completion, periodic state, tab hiding/returning, and session ending. |
| Receipts | Internal save confirmations. Leave this alone. |

The game sends small batches roughly every 15 seconds, and attempts a save at the start and end. It records locally immediately. Retries do not add duplicate events, and old updates cannot replace a newer session summary. Do not sort or edit the source tabs while people are playing; do analysis in a separate tab or a copy of the Sheet.

## 9. Compare how prompts affect choices

There are two default prompt styles. Each new session randomly gets one:

- `suggestion`: “I suggest the left/right door.”
- `confident`: “Trust me. Choose the left/right door.”

Every session uses its assigned style throughout. Agent gender-block order is also randomly assigned from six possible orders. There are three images per gender block and nine choices per hallway. Random assignment is not guaranteed to give exactly equal group sizes, especially in a small sample.

For a simple first comparison:

1. In **Events**, use **Data → Create a filter**.
2. Filter **event_type** to **decision**, so you count actual decisions only.
3. Exclude TEST participant codes.
4. Compare the percentage of `compliance = TRUE` between the two `prompt_id` groups. This means “the player chose the suggested door”; it does not necessarily mean the advice was correct.
5. Compare `reaction_time_ms`, `correct`, `agent_gender`, and hallway number too. A value of 1000 milliseconds means one second.
6. Look at `hidden_during_prompt_ms`. Large values mean the player switched away while the prompt was waiting. Decide how to handle these before analysing results.
7. Use Sessions to check completion rates. A condition that causes more quitting should not disappear from your comparison just because only completed runs are analysed.

For a quick spreadsheet summary, create a new analysis tab. In A1 paste:

```
=QUERY(Events!A:AF,"select M, count(A), avg(X) where G = 'decision' and not C starts with 'TEST' group by M label M 'Prompt', count(A) 'Decisions', avg(X) 'Mean response ms'",1)
```

This query gives decision counts and mean response time by prompt. For compliance, add a numeric helper column in an **analysis copy** (`=IF(W2=TRUE,1,0)`) and average it by prompt in a pivot table. A mean of 0.7 means 70% followed the advice. Some spreadsheet locales require semicolons instead of commas between formula arguments.

Treat these as descriptive comparisons, not proof of a causal effect by themselves. Each person makes repeated decisions; use participants/sessions as the grouping unit in formal analysis, account for trial order and earlier outcomes, and keep your study settings consistent. These records describe in-game behavior, not someone's personality. The visible agent names differ by gender, so an appearance comparison also includes the name difference.

## 10. Optional: change your study

Edit **docs/config.js**, then upload/commit that changed file to GitHub. Publishing happens again automatically.

- **prompts**: Edit the wording. Keep `{direction}` exactly as written. Use distinct IDs, such as `suggestion_v2`. Keep a single prompt entry if you only want to study agent appearance.
- **studyId / version**: Change these when starting a new study or changing the game, so you do not accidentally mix incompatible runs.
- **agentAccuracy**: 50 means a 50% chance of truthful advice on each trial, not exactly half of every player's trials. Use a number from 0 to 100.
- **roundTimes**: `[90, 60, 40]` gives three hallway timers. These start after the maze, and include time spent viewing feedback. If you change the number of hallways, update the welcome-screen instructions in index.html too.
- **wrongPenalty**: Health lost for a wrong choice.
- **enemyDelayMs**: A larger number makes the maze enemy slower.
- **genderSequence**: `"random"` is the default. Use `"MFN"`, `"MNF"`, `"FMN"`, `"FNM"`, `"NMF"`, or `"NFM"` for a fixed block order.

If you edit **Apps Script**, saving is not enough: click **Deploy → Manage deployments → pencil/Edit → Version: New version → Deploy**. Keeping the same deployment keeps the same /exec address.

## If something goes wrong

- **The game says Preview/Demo mode:** the endpoint in config.js is empty. Paste the /exec address, save, and publish the updated file.
- **Save not confirmed:** stay on the page and click Retry saving. Check the public /exec address in an incognito window. Check that setup ran, access is Anyone, and the deployment uses the newest code. Apps Script's **Executions** screen shows errors. Browser extensions or blocked Google domains can also interrupt saves.
- **Internet drops:** unsent records stay in that browser's local storage. They retry while the page is open and on a later visit to the same site. Use Download data backup before clearing browser data. Private mode storage disappears when its windows close.
- **The browser closes or crashes:** the last received session may stay `in_progress`. Treat old in-progress rows as incomplete/last-seen, not confirmed completed sessions. Last-second delivery cannot be guaranteed. There is no game resume after a reload; a new start makes a new session ID.
- **Download data backup:** saves JSON containing all runs retained by that browser, plus its pending queue. Keep it private. It is a recovery/analysis file, not an automatic Google Sheets import. A researcher can extract event objects and deduplicate by `event_id`.
- **Google says a quota was exceeded:** pause recruitment and let the limit reset. A free Apps Script app is not an unlimited database. Do a pilot at your expected concurrency before inviting a large group.
- **Public access is unavailable:** a work/school administrator may forbid it. You cannot fix that by changing this game. Use an eligible account or ask the administrator.

## What changed from the Python prototype

The browser version is a port, not a Python emulator. It keeps a generated 12×12 maze, a chasing enemy, the nine original agent portraits, three gender blocks, three default hallways, random correct doors, configurable advice accuracy, and health penalties. It adds 10-point correct answers and touch controls. The hallway timer now begins **after** the maze (the Python prototype's timer began before it). The enemy takes one shortest-path step per delay, with explicit collision detection. The old unfinished X-ray key is omitted. Advice is rendered as configurable text instead of baked-in speech-bubble art. Names use the original unified John/Mira/Robin setting.

Reaction time begins after the prompt is made renderable, uses the browser's monotonic clock, and is captured before the 350 ms feedback interval. It is a browser timing estimate, not laboratory hardware timing. Background time is included and separately flagged. Health after a decision is logged after applying the penalty. Maze paths, seeds and configuration snapshots support interpretation/reproduction; event logging does not sample every animation frame or every movement key.

Do a pilot before mixing these results with the old prototype: the timing, enemy collision behavior, interface and prompt wording differ. Decide the study's participant information, contact details and retention policy before recruitment; replace/extend the short agreement wording in index.html as appropriate to your study.

## Official references

- [GitHub Pages publishing setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Deploying Google Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script Content Service and JSONP](https://developers.google.com/apps-script/guides/content)
- [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
