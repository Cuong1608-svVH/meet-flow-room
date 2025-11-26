-- Drop the recursive RLS policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view participants in their room" ON room_participants;

-- Create new policy allowing authenticated users to view all room participants
-- This is necessary for a video conferencing app where participants need to see each other
CREATE POLICY "Authenticated users can view room participants" 
ON room_participants
FOR SELECT 
TO authenticated 
USING (true);