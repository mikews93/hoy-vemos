-- "Darle play juntos": la cuenta regresiva viaja por un canal privado de Realtime (broadcast) llamado play-<hogar>.
-- Solo quien es del hogar puede escucharlo o mandar por él. Sin esta migración el botón no llega al otro teléfono.
create policy "hogar escucha su play" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'play-' || (select household_id::text from public.profiles where id = auth.uid())
  );

create policy "hogar manda su play" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'play-' || (select household_id::text from public.profiles where id = auth.uid())
  );
