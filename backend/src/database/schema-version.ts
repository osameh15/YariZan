// Number of reviewed schema migrations in this release (001 … 018). /ready, the release
// manifest and the restore drill compare schema_migrations against this exact value.
export const SCHEMA_MIGRATION_COUNT = 18;
export const migrationFilePattern = /^\d{3}_[a-z_]+\.sql$/;
