'use strict';

/**
 * trip-request controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::trip-request.trip-request', () => ({
  async create(ctx) {
    // The status is always set server-side so a client can never
    // create a request directly in the "contacted" or "closed" state.
    const body = ctx.request.body && typeof ctx.request.body === 'object' ? ctx.request.body : {};

    const data =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};

    ctx.request.body = { ...body, data: { ...data, status: 'new' } };

    const response = await super.create(ctx);

    return response;
  },
}));