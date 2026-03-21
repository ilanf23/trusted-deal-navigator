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
  'thread-mock-11': [
    {
      id: 'msg-11-1',
      from: 'Sarah <sarah@pdffiller.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      body: `Hi Evan,\n\nI was referred to you by a colleague who said you helped them secure financing for their office build-out. I'm hoping you can help us with a similar situation.\n\nI'm Sarah, Head of Operations at PDFfiller. We're a document management SaaS company and we've been growing quickly — our team has gone from 40 to 120 people in the past 18 months. We've completely outgrown our current lease and are looking to purchase a commercial office space rather than continue renting.\n\nHere's what we're looking at:\n\n- Target property: 22,000 SF office building at 3100 Innovation Drive\n- Asking price: $4.8M\n- We'd also need approximately $600K for tenant improvements (server room buildout, collaborative workspaces, etc.)\n- Ideal timeline: close by end of Q2 2026\n\nWe're a profitable company with $12M ARR and growing 40% YoY. We have about $1.5M in cash we can put toward a down payment.\n\nIs this something CLX can help with? I'd love to set up a call to discuss.\n\nThanks,\nSarah\nHead of Operations, PDFfiller\n(555) 278-4410`,
      senderPhoto: null,
    },
    {
      id: 'msg-11-2',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'sarah@pdffiller.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
      body: `Hi Sarah,\n\nThanks for reaching out — and glad to hear the referral! This is exactly the type of deal we love working on.\n\nA tech company with $12M ARR and 40% growth purchasing their own office space is a strong borrower profile. The $4.8M purchase price with $600K in TI is very manageable.\n\nA few initial thoughts:\n\n1. SBA 504 LOAN: This is likely your best option. The SBA 504 program is designed for owner-occupied commercial real estate and offers:\n   - As low as 10% down payment (you have ~28% with $1.5M — even better)\n   - Fixed rates for 25 years (currently around 6.5-6.8%)\n   - Can include the TI costs in the loan\n   - Total project cost: ~$5.4M\n\n2. CONVENTIONAL: A traditional commercial mortgage would work too, but typically requires 20-25% down and has shorter fixed-rate periods (5-7 years).\n\nGiven your strong financials, I think we can get very competitive terms. To get started, could you send me:\n\n- Last 2 years of business tax returns\n- Year-to-date P&L and balance sheet\n- Personal financial statement for any owners with 20%+ stake\n- The property listing or any info you have on 3100 Innovation Drive\n\nI'm free for a call tomorrow (Wednesday) or Thursday. What works best for you?\n\nBest,\nEvan\nCommercial Lending X\n(555) 123-4567`,
      senderPhoto: null,
    },
    {
      id: 'msg-11-3',
      from: 'Sarah <sarah@pdffiller.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
      body: `Evan,\n\nThe SBA 504 option sounds perfect — the lower down payment would let us keep more cash in the business for hiring and product development. That's a huge plus for us.\n\nAttached are the documents you requested:\n- 2024 and 2025 business tax returns\n- Current P&L (through February 2026) and balance sheet\n- Personal financial statement for our CEO, Mark Torres (sole owner)\n- Property listing for 3100 Innovation Drive\n\nA few additional details about the property:\n\n- Built in 2018, excellent condition\n- Currently vacant (previous tenant relocated)\n- 85 parking spaces (important for our team)\n- Fiber internet already installed\n- Zoned for office/tech use\n\nFor the tenant improvements, here's a rough breakdown:\n- Server room & IT infrastructure: $180K\n- Open floor plan conversion: $150K\n- Conference rooms & phone booths: $120K\n- Kitchen/break room upgrade: $80K\n- Furniture & fixtures: $70K\n\nWe've already toured the property twice and our CEO is very excited about it. Thursday at 2 PM works great for a call.\n\nOne question: how long does the SBA 504 process typically take from application to closing? We want to make sure we can hit our Q2 deadline.\n\nThanks!\nSarah`,
      senderPhoto: null,
    },
    {
      id: 'msg-11-4',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'sarah@pdffiller.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      body: `Sarah,\n\nGreat call today — thanks for walking me through PDFfiller's growth story and the vision for the new space. Mark's commitment to the deal is clear, and the financials are impressive.\n\nHere's what I've put together after reviewing everything:\n\nSBA 504 LOAN STRUCTURE:\n- Total project cost: $5.4M ($4.8M purchase + $600K TI)\n- First mortgage (from CDC lender): $2.7M (50%)\n- SBA 504 debenture: $2.16M (40%)\n- Your down payment: $540K (10%)\n- Rate estimate: 6.55% blended (first mortgage at ~7.1%, SBA portion at ~5.8%)\n- Term: 25-year amortization, 25-year fixed on SBA portion\n\nThis means you'd only need $540K down instead of using your full $1.5M — leaving almost $1M in the business.\n\nTIMELINE:\n- SBA 504 typically takes 60-90 days from complete application\n- If we submit by end of March, we should comfortably close by mid-June\n- I've already reached out to two CDC lenders who have fast processing\n\nTo answer your question about the process:\n1. Week 1-2: Package submission & lender review\n2. Week 3-4: Appraisal ordered and site visit\n3. Week 5-6: SBA authorization\n4. Week 7-10: Closing preparation & funding\n\nNEXT STEPS:\n- I need a signed letter of intent or purchase agreement for the property\n- Phase I environmental (I can recommend an affordable provider)\n- Mark's 3 most recent months of bank statements\n\nWe're in great shape to hit your Q2 target. Let me know if you have any questions!\n\nBest,\nEvan`,
      senderPhoto: null,
    },
    {
      id: 'msg-11-5',
      from: 'Sarah <sarah@pdffiller.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      body: `Evan,\n\nAmazing news — our board approved the acquisition last night! Mark is thrilled and ready to move forward immediately.\n\nThe $540K down payment is so much better than what we were budgeting. That extra capital is going to be huge for our Series B plans later this year.\n\nHere's what I have for you:\n- Signed purchase agreement (executed yesterday, $4.8M with a 45-day due diligence period)\n- Mark's bank statements (3 months)\n- Phase I environmental — I went with the provider you recommended. They can have it done in 10 business days.\n\nA couple questions from our CFO:\n\n1. Can we start the TI work before the SBA portion fully closes? We'd love to begin demo as soon as the first mortgage funds.\n\n2. Is there any flexibility to increase the TI budget to $750K? Our architect came back with revised plans that include a small podcast/recording studio (we're launching a content marketing initiative). Would the SBA cover that?\n\n3. Our attorney wants to know if there are any prepayment penalties on either the first mortgage or the SBA portion.\n\nAlso — Mark wanted me to pass along that he's been really impressed with how quickly you've moved on this. He said, and I quote, "This is the first time a financing process hasn't felt like pulling teeth." So thank you for that!\n\nLet's keep the momentum going.\n\nBest,\nSarah`,
      senderPhoto: null,
    },
    {
      id: 'msg-11-6',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'sarah@pdffiller.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      body: `Sarah,\n\nCongrats on the board approval! That's a big milestone. Tell Mark I appreciate the kind words — our goal is to make this as painless as possible.\n\nGreat job getting all the documents together so quickly. I've already submitted the package to our preferred CDC lender, and they confirmed they can prioritize it.\n\nAnswers to your CFO's questions:\n\n1. TI TIMING: Yes, you can begin TI work after the first mortgage closes. The SBA debenture typically funds 4-6 weeks later, but the first mortgage can close independently. Just coordinate with the GC to phase the work so the bigger ticket items (server room, HVAC) happen after full funding.\n\n2. INCREASED TI BUDGET: Great news — yes, we can increase to $750K. The SBA 504 allows TI as part of the project cost as long as it's for the borrower's use. A podcast studio qualifies as a legitimate business use. Updated numbers:\n   - Total project: $5.55M\n   - Down payment: $555K (still well within your budget)\n   - Monthly payment estimate: ~$32,800\n\n3. PREPAYMENT: The first mortgage has a standard 3-2-1 step-down prepayment penalty. The SBA 504 debenture has a declining prepayment penalty over the first 10 years (starts at 10%, drops 1% per year). After year 10, no penalty. Given that you're planning to occupy long-term, this shouldn't be an issue.\n\nCURRENT STATUS:\n- Application submitted to CDC lender ✓\n- Phase I environmental ordered ✓\n- Appraisal being scheduled (expecting appraiser visit next week)\n- SBA authorization target: April 15th\n- Projected closing: June 2-6, 2026\n\nWe're right on track. I'll keep you posted as things progress. In the meantime, feel free to start getting contractor bids for the TI work so you're ready to go on day one.\n\nBest,\nEvan\nCommercial Lending X`,
      senderPhoto: null,
    },
  ],
  'thread-mock-2': [
    {
      id: 'msg-2-1',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'sarah.r@meridiangroup.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      body: `Hi Sarah,\n\nGreat speaking with you earlier today. I'm excited to learn more about the Meridian Plaza project and how we can help with the financing.\n\nBased on our conversation, it sounds like Meridian Group is looking to acquire and reposition the 45,000 SF mixed-use property at 1200 Fillmore Street. A $6.2M acquisition loan with a value-add component is definitely something we can work with.\n\nTo get the ball rolling, could you send over the following:\n\n1. Current rent roll and tenant lease abstracts\n2. Trailing 12-month operating statements (T-12)\n3. Property appraisal (if you have a recent one)\n4. Your business plan / repositioning strategy\n5. Two most recent years of tax returns for Meridian Group\n\nI'll start reaching out to our lending partners in the meantime to gauge appetite for this deal profile. Mixed-use assets in that corridor have been getting strong interest lately.\n\nLet me know if you have any questions.\n\nBest,\nEvan\nCommercial Lending X\n(555) 123-4567`,
      senderPhoto: null,
    },
    {
      id: 'msg-2-2',
      from: 'Sarah Richardson <sarah.r@meridiangroup.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
      body: `Hi Evan,\n\nThanks for following up so quickly! We've been looking at this property for a while and are eager to move forward.\n\nAttached you'll find:\n- Current rent roll (8 of 12 units occupied, mix of retail and office)\n- T-12 operating statements\n- Our repositioning plan — we're targeting a Class B+ finish with new lobbies, upgraded common areas, and a rooftop tenant amenity space\n\nWe don't have a recent appraisal yet — the seller's appraisal is from 2024 and came in at $5.8M, but we believe the as-stabilized value is closer to $8.5M once we complete the renovations and lease up the vacant units.\n\nA few things worth noting:\n\n- We have a signed LOI with the seller at $5.9M\n- Our renovation budget is approximately $1.2M\n- We're putting in 25% equity from our fund\n- Target stabilization within 18 months of closing\n- Two of the vacant units already have LOIs from prospective tenants (a coffee shop and a physical therapy clinic)\n\nWe'd love to close by mid-April if possible. Is that realistic given the timeline?\n\nAlso, my partner James will be on the calls going forward — I'll copy him on future emails. He handles our construction oversight.\n\nLooking forward to your thoughts on the deal.\n\nBest,\nSarah Richardson\nManaging Director, Meridian Group\n(555) 341-8890`,
      senderPhoto: sarahRichardsonAvatar,
    },
    {
      id: 'msg-2-3',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'sarah.r@meridiangroup.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
      body: `Sarah,\n\nThis is a really solid deal — I can see why you've been targeting it. The basis at $5.9M with an $8.5M stabilized value gives great upside, and the fact that you already have LOIs on two vacant units is a strong signal to lenders.\n\nI've reviewed the documents and run some preliminary numbers:\n\n- Current NOI: ~$385K (based on T-12)\n- Pro forma NOI (stabilized): ~$620K\n- Current DSCR at your target loan amount: 1.18x (a bit tight)\n- Stabilized DSCR: 1.52x (very comfortable)\n\nBecause of the value-add component, this deal fits best with a bridge-to-perm structure. I've already had initial conversations with two lenders:\n\nLENDER A (Debt Fund):\n- Bridge loan: $5.3M (75% of total cost)\n- Rate: SOFR + 350 bps (~8.8% today)\n- Interest-only during renovation\n- 24-month term with 12-month extension\n- Exit to permanent financing upon stabilization\n\nLENDER B (Regional Bank):\n- Construction-to-perm: $5.0M\n- Rate: 7.5% fixed for 5 years (post-stabilization)\n- Floating rate during construction (~8.2%)\n- Requires 30% equity ($2.13M)\n- 60-day close timeline\n\nLender A gives you more leverage and flexibility, while Lender B has a better long-term rate. Both can work with your mid-April timeline.\n\nI'd recommend we hop on a call this week to walk through these options with you and James. Would Thursday or Friday work?\n\nBest,\nEvan`,
      senderPhoto: null,
    },
    {
      id: 'msg-2-4',
      from: 'Sarah Richardson <sarah.r@meridiangroup.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      body: `Evan,\n\nWow, you work fast! These are both strong options.\n\nAfter discussing with James and our fund partners, we're leaning toward Lender A. The higher leverage is important to us since we have two other acquisitions in our pipeline this year and want to conserve equity. The bridge-to-perm structure also aligns well with our stabilization timeline.\n\nA few questions:\n\n1. For Lender A, is there any flexibility on the spread? We've seen SOFR + 300-325 on similar deals recently. Even 25 bps would make a meaningful difference on a $5.3M loan.\n\n2. What are the extension conditions? Do we need to hit certain occupancy or NOI thresholds to trigger the 12-month extension?\n\n3. For the permanent takeout — would we go back to the same lender or shop the market? What rates are you seeing for stabilized mixed-use in this size range?\n\n4. Can the renovation draws be structured as monthly rather than quarterly? Our GC prefers more frequent draws to manage cash flow.\n\nFriday at 11 AM works for both James and me. Can you send a Zoom link?\n\nAlso — I just got the Phase I environmental report back and it came back clean. I'll send it over today along with the updated survey.\n\nThanks for the great work on this, Evan. It's clear you know the value-add space well.\n\nBest,\nSarah`,
      senderPhoto: sarahRichardsonAvatar,
    },
    {
      id: 'msg-2-5',
      from: 'Evan <evan@commerciallendingx.com>',
      to: 'sarah.r@meridiangroup.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      body: `Sarah,\n\nGreat call on Friday — thanks to you and James for walking us through the renovation scope in detail. That really helps when presenting the deal to lenders.\n\nUpdates on your questions:\n\n1. RATE: I negotiated with Lender A and got them down to SOFR + 325 bps. They wouldn't go lower than that given the current vacancy, but they agreed to drop to SOFR + 275 once the property hits 85% occupancy during the loan term. That's a nice built-in incentive.\n\n2. EXTENSION: The 12-month extension requires:\n   - No payment defaults\n   - Minimum 70% occupancy\n   - DSCR of at least 1.0x on an IO basis\n   - $25K extension fee (0.47% — very reasonable)\n\n3. PERMANENT TAKEOUT: We'll absolutely shop the market when you're ready to convert. For stabilized mixed-use at $8-9M value, I'm currently seeing rates of 6.75-7.25% fixed with 25-30 year amortization. We'll have much better leverage once the property is performing.\n\n4. DRAWS: Lender A confirmed they can do monthly draws. They'll require an inspection before each draw, but their inspector is local so turnaround is typically 3-5 business days.\n\nI've also ordered the appraisal through Lender A's approved appraiser — we should have it back in 2-3 weeks. In the meantime, they're proceeding with underwriting based on the materials you've provided.\n\nNext steps:\n- Please send the signed purchase agreement (they need the final executed version)\n- Lender will issue a term sheet within 5 business days\n- We'll target closing the week of April 14th\n\nPlease send over that Phase I and survey when you get a chance. Everything is moving in the right direction!\n\nBest,\nEvan\nCommercial Lending X`,
      senderPhoto: null,
    },
    {
      id: 'msg-2-6',
      from: 'Sarah Richardson <sarah.r@meridiangroup.com>',
      to: 'evan@commerciallendingx.com',
      date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      body: `Evan,\n\nThis is fantastic news across the board. The SOFR + 325 with the step-down to 275 at 85% occupancy is a really creative structure — our partners are very happy with that.\n\nPlease find attached:\n- Executed purchase agreement\n- Phase I environmental report (clean)\n- Updated ALTA survey\n- Contractor bid package from our GC (James's firm, Meridian Construction)\n\nOne more thing — our attorney flagged that there's an existing ground lease on a small portion of the parking lot (about 15 spaces) that expires in 2031. The current tenant pays $800/month. It shouldn't affect the financing, but wanted to be transparent about it.\n\nJames also wanted me to ask: can we start some of the interior demo work before closing if we get early access from the seller? We want to hit the ground running on day one.\n\nWe're really excited about this project, Evan. Meridian Plaza is going to be a flagship asset for our portfolio. Thanks for making the financing piece so smooth.\n\nTalk soon,\nSarah`,
      senderPhoto: sarahRichardsonAvatar,
    },
  ],
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
  { id: 'mock-11', threadId: 'thread-mock-11', subject: 'RE: SBA 504 Loan — PDFfiller Office Acquisition', from: 'Sarah <sarah@pdffiller.com>', to: 'evan@commerciallendingx.com', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), snippet: 'Amazing news — our board approved the acquisition last night! Mark is thrilled and ready to move forward immediately...', isRead: false, senderPhoto: null },
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
