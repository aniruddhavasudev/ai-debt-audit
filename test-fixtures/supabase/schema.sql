alter table "public"."documents" disable row level security;
create policy "allow all" on documents using (true);
