revoke all on function public.is_room_member(text), public.is_room_host(text) from public, anon;
grant execute on function public.is_room_member(text), public.is_room_host(text) to authenticated;
