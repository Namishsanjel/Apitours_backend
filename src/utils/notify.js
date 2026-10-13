'use strict';

/**
 * Shared email-notification helper for the public form submissions
 * (`contact-submission` and `trip-request`).
 *
 * Required environment variables (see .env.example):
 *   SMTP_HOST       - SMTP server hostname. Notifications are skipped when missing.
 *   SMTP_PORT       - SMTP port (465 enables `secure`).
 *   SMTP_USERNAME   - SMTP username.
 *   SMTP_PASSWORD   - SMTP password.
 *   EMAIL_FROM      - default sender address.
 *   EMAIL_REPLY_TO  - default reply-to address (falls back to EMAIL_FROM).
 *   NOTIFY_EMAIL    - recipient(s) for notifications, comma-separated.
 *                     Notifications are skipped when missing.
 *
 * Design rules:
 *   - Never throw: a failed notification must never break a form submission.
 *   - Never log credentials.
 *   - Visitor-supplied text is HTML-escaped, because it is untrusted input.
 */

const FIELD_LABELS = {
  name: 'Name',
  email: 'Email',
  tour: 'Tour',
  travelDate: 'Travel date',
  destination: 'Destination',
  group: 'Group size',
  preferences: 'Preferences',
  budget: 'Budget per person',
  message: 'Message',
};

// Known fields first, in a stable order, then anything unexpected.
const FIELD_ORDER = [
  'name',
  'email',
  'tour',
  'travelDate',
  'destination',
  'group',
  'preferences',
  'budget',
  'message',
];

// Bookkeeping fields that must never appear in a notification.
const INTERNAL_FIELDS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'status',
  'locale',
  '__component',
  '__typename',
]);

const EMAIL_PATTERN = /^[^\s@<>()[\],;:\\"]+@[^\s@<>()[\],;:\\"]+\.[A-Za-z]{2,}$/;

// Warn about missing configuration once per process rather than on every
// submission, so a misconfigured server does not flood the log.
let missingConfigWarned = false;

/**
 * Escapes the five characters that can break out of HTML text or an
 * attribute. Applied to every visitor-supplied value before it reaches
 * the HTML body.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapses line breaks and other control characters into single spaces. */
function stripLineBreaks(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\r\n\t\v\f]+/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, '')
    .trim();
}

/**
 * Renders a value for display. Dates are trimmed to `YYYY-MM-DD` from the
 * stored ISO string rather than parsed, so the day is never shifted by the
 * server's timezone.
 */
