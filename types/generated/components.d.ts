import type { Schema, Struct } from '@strapi/strapi';

export interface TourItineraryDay extends Struct.ComponentSchema {
  collectionName: 'components_tour_itinerary_days';
  info: {
    displayName: 'itinerary-day';
    icon: 'calendar';
  };
  attributes: {
    body: Schema.Attribute.Text;
    day: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface TourListItem extends Struct.ComponentSchema {
  collectionName: 'components_tour_list_items';
  info: {
    displayName: 'list-item';
    icon: 'list';
  };
  attributes: {
    text: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'tour.itinerary-day': TourItineraryDay;
      'tour.list-item': TourListItem;
    }
  }
}
