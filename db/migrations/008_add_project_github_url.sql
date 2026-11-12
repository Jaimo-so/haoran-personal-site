-- Apply once to an existing managed_projects table. Existing URLs are preserved.
ALTER TABLE managed_projects ADD COLUMN github_url TEXT NOT NULL DEFAULT '';
