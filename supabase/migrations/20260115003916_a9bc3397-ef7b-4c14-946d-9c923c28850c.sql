-- Allow public to read limited lead info for questionnaire validation
CREATE POLICY "Public can read lead by questionnaire token"
ON public.leads
FOR SELECT
USING (questionnaire_token IS NOT NULL AND questionnaire_completed_at IS NULL);

-- Allow public to update lead questionnaire_completed_at when submitting
CREATE POLICY "Public can mark questionnaire completed"
ON public.leads
FOR UPDATE
USING (questionnaire_token IS NOT NULL AND questionnaire_completed_at IS NULL)
WITH CHECK (questionnaire_token IS NOT NULL);