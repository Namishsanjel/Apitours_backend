'use strict';

/**
 * contact-submission controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::contact-submission.contact-submission', () => ({
  async create(ctx) {
    // The status is always set server-side so a client can never
    // create a submission directly in the "contacted" or "closed" state.
    const body = ctx.request.body && typeof ctx.request.body === 'object' ? ctx.request.body : {};

    const data =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};

    ctx.request.body = { ...body, data: { ...data, status: 'new' } };

    const response = await super.create(ctx);

    return response;
  },
}));
