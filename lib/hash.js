function rotateLeft(value, count) {
  return (value << count) | (value >>> (32 - count));
}

function addUnsigned(a, b) {
  return (a + b) >>> 0;
}

function utf8Bytes(input) {
  return new TextEncoder().encode(String(input));
}

export function md5(input) {
  const bytes = [...utf8Bytes(input)];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i += 1) bytes.push(Math.floor(bitLength / 2 ** (8 * i)) & 0xff);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) => {
      const j = offset + i * 4;
      return (bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24)) >>> 0;
    });
    let a = a0; let b = b0; let c = c0; let d = d0;
    for (let i = 0; i < 64; i += 1) {
      let f; let g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const nextD = d;
      d = c;
      c = b;
      b = addUnsigned(b, rotateLeft(addUnsigned(addUnsigned(a, f >>> 0), addUnsigned(constants[i], words[g])), shifts[i]));
      a = nextD;
    }
    a0 = addUnsigned(a0, a); b0 = addUnsigned(b0, b); c0 = addUnsigned(c0, c); d0 = addUnsigned(d0, d);
  }

  return [a0, b0, c0, d0].flatMap((value) => [0, 8, 16, 24].map((shift) => ((value >>> shift) & 0xff).toString(16).padStart(2, "0"))).join("");
}

export function deterministicAlertId(alert) {
  const source = String(alert?.source ?? "unknown");
  if (source === "email") return `email-${md5(alert.message_id || `${alert.sender}|${alert.subject}|${alert.received_at}`)}`;
  const timestamp = new Date(alert?.detected_at ?? Date.now());
  timestamp.setSeconds(0, 0);
  return `wa-${md5(`${alert?.group_name ?? ""}|${alert?.message_text ?? ""}|${timestamp.toISOString()}`)}`;
}

