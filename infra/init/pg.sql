-- Initialize Medusa database
-- This script runs automatically when the database container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database if not exists (handled by POSTGRES_DB env var)
-- Additional setup can be added here as needed

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Medusa database initialized successfully';
END
$$;
