let cycleTimer = null;
let currentLevel = 1;
let startedAt = 0;
let audio = null;

function beep(level) {
  const names = ["", "soft", "medium", "loud", "urgent"];
  audio?.pause();
  audio = new Audio(chrome.runtime.getURL(`assets/audio/alert_${names[level]}.wav`));
  audio.volume = [0, 0.3, 0.6, 0.9, 1][level];
  audio.play().catch((error) => console.error("AOG Watcher audio failed", error));
}

function play() {
  stop();
  startedAt = Date.now();
  currentLevel = 1;
  beep(currentLevel);
  cycleTimer = setInterval(() => {
    currentLevel = Math.min(4, 1 + Math.floor((Date.now() - startedAt) / 15000));
    beep(currentLevel);
  }, 3000);
}

function stop() { if (cycleTimer) clearInterval(cycleTimer); cycleTimer = null; audio?.pause(); audio = null; }

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUDIO_PLAY") play();
  if (message.type === "AUDIO_STOP") stop();
});
