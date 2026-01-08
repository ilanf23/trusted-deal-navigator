import { useEffect, useState } from 'react';
import PortalLayout from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const PortalProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ company_name: '', contact_person: '', phone: '', address: '', city: '', state: '', zip_code: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (data) setProfile({ company_name: data.company_name || '', contact_person: data.contact_person || '', phone: data.phone || '', address: data.address || '', city: data.city || '', state: data.state || '', zip_code: data.zip_code || '' });
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update(profile).eq('user_id', user.id);
    if (error) toast({ title: 'Error', description: 'Failed to save profile', variant: 'destructive' });
    else toast({ title: 'Success', description: 'Profile updated successfully' });
    setSaving(false);
  };

  if (loading) return <PortalLayout><div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div></PortalLayout>;

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">My Profile</h1><p className="text-muted-foreground">Manage your account information</p></div>
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Company Name</Label><Input value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} /></div>
              <div><Label>Contact Person</Label><Input value={profile.contact_person} onChange={(e) => setProfile({ ...profile, contact_person: e.target.value })} /></div>
            </div>
            <div><Label>Phone</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>City</Label><Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} /></div>
              <div><Label>ZIP</Label><Input value={profile.zip_code} onChange={(e) => setProfile({ ...profile, zip_code: e.target.value })} /></div>
            </div>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
};
export default PortalProfile;
