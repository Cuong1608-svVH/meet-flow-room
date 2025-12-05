-- Add is_hand_raised column to room_participants table
ALTER TABLE public.room_participants ADD COLUMN is_hand_raised BOOLEAN DEFAULT false;