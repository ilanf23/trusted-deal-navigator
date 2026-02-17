import robertMartinezAvatar from '@/assets/avatars/robert-martinez.jpg';
import sarahRichardsonAvatar from '@/assets/avatars/sarah-richardson.jpg';
import michaelChenAvatar from '@/assets/avatars/michael-chen.jpg';
import davidKimAvatar from '@/assets/avatars/david-kim.jpg';
import lisaWongAvatar from '@/assets/avatars/lisa-wong.jpg';
import thomasWrightAvatar from '@/assets/avatars/thomas-wright.jpg';
import rachelAdamsAvatar from '@/assets/avatars/rachel-adams.jpg';
import sophiaLaurentAvatar from '@/assets/avatars/sophia-laurent.jpg';
import andrewFosterAvatar from '@/assets/avatars/andrew-foster.jpg';
import emilyWangAvatar from '@/assets/avatars/emily-wang.jpg';
import { GmailEmail, ThreadMessage, extractEmailAddress } from './gmailHelpers';

// ── Email Templates ────────────────────────────────────────────────
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export const evanEmailTemplates: EmailTemplate[] = [
  { id: 'template-1', name: 'Initial Outreach', subject: 'Commercial Lending Opportunity', body: 'Hi, I wanted to reach out about financing options that could help grow your business.' },
  { id: 'template-2', name: 'Follow-Up', subject: 'Following Up on Our Conversation', body: 'Just checking in to see if you had any questions about the loan options we discussed.' },
  { id: 'template-3', name: 'Document Request', subject: 'Documents Needed for Your Application', body: 'To move forward with your application, please provide the following documents at your earliest convenience.' },
  { id: 'template-4', name: 'Rate Update', subject: 'Great News - Rates Have Changed', body: 'I wanted to let you know that rates have moved favorably and now might be a good time to revisit your financing.' },
  { id: 'template-5', name: 'Thank You', subject: 'Thank You for Your Business', body: 'Thank you for choosing us for your financing needs - please don\'t hesitate to reach out if you need anything.' },
];

