import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Phone, Video, Users, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BorrowerSearchSelect } from '@/components/employee/tasks/BorrowerSearchSelect';
import { cn } from '@/lib/utils';

const EVENT_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'video', label: 'Video Call', icon: Video },
  { value: 'meeting', label: 'In-Person', icon: Users },
] as const;

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toLocalDatetimeValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDatetimeValue(value: string) {
  return new Date(value);
}

export interface EventDialogData {
  id?: string;
  title?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  appointmentType?: string;
  description?: string;
  leadId?: string | null;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EventDialogData;
  onSave: (event: {
    id?: string;
    title: string;
    start_time: string;
    end_time: string;
    appointment_type: string;
    description?: string;
    lead_id?: string | null;
  }) => void;
}

export function EventDialog({ open, onOpenChange, data, onSave }: EventDialogProps) {
  const isEdit = !!data.id;

  const [title, setTitle] = useState('');
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [appointmentType, setAppointmentType] = useState('call');
  const [description, setDescription] = useState('');
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(data.title ?? '');
      setStartStr(toLocalDatetimeValue(data.start));
      setEndStr(toLocalDatetimeValue(data.end));
      setAllDay(data.allDay ?? false);
      setAppointmentType(data.appointmentType ?? 'call');
      setDescription(data.description ?? '');
      setLeadId(data.leadId ?? null);
    }
  }, [open, data]);

  const { data: leads = [] } = useQuery({
    queryKey: ['pipeline-leads-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline')
        .select('id, name, company_name')
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string; company_name: string | null }[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const durationMinutes = useMemo(() => {
    const start = fromLocalDatetimeValue(startStr);
    const end = fromLocalDatetimeValue(endStr);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }, [startStr, endStr]);

  const applyDuration = (minutes: number) => {
    const start = fromLocalDatetimeValue(startStr);
    const end = new Date(start.getTime() + minutes * 60000);
    setEndStr(toLocalDatetimeValue(end));
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const start = fromLocalDatetimeValue(startStr);
    let end = fromLocalDatetimeValue(endStr);

    if (allDay) {
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    }

    onSave({
      id: data.id,
      title: title.trim(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      appointment_type: appointmentType,
      description: description.trim() || undefined,
      lead_id: leadId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            className="text-lg font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            autoFocus
          />

          <div className="flex items-center gap-3">
            <Label htmlFor="all-day" className="text-sm">All day</Label>
            <Switch
              id="all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="datetime-local"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="datetime-local"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {allDay && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={startStr.slice(0, 10)}
                onChange={(e) => {
                  const d = e.target.value;
                  setStartStr(`${d}T09:00`);
                  setEndStr(`${d}T10:00`);
                }}
                className="text-sm"
              />
            </div>
          )}

          {!allDay && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyDuration(m)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-full border transition-colors',
                      durationMinutes === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    {formatDuration(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Event type</Label>
            <div className="flex gap-2">
              {EVENT_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAppointmentType(value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors',
                    appointmentType === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Borrower / Lead</Label>
            <BorrowerSearchSelect
              leads={leads}
              value={leadId}
              onValueChange={setLeadId}
              placeholder="Associate with a lead (optional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {isEdit ? 'Save Changes' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
