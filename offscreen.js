let cycleTimer = null;
let rampTimer = null;
let currentLevel = 1;
let startedAt = 0;
let audio = null;

// Starting a new beep stops the previous one; Chrome then rejects the previous play() with an AbortError.
// That is expected, not a failure. Real failures are logged with their name and message.
function playSafely(element) {
  element.play().catch((error) => {
    if (error?.name === "AbortError") return;
    console.error(`AOG Watcher audio failed: ${error?.name ?? "Error"}: ${error?.message ?? error}`);
  });
}

function beep(level) {
  const names = ["", "soft", "medium", "loud", "urgent"];
  audio?.pause();
  audio = new Audio(chrome.runtime.getURL(`assets/audio/alert_${names[level]}.wav`));
  audio.volume = [0, 0.3, 0.6, 0.9, 1][level];
  playSafely(audio);
}

function playEscalate() {
  stop();
  startedAt = Date.now();
  currentLevel = 1;
  beep(currentLevel);
  cycleTimer = setInterval(() => {
    currentLevel = Math.min(4, 1 + Math.floor((Date.now() - startedAt) / 15000));
    beep(currentLevel);
  }, 3000);
}

function playGentle() {
  stop();
  startedAt = Date.now();
  audio = new Audio(chrome.runtime.getURL("assets/audio/gentle_loop.wav"));
  audio.loop = true;
  audio.volume = 0.2;
  playSafely(audio);
  rampTimer = setInterval(() => {
    if (!audio) return;
    const elapsed = Date.now() - startedAt;
    audio.volume = Math.min(0.7, 0.2 + (elapsed / 60_000) * 0.5);
  }, 1000);
}

function play(mode = "gentle") {
  if (mode === "escalate") playEscalate();
  else playGentle();
}

function stop() {
  if (cycleTimer) clearInterval(cycleTimer);
  if (rampTimer) clearInterval(rampTimer);
  cycleTimer = null;
  rampTimer = null;
  audio?.pause();
  audio = null;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUDIO_PLAY") play(message.mode);
  if (message.type === "AUDIO_STOP") stop();
});
