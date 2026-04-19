-- PostgreSQL initialization script for PMS
-- This script runs automatically when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Set default search path
ALTER DATABASE pms_dev SET search_path TO public;

-- Create schema if not exists (Prisma will create tables)
CREATE SCHEMA IF NOT EXISTS public;

-- Log initialization
DO $$ BEGIN
  RAISE NOTICE 'PostgreSQL initialization completed for PMS';
END $$;
