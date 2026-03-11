import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus } from 'lucide-react';
import { useNewSignups } from '@/hooks/useNewSignups';

export const NewSignupsWidget = () => {
  const { data: newSignups, isLoading: signupsLoading } = useNewSignups();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            New Signups This Week
          </CardTitle>
          {newSignups && newSignups.length > 0 && (
            <Badge variant="secondary">{newSignups.length} new</Badge>
          )}
        </div>
        <CardDescription>Client signups from the current week</CardDescription>
      </CardHeader>
      <CardContent>
        {signupsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !newSignups?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>No new signups this week</p>
          </div>
        ) : (
          <div className="space-y-3">
            {newSignups.map((signup) => (
              <div
                key={signup.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{signup.client_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {signup.client_email && (
                      <span className="text-xs text-muted-foreground truncate">{signup.client_email}</span>
                    )}
                    {signup.company_name && (
                      <span className="text-xs text-muted-foreground">&middot; {signup.company_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {signup.source && (
                    <Badge variant="outline" className="text-xs">{signup.source}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(signup.signed_up_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
