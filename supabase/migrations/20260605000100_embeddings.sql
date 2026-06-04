-- ============================================================================
-- ip³ PV-Tool — Semantische Dokumentsuche (pgvector)
-- Embeddings (OpenAI text-embedding-3-small, 1536 Dim.) für den extrahierten
-- Datei-Volltext. Ermöglicht Bedeutungs-Suche statt nur Stichwort.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- HINWEIS: Erfordert die Extension `vector` (in Supabase verfügbar).
-- ============================================================================

create extension if not exists vector;

alter table public.project_files       add column if not exists embedding vector(1536);
alter table public.product_assets      add column if not exists embedding vector(1536);
alter table public.service_ticket_files add column if not exists embedding vector(1536);

create index if not exists project_files_embedding_idx
  on public.project_files using hnsw (embedding vector_cosine_ops);
create index if not exists product_assets_embedding_idx
  on public.product_assets using hnsw (embedding vector_cosine_ops);
create index if not exists service_ticket_files_embedding_idx
  on public.service_ticket_files using hnsw (embedding vector_cosine_ops);

-- Ähnlichkeitssuche über alle Datei-Quellen. SECURITY INVOKER (Default) →
-- RLS der zugrunde liegenden Tabellen gilt für den aufrufenden Nutzer.
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (source text, name text, owner text, content text, similarity float)
language sql
stable
as $$
  with hits as (
    select 'Projekt'::text as source, pf.name,
           coalesce(p.title, 'Projekt') as owner,
           left(coalesce(pf.text_content, ''), 600) as content,
           1 - (pf.embedding <=> query_embedding) as similarity
    from public.project_files pf
    left join public.projects p on p.id = pf.project_id
    where pf.embedding is not null
    union all
    select 'Produkt'::text, pa.name,
           coalesce(pr.name, 'Produkt'),
           left(coalesce(pa.text_content, ''), 600),
           1 - (pa.embedding <=> query_embedding)
    from public.product_assets pa
    left join public.products pr on pr.id = pa.product_id
    where pa.embedding is not null
    union all
    select 'Service'::text, sf.name,
           coalesce(t.title, 'Ticket'),
           left(coalesce(sf.text_content, ''), 600),
           1 - (sf.embedding <=> query_embedding)
    from public.service_ticket_files sf
    left join public.service_tickets t on t.id = sf.ticket_id
    where sf.embedding is not null
  )
  select * from hits order by similarity desc limit match_count;
$$;
