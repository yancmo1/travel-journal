import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const createdAt = text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  emailVerifiedAt: text('email_verified_at'),
  siteAdmin: integer('site_admin', { mode: 'boolean' }).notNull().default(false),
  passwordHash: text('password_hash').notNull(),
  passwordUpdatedAt: text('password_updated_at'),
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

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: integer('household_id').references(() => households.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt,
  lastSeenAt: text('last_seen_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_expires_at').on(table.expiresAt),
]);

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  role: text('role').notNull().default('member'),
  invitedBy: integer('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt,
}, table => [
  index('idx_invitations_household_email').on(table.householdId, table.email),
  index('idx_invitations_expires_at').on(table.expiresAt),
]);

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt,
}, table => [
  index('idx_password_reset_user_id').on(table.userId),
  index('idx_password_reset_expires_at').on(table.expiresAt),
]);

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt,
}, table => [
  index('idx_email_verification_user_id').on(table.userId),
  index('idx_email_verification_expires_at').on(table.expiresAt),
]);

export const authRateLimits = sqliteTable('auth_rate_limits', {
  key: text('key').primaryKey(),
  action: text('action').notNull(),
  attempts: integer('attempts').notNull().default(0),
  windowStartedAt: text('window_started_at').notNull(),
}, table => [
  index('idx_auth_rate_limits_action_window').on(table.action, table.windowStartedAt),
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
  index('idx_journeys_household_start_date_id').on(table.householdId, table.startDate, table.id),
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
  index('idx_trips_household_start_date_id').on(table.householdId, table.startDate, table.id),
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
  clientUploadId: text('client_upload_id').unique(),
  displayR2Key: text('display_r2_key'),
  thumbnailR2Key: text('thumbnail_r2_key'),
  originalFilename: text('original_filename').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  width: integer('width'),
  height: integer('height'),
  checksum: text('checksum'),
  processingStatus: text('processing_status').notNull().default('ready'),
  processingVersion: integer('processing_version').notNull().default(1),
  processingError: text('processing_error'),
  metadataSource: text('metadata_source').notNull().default('client'),
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
  index('idx_photos_household_trip_cover_sort').on(table.householdId, table.tripId, table.isCover, table.sortOrder, table.id),
  index('idx_photos_processing_status').on(table.processingStatus, table.uploadedAt),
]);

export const uploadReservations = sqliteTable('upload_reservations', {
  id: text('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  clientUploadId: text('client_upload_id').notNull(),
  reservationToken: text('reservation_token').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt,
}, table => [
  uniqueIndex('idx_upload_reservations_household_client').on(table.householdId, table.clientUploadId),
  index('idx_upload_reservations_household_expires_at').on(table.householdId, table.expiresAt),
]);

export const photoUploadSessions = sqliteTable('photo_upload_sessions', {
  id: text('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  clientUploadId: text('client_upload_id').notNull(),
  reservationToken: text('reservation_token').notNull(),
  originalKey: text('original_key').notNull().unique(),
  displayKey: text('display_key').unique(),
  thumbnailKey: text('thumbnail_key').unique(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  originalBytes: integer('original_bytes').notNull(),
  displayBytes: integer('display_bytes'),
  thumbnailBytes: integer('thumbnail_bytes'),
  originalChecksum: text('original_checksum'),
  displayChecksum: text('display_checksum'),
  thumbnailChecksum: text('thumbnail_checksum'),
  status: text('status').notNull().default('pending'),
  originalUploadedAt: text('original_uploaded_at'),
  displayUploadedAt: text('display_uploaded_at'),
  thumbnailUploadedAt: text('thumbnail_uploaded_at'),
  expiresAt: text('expires_at').notNull(),
  createdAt,
  updatedAt,
}, table => [
  uniqueIndex('idx_photo_upload_sessions_household_client').on(table.householdId, table.clientUploadId),
  index('idx_photo_upload_sessions_household_expires_at').on(table.householdId, table.expiresAt),
  index('idx_photo_upload_sessions_status_expires_at').on(table.status, table.expiresAt),
]);

export const dataExports = sqliteTable('data_exports', {
  id: text('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  requestedBy: integer('requested_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  phase: text('phase').notNull().default('preparing'),
  manifestKey: text('manifest_key'),
  mediaTotal: integer('media_total').notNull().default(0),
  mediaCopied: integer('media_copied').notNull().default(0),
  expiresAt: text('expires_at').notNull(),
  lastError: text('last_error'),
  createdAt,
  updatedAt,
}, table => [
  index('idx_data_exports_household_created_at').on(table.householdId, table.createdAt),
  index('idx_data_exports_status_updated_at').on(table.status, table.updatedAt),
]);

export const dataDeletions = sqliteTable('data_deletions', {
  id: text('id').primaryKey(),
  householdId: integer('household_id').references(() => households.id, { onDelete: 'set null' }),
  targetHouseholdId: integer('target_household_id').notNull(),
  requestedBy: integer('requested_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  phase: text('phase').notNull().default('preparing'),
  mediaPrefixIndex: integer('media_prefix_index').notNull().default(0),
  mediaCursor: text('media_cursor'),
  mediaDeleted: integer('media_deleted').notNull().default(0),
  lastError: text('last_error'),
  createdAt,
  updatedAt,
}, table => [
  index('idx_data_deletions_target_status').on(table.targetHouseholdId, table.status),
  index('idx_data_deletions_status_updated_at').on(table.status, table.updatedAt),
]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  householdId: integer('household_id').references(() => households.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  payload: text('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  availableAt: text('available_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  leaseExpiresAt: text('lease_expires_at'),
  idempotencyKey: text('idempotency_key').unique(),
  lastError: text('last_error'),
  createdAt,
  updatedAt,
}, table => [
  index('idx_jobs_household_status').on(table.householdId, table.status),
  index('idx_jobs_status_available_at').on(table.status, table.availableAt),
  index('idx_jobs_lease_expires_at').on(table.leaseExpiresAt),
]);

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  scopeKey: text('scope_key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  status: text('status').notNull().default('pending'),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  expiresAt: text('expires_at').notNull(),
  createdAt,
  updatedAt,
}, table => [
  index('idx_idempotency_keys_expires_at').on(table.expiresAt),
  index('idx_idempotency_keys_status_updated_at').on(table.status, table.updatedAt),
]);

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  householdId: integer('household_id').references(() => households.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  metadata: text('metadata'),
  createdAt,
}, table => [
  index('idx_audit_events_household_created_at').on(table.householdId, table.createdAt),
  index('idx_audit_events_user_created_at').on(table.userId, table.createdAt),
  index('idx_audit_events_action_created_at').on(table.action, table.createdAt),
]);

export const providerCache = sqliteTable('provider_cache', {
  cacheKey: text('cache_key').primaryKey(),
  provider: text('provider').notNull(),
  value: text('value').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt,
  updatedAt,
}, table => [
  index('idx_provider_cache_provider_updated_at').on(table.provider, table.updatedAt),
  index('idx_provider_cache_expires_at').on(table.expiresAt),
]);
