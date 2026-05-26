import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchCallRecordingBlobUrl } from '@/lib/callRecording';

interface CallRecordingPlayerProps {
  communicationId: string;
  /** When true, defer fetching the recording until the user clicks play.
   *  Avoids burning Twilio bandwidth on every list row that scrolls past. */
  lazy?: boolean;
  className?: string;
}

/**
 * Authenticated audio player for Twilio call recordings.
 *
 * Talks to the `call-recording-audio` edge function (which streams the audio
 * with server-side Basic auth) rather than rendering Twilio's private URL
 * directly. The fetched bytes are turned into a blob URL so the browser's
 * native <audio> controls work without exposing credentials.
 *
 * The lazy mode shows a small "Load recording" affordance and only fetches
 * on click — appropriate for collapsed list rows.
 */
export function CallRecordingPlayer({
  communicationId,
  lazy = false,
  className,
}: CallRecordingPlayerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke any previously-issued blob URL on unmount or when the id changes
  // so we don't leak audio buffers across navigation.
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const load = async () => {
    if (blobUrl || loading) return;
    setLoading(true);
    setError(null);
    try {
      const url = await fetchCallRecordingBlobUrl(communicationId);
      setBlobUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recording');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!lazy) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: load is stable per id
  }, [communicationId, lazy]);

  if (error) {
    return (
      <p className={`text-xs text-rose-600 italic ${className ?? ''}`}>
        {error}
      </p>
    );
  }

  if (loading || (!blobUrl && !lazy)) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className ?? ''}`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Loading recording…
      </span>
    );
  }

  if (!blobUrl && lazy) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void load();
        }}
        className={`text-xs text-primary hover:underline ${className ?? ''}`}
      >
        Load recording
      </button>
    );
  }

  return (
    <audio
      controls
      preload="none"
      src={blobUrl ?? undefined}
      className={className ?? 'h-8 w-full'}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
