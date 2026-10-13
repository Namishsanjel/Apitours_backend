'use strict';

/**
 * trip-request router
 *
 * Only the create action is exposed, so requests can be submitted
 * publicly but never listed, read, updated or deleted through the API.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::trip-request.trip-request', {
  only: ['create'],
});