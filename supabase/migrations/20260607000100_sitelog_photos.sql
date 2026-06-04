-- ============================================================================
-- ip³ PV-Tool — Bautagebuch: Foto-Verknüpfung + KI-Markierung
-- photo_ids: verknüpfte Fotos (project_files-IDs) zu einem Eintrag.
-- ai_generated: Eintrag wurde aus einem Foto per KI vorbefüllt.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.site_log add column if not exists photo_ids jsonb;
alter table public.site_log add column if not exists ai_generated boolean not null default false;
