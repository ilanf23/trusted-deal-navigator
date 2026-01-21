-- Add loan_size_text column for text-based loan ranges like "$100M to $20MM"
ALTER TABLE public.lender_programs 
ADD COLUMN loan_size_text text;