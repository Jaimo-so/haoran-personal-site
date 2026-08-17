-- Migration: add unlisted and soft-delete support without relying on status CHECK changes
-- Run this in Cloudflare D1 via wrangler d1 execute/apply.

ALTER TABLE posts ADD COLUMN is_hidden INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN deleted_at INTEGER;

-- If a newer database already stored deleted rows through status,
-- backfill deleted_at so application code can rely on a single field.
UPDATE posts
SET deleted_at = COALESCE(deleted_at, updated_at, published_at)
WHERE status = 'deleted' AND deleted_at IS NULL;
