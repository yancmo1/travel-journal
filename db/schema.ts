import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const createdAt = text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  createdAt,
});

export const households = sqliteTable('households', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt,
  updatedAt,
});

export const householdMembers = sqliteTable('household_members', {
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt,
}, table => [
  uniqueIndex('idx_household_members_household_user').on(table.householdId, table.userId),
  index('idx_household_members_user_id').on(table.userId),
]);

export const travelers = sqliteTable('travelers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  relationship: text('relationship').notNull().default('other'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt,
}, table => [
  index('idx_travelers_household_id').on(table.householdId),
]);

export const journeys = sqliteTable('journeys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  dateLabel: text('date_label'),
  journeyType: text('journey_type').notNull().default('Other'),
  summary: text('summary'),
  coverPhotoId: integer('cover_photo_id'),
  shareToken: text('share_token'),
  shareExpiresAt: text('share_expires_at'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
}, table => [
  index('idx_journeys_household_id').on(table.householdId),
  uniqueIndex('idx_journeys_share_token').on(table.shareToken),
]);

export const trips = sqliteTable('trips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  locationName: text('location_name').notNull(),
  city: text('city'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  country: text('country'),
  state: text('state'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  dateLabel: text('date_label'),
  datePrecision: text('date_precision').notNull().default('exact'),
  tripType: text('trip_type').notNull().default('Other'),
  notes: text('notes'),
  journeyId: integer('journey_id').references(() => journeys.id, { onDelete: 'set null' }),
  journeyOrder: integer('journey_order'),
  homeDistanceMiles: real('home_distance_miles'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
}, table => [
  index('idx_trips_household_id').on(table.householdId),
  index('idx_trips_household_start_date').on(table.householdId, table.startDate),
  index('idx_trips_journey_id').on(table.journeyId),
]);

export const tripTravelers = sqliteTable('trip_travelers', {
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  travelerId: integer('traveler_id').notNull().references(() => travelers.id, { onDelete: 'cascade' }),
}, table => [
  uniqueIndex('idx_trip_travelers_trip_traveler').on(table.tripId, table.travelerId),
  index('idx_trip_travelers_traveler_id').on(table.travelerId),
]);

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull().unique(),
  thumbnailR2Key: text('thumbnail_r2_key'),
  originalFilename: text('original_filename').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  dateTaken: text('date_taken'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  isCover: integer('is_cover', { mode: 'boolean' }).notNull().default(false),
  rotation: integer('rotation').notNull().default(0),
  uploadedAt: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index('idx_photos_household_id').on(table.householdId),
  index('idx_photos_trip_sort_order').on(table.tripId, table.sortOrder),
]);
