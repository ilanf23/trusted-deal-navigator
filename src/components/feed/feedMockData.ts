export type ActivityType = 'email_sent' | 'email_received' | 'phone_call' | 'note' | 'calendar_invite';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  senderName: string;
  senderInitial: string;
  senderAvatar?: string;
  recipientName: string;
  recipientInitial: string;
  recipientAvatar?: string;
  additionalRecipients?: { name: string; initial: string }[];
  subject?: string;
  preview: string;
  time: string;
  threadCount?: number;
  attachments?: { name: string }[];
  overflowAttachments?: number;
  isPrivate?: boolean;
  showReplyAll?: boolean;
}

export const FEED_MOCK_DATA: ActivityItem[] = [
  {
    id: '1',
    type: 'email_sent',
    senderName: 'Brad Hettich',
    senderInitial: 'B',
    recipientName: 'Viren Shastri',
    recipientInitial: 'V',
    subject: 'Re: Follow-Up',
    preview: 'Hello Viren, I hope you are doing well. We are sending you a client agreement via Adob...',
    time: '11:31 AM',
    threadCount: 1,
    attachments: [{ name: 'image.png' }, { name: 'image.png' }],
    overflowAttachments: 1,
    isPrivate: true,
  },
  {
    id: '2',
    type: 'email_received',
    senderName: 'Corey Jones',
    senderInitial: 'C',
    recipientName: 'Brad Hettich',
    recipientInitial: 'B',
    subject: 'Re: [EXT]Follow Ups',
    preview: "Thanks for checking in. Cc'ing Brad since he texted me on CA Air. CA Air is likely ...",
    time: '11:18 AM',
    threadCount: 1,
    isPrivate: true,
  },
  {
    id: '3',
    type: 'phone_call',
    senderName: 'Brad',
    senderInitial: 'B',
    recipientName: 'Guillermo Rodriguez',
    recipientInitial: 'G',
    preview: 'Spoke today. He is evaluating using one of his investors and would get equity or get shadow equity. He w...',
    time: '11:15 AM',
  },
  {
    id: '4',
    type: 'email_received',
    senderName: 'Corey Jones',
    senderInitial: 'C',
    recipientName: 'Wendy Stanwick',
    recipientInitial: 'W',
    subject: 'Re: [EXT]Call w/Harmony Education',
    preview: "You send please since you've probably got their emails and such...",
    time: '11:14 AM',
    attachments: [{ name: 'doc.pdf' }, { name: 'sheet.xlsx' }],
    overflowAttachments: 3,
    isPrivate: true,
  },
  {
    id: '5',
    type: 'email_sent',
    senderName: 'Wendy',
    senderInitial: 'W',
    recipientName: 'Corey Jones',
    recipientInitial: 'C',
    subject: 'Re: [EXT]Call w/Harmony Education',
    preview: 'Following up on our earlier conversation regarding Harmony Education...',
    time: '11:09 AM',
    isPrivate: true,
  },
  {
    id: '6',
    type: 'email_received',
    senderName: 'Greg Joyner',
    senderInitial: 'G',
    recipientName: 'Brad Hettich',
    recipientInitial: 'B',
    subject: 'Re: SBA 7a loan',
    preview: 'I wanted to follow up on the SBA 7a loan application we discussed...',
    time: '11:02 AM',
    threadCount: 4,
    isPrivate: true,
  },
  {
    id: '7',
    type: 'email_received',
    senderName: 'Corey Jones',
    senderInitial: 'C',
    recipientName: 'Wendy Stanwick',
    recipientInitial: 'W',
    subject: 'Re: [EXT]Call w/Harmony Education',
    preview: 'Circling back on the Harmony Education deal per our discussion...',
    time: '11:02 AM',
    isPrivate: true,
  },
  {
    id: '8',
    type: 'email_received',
    senderName: 'Jeffrey Villwock',
    senderInitial: 'J',
    recipientName: 'Brad Hettich',
    recipientInitial: 'B',
    subject: 'Accepted: Sunanddita Das/Brad Hettich Zoom Call',
    preview: 'This event has been accepted. Looking forward to the call...',
    time: '11:00 AM',
    isPrivate: true,
  },
  {
    id: '9',
    type: 'email_received',
    senderName: 'Sanjay Dave',
    senderInitial: 'S',
    recipientName: 'Wendy Stanwick',
    recipientInitial: 'W',
    subject: 'Re: [EXT] Sarim Khan / Prism Fitness',
    preview: 'Thanks for the update on the Khan deal. I will review the documents...',
    time: '10:49 AM',
    isPrivate: true,
  },
  {
    id: '10',
    type: 'note',
    senderName: 'Wendy',
    senderInitial: 'W',
    recipientName: 'Sanjay Dave',
    recipientInitial: 'S',
    preview: '2/20/26-Sent email to schedule call on Khan deal',
    time: '10:46 AM',
  },
  {
    id: '11',
    type: 'email_sent',
    senderName: 'Wendy',
    senderInitial: 'W',
    recipientName: 'Sanjay Dave',
    recipientInitial: 'S',
    subject: 'Re: [EXT] Sarim Khan / Prism Fitness',
    preview: 'Hi Sanjay, I wanted to schedule a call to discuss the Khan deal...',
    time: '10:46 AM',
    isPrivate: true,
  },
  {
    id: '12',
    type: 'calendar_invite',
    senderName: 'Wendy Stanwick',
    senderInitial: 'W',
    recipientName: 'Brad Hettich',
    recipientInitial: 'B',
    subject: 'Updated invitation: CLX Team TouchPoint',
    preview: 'Updated invitation for the weekly CLX Team TouchPoint meeting...',
    time: '10:34 AM',
    attachments: [{ name: 'invite.ics' }],
    showReplyAll: true,
    isPrivate: true,
  },
  {
    id: '13',
    type: 'calendar_invite',
    senderName: 'Wendy Stanwick',
    senderInitial: 'W',
    recipientName: 'Maura Cannon',
    recipientInitial: 'M',
    subject: 'Updated invitation: CLX Team TouchPoint',
    preview: 'Updated invitation for the weekly CLX Team TouchPoint meeting...',
    time: '10:34 AM',
    attachments: [{ name: 'invite.ics' }],
    showReplyAll: true,
    isPrivate: true,
  },
  {
    id: '14',
    type: 'phone_call',
    senderName: 'Brad',
    senderInitial: 'B',
    recipientName: 'Justin Dworaczyk',
    recipientInitial: 'J',
    preview: 'Spoke today. Going to get him a needs list.',
    time: '10:31 AM',
  },
];

export const ACTIVITY_FILTERS = [
  'CLX Agr. Out for eSignature',
  'Email',
  'Email',
  'Follow Up',
  'Form',
  'Lender Needs List',
  'Lender Q&A',
  'Mail',
  'Meeting',
  'Note',
  'Phone Call',
  'Prep Projections',
  'Review Financials',
  'SMS',
  'To Do',
  'UW Paused - Need Info',
  'Zoom Call',
];

export const SUGGESTED_PEOPLE = [
  { name: 'Ilanfridman23', initial: 'I', email: 'ilanfridman23@...', hasLinkedin: true },
  { name: 'Lisa at Pacificmedgroup', initial: 'L', email: 'lisa@pacificme...', hasLinkedin: true },
  { name: 'Robert Martinez', initial: 'RM', email: 'robert.m@...', hasLinkedin: false },
];
