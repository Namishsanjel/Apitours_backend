'use strict';

/**
 * trip-request service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::trip-request.trip-request');