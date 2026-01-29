type BuildInboundTwiMLOptions = {
  holdMessage: string;
  dialTimeoutSeconds: number;
  statusCallbackUrl?: string;
  clientIdentities: string[];
};

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildInboundTwiML(opts: BuildInboundTwiMLOptions) {
  const identities = opts.clientIdentities.filter(Boolean);

  const statusAttrs = opts.statusCallbackUrl
    ? ` statusCallback="${escapeXml(opts.statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed"`
    : '';

  const recordingAttrs = opts.statusCallbackUrl
    ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(opts.statusCallbackUrl)}" recordingStatusCallbackEvent="completed" action="${escapeXml(opts.statusCallbackUrl)}"`
    : '';

  const dialTargets = identities.length
    ? identities
        .map(
          (identity) =>
            `    <Client${statusAttrs}>\n      <Identity>${escapeXml(identity)}</Identity>\n    </Client>`
        )
        .join('\n')
    : '';

  // IMPORTANT:
  // - Always return valid TwiML
  // - Never depend on DB or external calls to generate this
  // - Keep it simple and stable
  const hold = escapeXml(opts.holdMessage);

  if (!dialTargets) {
    // No dial targets configured: keep caller alive with a long pause.
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${hold}</Say>
  <Pause length="60" />
  <Say voice="alice">We are still trying to connect your call.</Say>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${hold}</Say>
  <Dial timeout="${opts.dialTimeoutSeconds}" answerOnBridge="true"${recordingAttrs}>
${dialTargets}
  </Dial>
  <Say voice="alice">We\'re sorry, no one is available to take your call right now. Please leave a message after the beep, or try again later.</Say>
  <Record maxLength="120" transcribe="false"${
    opts.statusCallbackUrl
      ? ` recordingStatusCallback="${escapeXml(opts.statusCallbackUrl)}"`
      : ''
  } />
  <Say voice="alice">Thank you for your message. Goodbye.</Say>
</Response>`;
}
