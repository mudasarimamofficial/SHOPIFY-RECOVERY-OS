-- Create the storage bucket for recovery packages
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recovery_packages',
  'recovery_packages',
  false,
  5368709120, -- 5GB
  '{application/zip,application/x-zip-compressed,application/json,application/octet-stream}'
)
on conflict (id) do nothing;



-- Policies for recovery_packages
create policy "Users can view their own recovery packages"
on storage.objects for select
to authenticated
using ( bucket_id = 'recovery_packages' and (auth.uid() = owner) );

create policy "Users can insert their own recovery packages"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'recovery_packages' and (auth.uid() = owner) );

create policy "Users can delete their own recovery packages"
on storage.objects for delete
to authenticated
using ( bucket_id = 'recovery_packages' and (auth.uid() = owner) );

-- Service role bypasses RLS naturally, but just in case, we could add explicit policies
create policy "Service role has full access to recovery_packages"
on storage.objects for all
to service_role
using ( bucket_id = 'recovery_packages' )
with check ( bucket_id = 'recovery_packages' );
