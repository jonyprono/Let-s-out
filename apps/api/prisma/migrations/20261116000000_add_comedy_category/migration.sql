-- Migration: catégorie distincte « Comédie » (COMEDY).
-- Avant : « Comédie » et « Jeux vidéos & jeux de société » partageaient GAMING.
-- Les événements existants restent en GAMING (aucune donnée modifiée).
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'COMEDY';
