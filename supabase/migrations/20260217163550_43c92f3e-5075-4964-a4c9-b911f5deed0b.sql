
-- Create rate_limits table for distributed rate limiting
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  function_name text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_address, function_name)
);

-- Enable RLS with no policies = service_role only
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (ip_address, function_name);

-- Periodic cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '5 minutes';
$$;

-- Atomic rate limit check-and-increment function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip text,
  p_func text,
  p_limit int,
  p_window_secs int
)
RETURNS TABLE(allowed boolean, current_count int, retry_after int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_window interval := (p_window_secs || ' seconds')::interval;
BEGIN
  INSERT INTO rate_limits (ip_address, function_name, request_count, window_start)
  VALUES (p_ip, p_func, 1, v_now)
  ON CONFLICT (ip_address, function_name)
  DO UPDATE SET
    request_count = CASE
      WHEN rate_limits.window_start + v_window < v_now THEN 1
      ELSE rate_limits.request_count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start + v_window < v_now THEN v_now
      ELSE rate_limits.window_start
    END
  RETURNING * INTO v_row;

  IF v_row.request_count > p_limit THEN
    RETURN QUERY SELECT
      false,
      v_row.request_count,
      GREATEST(1, EXTRACT(EPOCH FROM (v_row.window_start + v_window - v_now))::int);
  ELSE
    RETURN QUERY SELECT true, v_row.request_count, 0;
  END IF;
END;
$$;
