-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Extras: public reviews feed, file notes column
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.project_files add column if not exists content_note text not null default '';

create or replace function public.public_reviews()
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'rating', r.rating, 'clarity', r.clarity, 'usefulness', r.usefulness,
      'recommendation', r.recommendation, 'comment', r.comment, 'status', r.status,
      'consent_to_publish', r.consent_to_publish, 'show_name', r.show_name,
      'client_name', case when r.show_name then coalesce(p.full_name, 'Klient') else 'Klient i verifikuar' end,
      'consultant_name', coalesce(c.display_name, ''),
      'service_name', coalesce(a.service_name, 'Konsulencë'),
      'created_at', r.created_at)
    order by r.created_at desc)
  from reviews r
  left join profiles p on p.id = r.client_id
  left join consultants c on c.id = r.consultant_id
  left join appointments a on a.id = r.appointment_id
  where r.status = 'published' and r.consent_to_publish), '[]'::jsonb);
end $$;

grant execute on function public.public_reviews() to anon, authenticated;
