-- Migration: Add username to users table
-- Run this in Supabase SQL Editor

ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
CREATE INDEX idx_users_username ON users(username);
