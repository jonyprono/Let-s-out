-- Migration: Add GAMES and CONCERTS to EventCategory enum
-- TRAVEL was already present in the enum

ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'GAMES';
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'CONCERTS';
