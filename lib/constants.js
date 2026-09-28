export const TIMING = Object.freeze({
  PRIMARY_TIMEOUT_SECONDS: 120,
  BACKUP_DELAY_SECONDS: 180,
  MAX_ALERT_DURATION_SECONDS: 540,
  WAKE_LEVELS: 4,
  WAKE_ESCALATION_INTERVAL_SECONDS: 15,
  PEER_MATCH_WINDOW_SECONDS: 60,
  PEER_STALE_SECONDS: 600,
});

export const PEER_TAG = Object.freeze({
  ESCALATED: "[AOG-ESCALATED]",
  HANDLED: "[AOG-HANDLED]",
});

export const ALERT_SOURCE = Object.freeze({ WHATSAPP: "whatsapp", EMAIL: "email" });
export const ALERT_STATUS = Object.freeze({
  QUEUED: "QUEUED",
  ALERTING: "ALERTING",
  HANDLED: "HANDLED",
  SKIPPED: "SKIPPED",
  MISSED: "MISSED",
});
export const APP_STATE = Object.freeze({ IDLE: "IDLE", ALERTING: "ALERTING" });
export const ROLE = Object.freeze({ PRIMARY: "primary", BACKUP: "backup" });
export const HANDLED_BY = Object.freeze({ SELF: "self", PARTNER: "partner", MISSED: "missed" });

export const LEVEL_AUDIO_FILES = Object.freeze({
  1: "assets/audio/alert_soft.wav",
  2: "assets/audio/alert_medium.wav",
  3: "assets/audio/alert_loud.wav",
  4: "assets/audio/alert_urgent.wav",
});

export const LEVEL_VOLUMES = Object.freeze({ 1: 0.3, 2: 0.6, 3: 0.9, 4: 1 });
export const GENTLE_AUDIO_FILE = "assets/audio/gentle_loop.wav";

export const STORAGE_KEYS = Object.freeze({
  CONFIG: "aog_config",
  ROLE_SESSION: "aog_role_session",
  RUNTIME_STATE: "aog_runtime_state",
  EVENT_LOG: "aog_event_log",
  SHIFT_SESSIONS: "aog_shift_sessions",
  ESCALATED_ALERT_IDS: "aog_escalated_alert_ids",
  PEER_HANDLED_ALERT_IDS: "aog_peer_handled_alert_ids",
  SOURCE_HEALTH: "aog_source_health",
  SHIFT_BASELINE: "aog_shift_baseline",
  TEAM_GROUPS: "aog_team_groups",
  TEAM_GROUPS_SYNCED_AT: "aog_team_groups_synced_at",
  MACHINE_ID: "aog_machine_id",
  IDENTITY: "aog_identity",
  OUTBOX: "aog_outbox",
  SP_ITEM_CACHE: "aog_sp_item_cache",
  SIGNAL_CURSOR: "aog_signal_cursor",
  SEEN_SIGNALS: "aog_seen_signals",
  PEERS: "aog_peers",
  SP_STATUS: "aog_sp_status",
  SOURCE_EVAL: "aog_source_eval",
  SOURCE_TIMELINE: "aog_source_timeline",
  PREFLIGHT: "aog_preflight",
  SOUND_CONFIRMED_AT: "aog_sound_confirmed_at",
  BATTERY: "aog_battery",
  TICKS: "aog_ticks",
  FOLLOWUPS: "aog_followups",
  SYSTEM_ALERTS: "aog_system_alerts",
  UNKNOWN_CHATS: "aog_unknown_chats",
  REMINDER_STATE: "aog_reminder_state",
  AUDIO_ERROR_AT: "aog_audio_error_at",
});

export const DEFAULT_SHIFT_SLOTS = Object.freeze([
  Object.freeze({ start: "22:00", end: "02:30", role: "primary" }),
  Object.freeze({ start: "02:30", end: "07:00", role: "backup" }),
]);

export const DEFAULT_CONFIG = Object.freeze({
  test_mode: false,
  test_role: "primary",
  self_display_name: "",
  customer_groups: [],
  coord_group: "",
  shift_slots: DEFAULT_SHIFT_SLOTS.map((slot) => ({ ...slot })),
  skip_sender_domains: ["trustana.vn"],
  sender_whitelist: [],
  outlook_watch_path: "",
  subject_keywords: [],
  primary_timeout_seconds: 120,
  backup_delay_seconds: 180,
  max_alert_duration_seconds: 540,
  idle_threshold_seconds: 15,
  wake_audio_mode: "gentle",
  dry_run: false,
  // 5.0
  sharepoint_site_url: "",
  ignored_chats: [],
  unknown_chat_alert: true,
  followup_enabled: true,
  followup_after_minutes: 10,
  followup_answer_minutes: 5,
  peer_lost_minutes: 5,
  shift_reminder_grace_minutes: 10,
  blind_after_minutes: 5,
});

export const APP_VERSION = "5.0.0";

export const MESSAGE = Object.freeze({
  ALERT_DETECTED: "ALERT_DETECTED",
  PEER_TAG_RECEIVED: "PEER_TAG_RECEIVED",
  SEND_PEER_TAG: "SEND_PEER_TAG",
  ACK_CURRENT: "ACK_CURRENT",
  GET_STATUS: "GET_STATUS",
  STATUS_UPDATED: "STATUS_UPDATED",
  AUDIO_PLAY: "AUDIO_PLAY",
  AUDIO_STOP: "AUDIO_STOP",
  PREVIEW_AUDIO: "PREVIEW_AUDIO",
  CONTENT_HEALTH: "CONTENT_HEALTH",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  START_SHIFT: "START_SHIFT",
  BASELINE_SYNC: "BASELINE_SYNC",
  REBASELINE: "REBASELINE",
  UPDATE_SHIFT_SLOTS: "UPDATE_SHIFT_SLOTS",
  END_SHIFT: "END_SHIFT",
  UNKNOWN_CHAT_DECISION: "UNKNOWN_CHAT_DECISION",
  SYSTEM_ALERT_ACK: "SYSTEM_ALERT_ACK",
  FOLLOWUP_ANSWER: "FOLLOWUP_ANSWER",
  REPORT_LEAK: "REPORT_LEAK",
  TEST_SOUND: "TEST_SOUND",
  SOUND_CONFIRMED: "SOUND_CONFIRMED",
  REPORT_BATTERY: "REPORT_BATTERY",
  SP_TEST: "SP_TEST",
  SP_SETUP: "SP_SETUP",
  SYNC_NOW: "SYNC_NOW",
  SP_PUBLISH_SETTINGS: "SP_PUBLISH_SETTINGS",
});
