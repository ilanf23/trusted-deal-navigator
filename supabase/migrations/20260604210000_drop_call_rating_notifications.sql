-- Remove the call-rating-notifications feature.
-- The in-app "Call Ratings" surfaces (Messages tab, TeamPerformance widgets, feed
-- notifications) and the AI call-scoring step in call-to-lead-automation have all
-- been removed. This append-only notification store is no longer written or read.
DROP TABLE IF EXISTS public.call_rating_notifications;
