-- AquaSentinel PostgreSQL / PostGIS Initialization Script
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Initialize PostGIS extension if available on the image
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PostGIS extension not available in standard image. Proceeding with standard relational GeoJSON support.';
END
$$;
