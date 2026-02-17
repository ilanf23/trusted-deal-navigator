import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { GmailInbox } from '@/components/gmail/GmailInbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { toast } from 'sonner';
import { GmailEmail, extractEmailAddress } from '@/components/gmail/gmailHelpers';

const IlansGmail = () => {
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const gmail = useGmailConnection({
    userKey: 'ilan',
    callbackPrefix: 'superadmin',
    maxResults: 50,
    fetchPhotos: false,
  });

  const handleSendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSending(true);
    try {
      await gmail.sendEmailMutation.mutateAsync({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      toast.success('Email sent successfully!');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (error: any) {
      toast.error('Failed to send: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <GmailInbox
        config={{
          userKey: 'ilan',
          callbackPrefix: 'superadmin',
          onCompose: (ctx) => {
            setComposeTo(ctx?.to || '');
            setComposeSubject(ctx?.subject || '');
            setComposeBody(ctx?.body || '');
            setComposeOpen(true);
          },
        }}
      />

      {/* Simple compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="recipient@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your message..." rows={10} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default IlansGmail;
