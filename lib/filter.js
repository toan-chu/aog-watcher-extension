function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function shouldSkipEmail(alert, config) {
  const sender = normalized(alert?.sender);
  const subject = normalized(alert?.subject);
  const domains = (config?.skip_sender_domains ?? []).map(normalized).filter(Boolean);
  if (domains.some((domain) => sender === domain || sender.endsWith(`@${domain}`))) return true;
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

