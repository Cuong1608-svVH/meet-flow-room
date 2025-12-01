-- Add is_screen_sharing column to room_participants table
ALTER TABLE public.room_participants
ADD COLUMN is_screen_sharing BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX idx_room_participants_screen_sharing 
ON public.room_participants(room_id, is_screen_sharing) 
WHERE is_screen_sharing = TRUE;