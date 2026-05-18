ALTER TABLE public.content_uploads
  ADD COLUMN IF NOT EXISTS calendar_date date NOT NULL DEFAULT current_date;

CREATE INDEX IF NOT EXISTS idx_content_uploads_calendar_date
  ON public.content_uploads (user_id, calendar_date);