// ── Mock Thread Messages ───────────────────────────────────────────
export const mockThreadMessages: Record<string, ThreadMessage[]> = {
  'thread-mock-1': [
    {
      id: 'msg-1-1',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'robert.martinez@capitalventures.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      body: `Hi Robert,\n\nThank you for reaching out about financing for your acquisition. I'm excited to discuss the $2.5M loan opportunity for Capital Ventures.\n\nBased on our initial conversation, it sounds like you're looking to acquire a commercial property in the downtown district. Before we proceed, I wanted to gather some additional information to ensure we can structure the best possible deal for your needs.\n\nCould you please provide the following:\n\n1. Property address and current appraisal (if available)\n2. Your most recent 2 years of business tax returns\n3. Personal financial statement\n4. Executive summary of the acquisition opportunity\n\nOnce I have these documents, I can start working with our lending partners to get you pre-qualified. Given current market conditions, we're seeing rates in the 7.25-7.75% range for deals of this size with strong borrower profiles.\n\nI'm available for a call this week if you'd like to discuss the process in more detail. My calendar is open Tuesday and Thursday afternoons.\n\nLooking forward to working together on this.\n\nBest regards,\nEvan\nCommercial Lending X\n(555) 123-4567`,
      senderPhoto: null,
    },
    {
      id: 'msg-1-2',
      from: 'Robert Martinez <robert.martinez@capitalventures.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      body: `Evan,\n\nThanks for the quick response. Capital Ventures has been working on this acquisition for the past 6 months and we're finally in a position to move forward.\n\nI've attached the documents you requested:\n- Property appraisal (completed last month) showing a value of $3.2M\n- 2024 and 2023 business tax returns\n- My personal financial statement\n- A detailed executive summary of our expansion plans\n\nA few additional details about the deal:\n\nThe property is located at 4500 Commerce Boulevard, which is in a prime commercial corridor. The building is currently 85% occupied with stable tenants, including a regional bank branch and a medical office that have both been there for 10+ years.\n\nWe're planning to acquire the property and then invest an additional $500K in renovations to modernize the facade and upgrade the HVAC systems. This should allow us to increase rents by approximately 15% when current leases expire.\n\nOur target closing date is March 15th, so we're on a somewhat tight timeline. Is that feasible from your perspective?\n\nI'm free for a call Thursday at 2 PM if that works for you. Please let me know.\n\nThanks,\nRobert Martinez\nCEO, Capital Ventures LLC\n(555) 987-6543`,
      senderPhoto: robertMartinezAvatar,
    },
    {
      id: 'msg-1-3',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'robert.martinez@capitalventures.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      body: `Robert,\n\nExcellent - I've reviewed all the documents you sent and I'm impressed with the quality of this acquisition opportunity. The property fundamentals look strong and your business financials are well-organized.\n\nA few initial observations:\n\n1. The 80% LTV you're targeting ($2.5M on a $3.2M property) is within our comfort zone for this asset class\n2. Your debt service coverage ratio looks healthy based on the current NOI\n3. The tenant mix with long-term occupants is exactly what lenders like to see\n\nI spoke with three of our lending partners this morning and have some promising initial feedback:\n\nLENDER A (Regional Bank):\n- Rate: 7.35% fixed for 5 years\n- Amortization: 25 years\n- Prepayment: 3-2-1 step-down\n- Timeline: 45 days to close\n\nLENDER B (Credit Union):\n- Rate: 7.15% fixed for 7 years\n- Amortization: 25 years\n- Prepayment: Yield maintenance for 3 years, then 1%\n- Timeline: 60 days to close\n\nLENDER C (Private Lender):\n- Rate: 8.25% fixed\n- Amortization: 30 years\n- Prepayment: None after 12 months\n- Timeline: 21 days to close\n\nGiven your March 15th target, Lender A seems like the best fit - competitive rate with a realistic timeline. Lender B has a slightly better rate but the 60-day timeline cuts it close.\n\nThursday at 2 PM works perfectly. I'll send a calendar invite. We can review these options in detail and discuss which structure works best for Capital Ventures.\n\nTalk soon,\nEvan`,
      senderPhoto: null,
    },
    {
      id: 'msg-1-4',
      from: 'Robert Martinez <robert.martinez@capitalventures.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      body: `Evan,\n\nGreat call yesterday! I really appreciated you walking me through all the options in detail. After discussing with my partners, we've decided to move forward with Lender A.\n\nThe 7.35% rate with the 5-year fixed term aligns well with our business plan. We're planning to hold this property for at least 7-10 years, so we'll likely refinance when the fixed period ends anyway. The 45-day timeline also gives us a comfortable buffer before our target closing date.\n\nA couple of follow-up items from our discussion:\n\n1. You mentioned that Lender A might be able to include the renovation costs in the loan. Can you confirm if that's possible? We'd love to finance the full $3M ($2.5M acquisition + $500K renovation) if the numbers work.\n\n2. For the renovation draws, what documentation would we need to provide? We have a general contractor lined up but haven't finalized the scope of work yet.\n\n3. Is there any flexibility on the prepayment penalty? The 3-2-1 structure works, but if we could get it waived entirely after year 3, that would be ideal.\n\nAlso, I wanted to mention that we have another acquisition opportunity in the pipeline - a retail strip center about 2 miles from this property. It's a smaller deal ($1.8M) but similar quality tenants. Once we close this first deal, I'd love to discuss financing options for that one as well.\n\nLet me know what you need from me to get the formal application submitted.\n\nThanks,\nRobert`,
      senderPhoto: robertMartinezAvatar,
    },
    {
      id: 'msg-1-5',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'robert.martinez@capitalventures.com',
      date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      body: `Robert,\n\nGreat news on all fronts! I'm excited to get this deal across the finish line for you.\n\nRegarding your questions:\n\n1. RENOVATION FINANCING: Yes, Lender A can absolutely include the renovation costs. They offer a "purchase plus improvement" loan structure. The total loan would be $3M with the renovation portion held in escrow and released in draws as work is completed. This will require a detailed scope of work and contractor bids before closing, but it's very doable.\n\n2. RENOVATION DRAWS: You'll need to provide:\n   - Signed contractor agreement with detailed line-item budget\n   - Contractor's license and insurance certificates\n   - Draw schedule (typically 3-4 draws for a project this size)\n   - Lender will do inspections before each draw release\n\n3. PREPAYMENT: I pushed back on this with my contact at Lender A. Best they can do is 3-2-1-0, meaning no penalty in year 4 or later. Given that you're planning to hold long-term, this should work well.\n\nFor the formal application, please send me:\n- Signed LOI or purchase agreement for the property\n- Updated rent roll (dated within 30 days)\n- 3 months of property operating statements\n- Phase I environmental (if you have one; if not, lender can order)\n- Your operating agreement for Capital Ventures LLC\n\nOnce I have these, I'll submit to Lender A and we should have an approval within 5-7 business days.\n\nAnd definitely let's talk about the retail strip center! Send me the details when you're ready - address, asking price, current occupancy, and rent roll. If the quality is similar to this deal, I'm confident we can get it done.\n\nLet me know if you have any questions. We're on track for a smooth closing!\n\nBest,\nEvan\nCommercial Lending X`,
      senderPhoto: null,
    },
  ],
};

