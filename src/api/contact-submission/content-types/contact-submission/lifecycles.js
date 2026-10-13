'use strict';

/**
 * contact-submission lifecycle
 *
 * Sends an email notification after a contact message is created.
 * The send is deliberately fire-and-forget so the visitor's HTTP response
 * is never delayed by the SMTP round-trip, and a mail failure never fails
 * the submission. See src/utils/notify.js.
 */

const { notifyContactSubmission } = require('../../../../utils/notify');

module.exports = {
  afterCreate(event) {
    notifyContactSubmission(event && event.result).catch(() => {
      // notify.js already logs; this only guards against an unhandled
      // rejection if it ever throws synchronously.
    });
  },
};
