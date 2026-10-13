'use strict';

/**
 * trip-request lifecycle
 *
 * Sends an email notification after a trip request is created.
 * The send is deliberately fire-and-forget so the visitor's HTTP response
 * is never delayed by the SMTP round-trip, and a mail failure never fails
 * the submission. See src/utils/notify.js.
 */

const { notifyTripRequest } = require('../../../../utils/notify');

module.exports = {
  afterCreate(event) {
    notifyTripRequest(event && event.result).catch(() => {
      // notify.js already logs; this only guards against an unhandled
      // rejection if it ever throws synchronously.
    });
  },
};
