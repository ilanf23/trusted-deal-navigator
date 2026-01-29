-- Add a policy to allow all authenticated users to view pipelines
CREATE POLICY "Authenticated users can view all pipelines"
ON public.pipelines
FOR SELECT
USING (auth.uid() IS NOT NULL);