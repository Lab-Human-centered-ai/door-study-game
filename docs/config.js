// Paste your Google Apps Script web app /exec URL between these quotes.
window.STUDY_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbxd498n39hAo0kjajrbatNMWMi-LHajItmU-E8r7EW1SVUA4BpGjHTquWZPweCLaJbtqQ/exec",
  studyId: "prompt-study-v1",
  version: "web-1.0.0",
  roundTimes: [90, 60, 40], // Seconds per hallway, AFTER finishing the maze.
  enemyDelayMs: 650,
  wrongPenalty: 5,
  agentAccuracy: 50, // Probability of truthful advice: 0 to 100.
  genderSequence: "random", // random or MFN, MNF, FMN, FNM, NMF, NFM
  // Randomly assign ONE prompt style per session. {direction} becomes left/right.
  // Keep one entry if you only want to study agent appearance.
  prompts: [
    { id: "suggestion", text: "I suggest the {direction} door." },
    { id: "confident", text: "Trust me. Choose the {direction} door." }
  ]
};
