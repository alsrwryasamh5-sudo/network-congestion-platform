-- =====================================================
-- Network Congestion Detection Platform
-- PostgreSQL initialization script
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tables are created by SQLAlchemy's db.create_all() on backend startup.
-- This script is kept for manual inspection / extension.

-- Useful views for analytics
CREATE OR REPLACE VIEW view_congestion_summary AS
SELECT
    DATE(detected_at) AS day,
    severity,
    COUNT(*) AS event_count,
    AVG(culprit_score) AS avg_culprit_score
FROM congestion_events
GROUP BY DATE(detected_at), severity
ORDER BY day DESC;

CREATE OR REPLACE VIEW view_user_activity AS
SELECT
    u.username,
    u.role,
    COUNT(DISTINCT p.id) AS prediction_count,
    COUNT(DISTINCT e.id) AS experiment_count,
    MAX(a.created_at) AS last_activity
FROM users u
LEFT JOIN predictions p ON p.user_id = u.id
LEFT JOIN experiments e ON e.user_id = u.id
LEFT JOIN activity_logs a ON a.user_id = u.id
GROUP BY u.id, u.username, u.role
ORDER BY last_activity DESC NULLS LAST;