function displayValue(value) {
  if (typeof value === 'string') {
    const isoDate = /^(\d{4}-\d{2}-\d{2})T/.exec(value.trim());

    if (isoDate) {
      return isoDate[1];
    }
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}

function labelFor(key) {
  if (FIELD_LABELS[key]) {
    return FIELD_LABELS[key];
  }

  // Fallback: "travelDate" -> "Travel date"
  const spaced = key.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Collects every filled-in, non-internal field as a `{ label, value }` pair.
 */
function collectFields(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const seen = new Set();
  const rows = [];

  const push = (key) => {
    if (seen.has(key) || INTERNAL_FIELDS.has(key) || !Object.hasOwn(source, key)) {
      return;
    }

    seen.add(key);

    const value = displayValue(source[key]);

    if (!value) {
      return;
    }

    rows.push({ label: labelFor(key), value });
  };

  FIELD_ORDER.forEach(push);

  Object.keys(source).forEach(push);

  return rows;
}

function buildTextBody(entry) {
  const rows = collectFields(entry);

  if (!rows.length) {
    return 'A new submission was received, but it contained no readable fields.';
  }

  return rows.map(({ label, value }) => `${label}: ${value}`).join('\n');
}

function buildHtmlBody(entry) {
  const rows = collectFields(entry);
  const cellStyle = 'padding: 6px 12px 6px 0; vertical-align: top;';
  const valueStyle = 'padding: 6px 0; vertical-align: top;';

  const tableRows = rows.length
    ? rows
        .map(
          ({ label, value }) =>
            `      <tr>\n` +
            `        <th align="left" style="${cellStyle}">${escapeHtml(label)}</th>\n` +
            `        <td style="${valueStyle}">${escapeHtml(value).replace(/\r?\n/g, '<br />')}</td>\n` +
            `      </tr>`
        )
        .join('\n')
    : `      <tr>\n        <td colspan="2" style="${valueStyle}">` +
      `A new submission was received, but it contained no readable fields.` +
      `</td>\n      </tr>`;

  return [
    '<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1c1c1c;">',
    '  <p style="margin: 0 0 12px;">A new submission was received through the website.</p>',
    '  <table cellpadding="0" cellspacing="0" style="border-collapse: collapse;">',
    tableRows,
    '  </table>',
    '</div>',
  ].join('\n');
}

/** Splits the comma-separated NOTIFY_EMAIL list into valid addresses. */
function parseRecipients(raw) {
  return String(raw)
    .split(',')
    .map((entry) => stripLineBreaks(entry))
    .filter((entry) => EMAIL_PATTERN.test(entry));
}

/**
 * Returns the visitor's address for `replyTo`, or '' when it is absent or
 * not a valid email. Line breaks are stripped before validating so a value
 * cannot inject extra mail headers.
 */
function safeReplyTo(value) {
  const candidate = stripLineBreaks(value);

  if (!candidate || candidate.length > 254 || !EMAIL_PATTERN.test(candidate)) {
    return '';
  }

  return candidate;
}

/** Defensive redaction so a password can never reach the log. */
function redact(text, secret) {
  const message = String(text === undefined || text === null ? '' : text);

  if (!secret) {
    return message;
  }

  return message.split(secret).join('[redacted]');
}

/**
 * Sends one notification. Resolves (never rejects) so callers can safely
 * fire it without awaiting the SMTP round-trip.
 */
async function sendSubmissionEmail({ entry, subject, kind }) {
  if (!process.env.SMTP_HOST || !process.env.NOTIFY_EMAIL) {
    if (!missingConfigWarned) {
      missingConfigWarned = true;
      strapi.log.warn(
        '[notify] Email notifications are disabled because SMTP_HOST and/or NOTIFY_EMAIL ' +
          'are not set. Submission was still saved. See .env.example for the required variables.'
      );
    }

    return { sent: false, reason: 'missing-config' };
  }

  const to = parseRecipients(process.env.NOTIFY_EMAIL);

  if (!to.length) {
    if (!missingConfigWarned) {
      missingConfigWarned = true;
      strapi.log.warn(
        '[notify] Email notifications are disabled because NOTIFY_EMAIL contains no valid ' +
          'email address. Submission was still saved.'
      );
    }

    return { sent: false, reason: 'invalid-recipient' };
  }

  const payload = {
    to,
    subject: stripLineBreaks(subject),
    text: buildTextBody(entry),
    html: buildHtmlBody(entry),
  };

  const replyTo = safeReplyTo(entry && entry.email);

  if (replyTo) {
    payload.replyTo = replyTo;
  }

  try {
    await strapi.plugin('email').service('email').send(payload);

    strapi.log.info(
      `[notify] Sent "${kind}" notification to ${to.length} recipient(s), subject "${payload.subject}".`
    );

    return { sent: true };
  } catch (error) {
    // Logged without the SMTP password and without the raw error object,
    // which can embed provider configuration.
    strapi.log.error(
      `[notify] Failed to send "${kind}" notification (subject "${payload.subject}"): ` +
        redact(error && error.message ? error.message : error, process.env.SMTP_PASSWORD)
    );

    return { sent: false, reason: 'send-failed' };
  }
}

function firstLine(value) {
  return stripLineBreaks(value);
}

/** Subject for a contact-submission entry. */
function contactSubmissionSubject(entry) {
  const name = firstLine(entry && entry.name) || 'someone';

  return `New contact message from ${name}`;
}

/** Subject for a trip-request entry, with an optional destination suffix. */
function tripRequestSubject(entry) {
  const name = firstLine(entry && entry.name) || 'someone';
  const destination = firstLine(entry && entry.destination);
  const subject = `New trip request from ${name}`;

  return destination ? `${subject} - ${destination}` : subject;
}

/**
 * afterCreate handler for `contact-submission`.
 * Intentionally not awaited by the lifecycle, so the API response is not
 * delayed by the SMTP round-trip.
 */
function notifyContactSubmission(entry) {
  return sendSubmissionEmail({
    entry,
    subject: contactSubmissionSubject(entry),
    kind: 'contact-submission',
  });
}

/**
 * afterCreate handler for `trip-request`.
 * Intentionally not awaited by the lifecycle.
 */
function notifyTripRequest(entry) {
  return sendSubmissionEmail({
    entry,
    subject: tripRequestSubject(entry),
    kind: 'trip-request',
  });
}

module.exports = {
  notifyContactSubmission,
  notifyTripRequest,
  // Exported for reuse and testing.
  buildHtmlBody,
  buildTextBody,
  collectFields,
  contactSubmissionSubject,
  escapeHtml,
  parseRecipients,
  safeReplyTo,
  stripLineBreaks,
  tripRequestSubject,
};