// ── Mock External Emails ───────────────────────────────────────────
export const mockExternalEmails: GmailEmail[] = [
  { id: 'mock-1', threadId: 'thread-mock-1', subject: 'RE: Loan Application Status Update', from: 'Robert Martinez <robert.martinez@capitalventures.com>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 30).toISOString(), snippet: 'Hi Evan, Just following up on our conversation about the $2.5M acquisition loan. We have completed the due diligence...', isRead: false, senderPhoto: robertMartinezAvatar },
  { id: 'mock-2', threadId: 'thread-mock-2', subject: 'Documents for Property Appraisal', from: 'Sarah Richardson <sarah.r@meridiangroup.com>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), snippet: 'Please find attached the property appraisal documents for the Meridian Plaza project. Let me know if you need anything else.', isRead: false, senderPhoto: sarahRichardsonAvatar },
  { id: 'mock-3', threadId: 'thread-mock-3', subject: 'Urgent: Term Sheet Review Required', from: 'Michael Chen <mchen@techvest.com>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), snippet: 'Evan, I need your input on the term sheet before our meeting tomorrow. The interest rate seems higher than discussed...', isRead: false, senderPhoto: michaelChenAvatar },
  { id: 'mock-4', threadId: 'thread-mock-4', subject: 'New Restaurant Location Financing', from: 'David Kim <dkim@seoulfoodgroup.com>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), snippet: 'Looking to expand Seoul Food Group with 3 new locations in the downtown area. Would love to discuss financing options...', isRead: false, senderPhoto: davidKimAvatar },
  { id: 'mock-5', threadId: 'thread-mock-5', subject: 'Healthcare Facility Refinance Question', from: 'Lisa Wong <lisa@pacificmedgroup.com>', to: 'evan@commerciallendingx.com', date: '2026-01-10T11:45:00.000Z', snippet: 'Our current loan matures in 6 months and we are exploring refinance options. The facility is valued at $8.2M...', isRead: false, senderPhoto: lisaWongAvatar },
  { id: 'mock-6', threadId: 'thread-mock-6', subject: 'Manufacturing Equipment Loan Application', from: 'Thomas Wright <twright@wrightmanufacturing.com>', to: 'evan@commerciallendingx.com', date: '2026-01-10T16:20:00.000Z', snippet: 'Following up on our call about equipment financing. We need approximately $1.8M for new CNC machines and automation...', isRead: false, senderPhoto: thomasWrightAvatar },
  { id: 'mock-7', threadId: 'thread-mock-7', subject: 'Senior Living Facility Acquisition', from: 'Rachel Adams <rachel@sunriseseniorliving.com>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(), snippet: 'Great news - the seller accepted our offer! Now we need to move quickly on the financing. The purchase price is $12.5M...', isRead: false, senderPhoto: rachelAdamsAvatar },
  { id: 'mock-8', threadId: 'thread-mock-8', subject: 'Boutique Hotel Expansion Plans', from: 'Sophia Laurent <sophia@luxestays.co>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), snippet: 'We are looking to add 40 more rooms to our property in Napa. I have attached our revenue projections and construction estimates...', isRead: false, senderPhoto: sophiaLaurentAvatar },
  { id: 'mock-9', threadId: 'thread-mock-9', subject: 'Commercial Property Portfolio Review', from: 'Andrew Foster <afoster@greenleafprops.com>', to: 'evan@commerciallendingx.com', date: '2026-01-10T14:30:00.000Z', snippet: 'Can we schedule a call to review our portfolio? We have 5 properties that may need refinancing before year end...', isRead: false, senderPhoto: andrewFosterAvatar },
  { id: 'mock-10', threadId: 'thread-mock-10', subject: 'Healthcare Expansion Financing Inquiry', from: 'Emily Wang <ewang@sunrisehealthcare.com>', to: 'evan@commerciallendingx.com', date: '2026-01-10T09:15:00.000Z', snippet: 'Sunrise Healthcare is planning to open a new urgent care center. We are looking at properties in the $3-4M range...', isRead: false, senderPhoto: emilyWangAvatar },
];

// ── CRM Helpers ────────────────────────────────────────────────────
export const findLeadForEmail = (email: GmailEmail, allLeads: any[]) => {
  const senderEmail = extractEmailAddress(email.from);
  return allLeads.find((lead) => {
    if (lead.email?.toLowerCase() === senderEmail) return true;
    if (lead.lead_emails?.some((e: any) => e.email?.toLowerCase() === senderEmail)) return true;
    return false;
  });
};

export const isExternalEmail = (email: GmailEmail, crmEmails: string[]) => {
  const senderEmail = extractEmailAddress(email.from);
  return crmEmails.some((crmEmail) => senderEmail === crmEmail.toLowerCase());
};

export const getNextStepSuggestion = (stageName: string | undefined, emailSnippet: string, _lead: any): string => {
  const snippet = emailSnippet.toLowerCase();

  if (snippet.includes('document') || snippet.includes('appraisal') || snippet.includes('attached'))
    return 'Review attached documents and update deal status';
  if (snippet.includes('question') || snippet.includes('clarif'))
    return 'Address borrower questions and provide clarification';
  if (snippet.includes('urgent') || snippet.includes('asap'))
    return 'Prioritize response - time-sensitive request';
  if (snippet.includes('term sheet') || snippet.includes('terms'))
    return 'Review and discuss term sheet with borrower';
  if (snippet.includes('follow') || snippet.includes('status') || snippet.includes('update'))
    return 'Send status update and outline next milestones';

  switch (stageName) {
    case 'Discovery': return 'Schedule discovery call to understand borrower needs';
    case 'Pre-Qualification': return 'Gather preliminary financials for pre-qual assessment';
    case 'Doc Collection': return 'Request outstanding documents for underwriting package';
    case 'Underwriting': return 'Follow up with lender on underwriting status';
    case 'Approval': return 'Coordinate closing timeline and final conditions';
    case 'Funded': return 'Confirm funding details and send thank you note';
    default: return 'Review email and determine appropriate next action';
  }
};
