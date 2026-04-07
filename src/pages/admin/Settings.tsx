import { useState, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  User,
  Shield,
  Palette,
  Bell,
  Keyboard,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSection from '@/components/admin/settings/ProfileSection';
import SecuritySection from '@/components/admin/settings/SecuritySection';

type SettingsSection = 'profile' | 'security' | 'appearance' | 'notifications' | 'shortcuts' | 'sessions';

const sections: { id: SettingsSection; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password and email settings' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and display preferences' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Notification preferences' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, description: 'Shortcut reference' },
  { id: 'sessions', label: 'Sessions', icon: Monitor, description: 'Active sessions and account info' },
];

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const { setPageTitle } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Settings');
    return () => {
      setPageTitle(null);
    };
  }, []);

  const current = sections.find((s) => s.id === activeSection)!;

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        <div className="flex gap-6">
          {/* Left sidebar navigation */}
          <nav className="w-56 flex-shrink-0">
            <div className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <current.icon className="h-5 w-5" />
                  {current.label}
                </CardTitle>
                <CardDescription>{current.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {activeSection === 'profile' && <ProfileSection />}
                {activeSection === 'security' && <SecuritySection />}
                {activeSection === 'appearance' && (
                  <p className="text-sm text-muted-foreground">Appearance section will be implemented in a future task.</p>
                )}
                {activeSection === 'notifications' && (
                  <p className="text-sm text-muted-foreground">Notifications section will be implemented in a future task.</p>
                )}
                {activeSection === 'shortcuts' && (
                  <p className="text-sm text-muted-foreground">Keyboard shortcuts section will be implemented in a future task.</p>
                )}
                {activeSection === 'sessions' && (
                  <p className="text-sm text-muted-foreground">Sessions section will be implemented in a future task.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
};

export default Settings;
