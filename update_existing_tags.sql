-- Update all existing tags to remove spaces and be lowercase
UPDATE public.creator_tags
SET tag = LOWER(REPLACE(tag, ' ', ''));
