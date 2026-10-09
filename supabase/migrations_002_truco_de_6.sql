-- Habilita salas de 6 (3 contra 3). Correr una vez sobre una base creada con la versión anterior del esquema.
alter table public.rooms drop constraint if exists rooms_players_check;
alter table public.rooms add constraint rooms_players_check check (players in (2, 4, 6));
alter table public.room_players drop constraint if exists room_players_seat_check;
alter table public.room_players add constraint room_players_seat_check check (seat between 0 and 5);
