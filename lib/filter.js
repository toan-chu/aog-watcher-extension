function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function senderMatches(sender, rule) {
  const target = normalized(sender);
  const needle = normalized(rule).replace(/^@/, "");
  if (!target || !needle) return false;
  if (target.includes("@")) {
    const domain = target.split("@").pop();
    return target === needle || domain === needle || domain.endsWith(`.${needle}`);
  }
  return target.includes(needle);
}

export function shouldSkipEmail(alert, config) {
  const sender = normalized(alert?.sender);
  const subject = normalized(alert?.subject);
  const whitelist = (config?.sender_whitelist ?? []).map(normalized).filter(Boolean);
  if (whitelist.length > 0 && !whitelist.some((rule) => senderMatches(sender, rule))) return true;
  const domains = (config?.skip_sender_domains ?? []).map(normalized).filter(Boolean);
  if (domains.some((domain) => senderMatches(sender, domain))) return true;
  const keywords = (config?.subject_keywords ?? []).map(normalized).filter(Boolean);
  return keywords.length > 0 && !keywords.some((keyword) => subject.includes(keyword));
}

export function isCoordGroup(groupName, config) {
  const coord = normalized(config?.coord_group);
  return Boolean(coord) && normalized(groupName) === coord;
}

export function shouldAlertWhatsAppGroup(groupName, config) {
  if (isCoordGroup(groupName, config)) return false;
  const target = normalized(groupName);
  return (config?.customer_groups ?? []).some((group) => normalized(group) === target);
}
