-- ============================================================
-- Seed 20 demo leads in each of the three pipelines
-- (potential, underwriting, lender_management) + 20 People CRM
-- contacts. Idempotent on email — re-running won't duplicate.
-- ============================================================

DO $$
DECLARE
  v_potential_id     uuid;
  v_underwriting_id  uuid;
  v_lender_id        uuid;
  v_potential_stages uuid[];
  v_uw_stages        uuid[];
  v_lm_stages        uuid[];
  v_stage_id         uuid;
  v_now              timestamptz := now();
  i                  int;

  v_names text[] := ARRAY[
    'Marcus Reeves','Elena Vasquez','Trevor Bishop','Ayanna Lee','Diego Morales',
    'Hannah Whitfield','Samir Patel','Brianna Cole','Liam Donovan','Mei Lin',
    'Andre Coleman','Priscilla Howard','Felix Nakamura','Daniela Sosa','Kingsley Adams',
    'Renee Cabrera','Quinn Halverson','Yusuf Diallo','Sienna Park','Connor McLeod'
  ];
  v_companies text[] := ARRAY[
    'Reeves Industrial Partners','Vasquez Capital Holdings','Bishop Hospitality Group','Crestline Medical Partners','Morales Logistics Co',
    'Whitfield Property Trust','Iron Bridge Manufacturing','Cole Restaurant Holdings','Donovan Multifamily LLC','Lin Tech Office Park',
    'Coleman Auto Group','Howard Self-Storage Partners','Nakamura Cold Chain','Sosa Mixed-Use Holdings','Adams Energy Services',
    'Cabrera Family Trust','Halverson Industrial REIT','Diallo Hotel Group','Park Retail Ventures','McLeod Construction'
  ];
  v_titles text[] := ARRAY[
    'Managing Partner','CFO','CEO','Principal','Owner',
    'Founder','President','Managing Director','VP Finance','COO',
    'Owner & President','Managing Member','CEO','Principal','Owner',
    'Trustee','CIO','CEO','Managing Partner','President'
  ];
  v_sources text[] := ARRAY[
    'Referral','Website','LinkedIn','Conference','Existing Client',
    'Partner','Cold Outbound','Email Campaign','Referral','Website',
    'Direct Mail','Referral','Partner','Website','Cold Outbound',
    'Existing Client','LinkedIn','Conference','Referral','Partner'
  ];
  v_collateral text[] := ARRAY[
    'Industrial Park','Mixed-Use Tower','Boutique Hotel','Medical Office','Distribution Warehouse',
    'Multifamily (84 units)','Manufacturing Facility','Restaurant Group','Multifamily (32 units)','Class A Office',
    'Auto Dealership','Self-Storage (240 units)','Cold Storage Warehouse','Mixed-Use','Equipment + Real Estate',
    'Apartment Building','Industrial Portfolio','Hotel (110 rooms)','Retail Center','Heavy Equipment Fleet'
  ];
  v_locations text[] := ARRAY[
    'Cleveland, OH','Phoenix, AZ','Charleston, SC','Bethesda, MD','Long Beach, CA',
    'Nashville, TN','Pittsburgh, PA','Austin, TX','Brooklyn, NY','San Jose, CA',
    'Columbus, OH','Tampa, FL','Sacramento, CA','Denver, CO','Houston, TX',
    'Portland, OR','Indianapolis, IN','New Orleans, LA','Dallas, TX','Newark, NJ'
  ];
  v_loan_categories text[] := ARRAY[
    'Commercial Real Estate','Bridge','Construction','Owner-Occupied CRE','SBA 7(a)',
    'Agency Multifamily','Equipment Finance','SBA 504','Agency Multifamily','Commercial Real Estate',
    'SBA 7(a)','CMBS','Commercial Real Estate','Construction','Equipment + CRE',
    'Agency Multifamily','Life Co','Bridge','CMBS','Equipment Finance'
  ];
  v_lender_types text[] := ARRAY[
    'Regional Bank','CMBS','Life Insurance Co','Community Bank','Credit Union',
    'Agency (Fannie)','Equipment Finance Co','SBA Preferred Lender','Agency (Freddie)','Life Insurance Co',
    'SBA Preferred Lender','CMBS','Regional Bank','Construction Lender','Equipment Finance Co',
    'Agency (Fannie)','Life Insurance Co','Debt Fund','CMBS','Equipment Finance Co'
  ];
  v_priorities text[] := ARRAY['high','medium','low','high','medium','high','medium','low','medium','high','low','medium','high','medium','high','low','high','medium','low','medium'];
  v_referral_sources text[] := ARRAY[
    'Patrick Lyons (Lyons CPA)','Self-sourced','Brad Network','Northwest Mutual Rep','Adam Network',
    'Jennifer Hsu (Hsu Law)','Ilan Network','Conference - MBA 2026','Adam Network','Brad Network',
    'Existing Client Referral','Ilan Network','Patrick Lyons (Lyons CPA)','Self-sourced','Cold Outreach',
    'Existing Client Referral','Jennifer Hsu (Hsu Law)','Brad Network','Adam Network','Ilan Network'
  ];

  -- Potential pipeline values
  v_potential_statuses text[] := ARRAY[
    'discovery','initial_review','pre_qualification','onboarding','initial_review',
    'discovery','pre_qualification','initial_review','initial_review','discovery',
    'onboarding','discovery','pre_qualification','initial_review','initial_review',
    'onboarding','discovery','pre_qualification','initial_review','discovery'
  ];
  v_potential_deal_values numeric[] := ARRAY[
    2850000,5400000,9200000,3100000,4500000,
    6750000,3800000,2150000,4250000,7900000,
    1850000,6500000,3500000,5200000,2750000,
    8400000,11500000,9750000,3950000,1450000
  ];

  -- Underwriting pipeline values
  v_uw_statuses text[] := ARRAY[
    'underwriting','document_collection','waiting_on_needs_list','waiting_on_client','complete_files_for_review',
    'need_structure_from_brad','maura_underwriting','brad_underwriting','underwriting','document_collection',
    'waiting_on_client','ready_for_wu_approval','underwriting','document_collection','waiting_on_needs_list',
    'maura_underwriting','complete_files_for_review','brad_underwriting','ready_for_wu_approval','underwriting'
  ];
  v_uw_deal_values numeric[] := ARRAY[
    4250000,7800000,12500000,4400000,5950000,
    8900000,5100000,2950000,5600000,10500000,
    2450000,8700000,4750000,6900000,3650000,
    11200000,15300000,12950000,5350000,1950000
  ];

  -- Lender management pipeline values
  v_lm_statuses text[] := ARRAY[
    'pre_approval_issued','approval','funded','won','pre_approval_issued',
    'approval','funded','won','pre_approval_issued','approval',
    'funded','approval','pre_approval_issued','funded','won',
    'approval','funded','pre_approval_issued','approval','won'
  ];
  v_lm_deal_values numeric[] := ARRAY[
    5650000,10200000,16500000,5850000,7900000,
    11800000,6800000,3900000,7500000,13950000,
    3250000,11600000,6300000,9200000,4850000,
    14950000,20400000,17250000,7150000,2600000
  ];
  v_lm_deal_outcomes text[] := ARRAY[
    'open','open','open','won','open',
    'open','open','won','open','open',
    'open','open','open','open','won',
    'open','open','open','open','won'
  ];

  v_email text;
  v_phone text;
  v_about text;
  v_next_action text;
  v_waiting_on text;
  v_history text;

BEGIN
  -- Prefer system pipelines but fall back to plain-name lookup
  SELECT id INTO v_potential_id    FROM public.pipelines WHERE name ILIKE 'Potential'         LIMIT 1;
  SELECT id INTO v_underwriting_id FROM public.pipelines WHERE name ILIKE 'Underwriting'      LIMIT 1;
  SELECT id INTO v_lender_id       FROM public.pipelines WHERE name ILIKE 'Lender Management' LIMIT 1;

  -- Bootstrap pipelines + default stages if any are missing (DB may be empty)
  IF v_potential_id IS NULL OR v_underwriting_id IS NULL OR v_lender_id IS NULL THEN
    DECLARE
      v_owner_id uuid;
    BEGIN
      SELECT id INTO v_owner_id FROM public.users WHERE is_owner = true ORDER BY created_at LIMIT 1;
      IF v_owner_id IS NULL THEN
        SELECT id INTO v_owner_id FROM public.users ORDER BY created_at LIMIT 1;
      END IF;
      IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'No users row found to own bootstrapped pipelines.';
      END IF;

      IF v_potential_id IS NULL THEN
        INSERT INTO public.pipelines (id, name, is_main, is_system, owner_id)
        VALUES (gen_random_uuid(), 'Potential', true, true, v_owner_id)
        RETURNING id INTO v_potential_id;

        INSERT INTO public.pipeline_stages (pipeline_id, name, position) VALUES
          (v_potential_id, 'Initial Contact',       0),
          (v_potential_id, 'Incoming -- ON HOLD',   1),
          (v_potential_id, 'In Process -- ON HOLD', 2),
          (v_potential_id, 'Dead',                  3),
          (v_potential_id, 'Denied',                4);
      END IF;

      IF v_underwriting_id IS NULL THEN
        INSERT INTO public.pipelines (id, name, is_main, is_system, owner_id)
        VALUES (gen_random_uuid(), 'Underwriting', false, true, v_owner_id)
        RETURNING id INTO v_underwriting_id;

        INSERT INTO public.pipeline_stages (pipeline_id, name, position) VALUES
          (v_underwriting_id, 'Review Kill / Keep',         0),
          (v_underwriting_id, 'Initial Review',             1),
          (v_underwriting_id, 'Waiting on Needs List',      2),
          (v_underwriting_id, 'Waiting on Client',          3),
          (v_underwriting_id, 'Complete Files for Review',  4),
          (v_underwriting_id, 'Need Structure from Brad',   5),
          (v_underwriting_id, 'Maura Underwriting',         6),
          (v_underwriting_id, 'Brad Underwriting',          7),
          (v_underwriting_id, 'UW Paused',                  8),
          (v_underwriting_id, 'Ready for WU Approval',      9);
      END IF;

      IF v_lender_id IS NULL THEN
        INSERT INTO public.pipelines (id, name, is_main, is_system, owner_id)
        VALUES (gen_random_uuid(), 'Lender Management', false, true, v_owner_id)
        RETURNING id INTO v_lender_id;

        INSERT INTO public.pipeline_stages (pipeline_id, name, position) VALUES
          (v_lender_id, 'Out for Review',                            0),
          (v_lender_id, 'Out for Approval',                          1),
          (v_lender_id, 'Waiting on Borrower',                       2),
          (v_lender_id, 'Term Sheet Issued',                         3),
          (v_lender_id, 'Waiting on Borrower - Final Docs',          4),
          (v_lender_id, 'Lender & Client working towards closing',   5),
          (v_lender_id, 'Closing Scheduled',                         6),
          (v_lender_id, 'Loan Closed',                               7);
      END IF;
    END;
  END IF;

  -- Capture stage IDs (ordered by position) so we can round-robin assign
  SELECT array_agg(id ORDER BY position) INTO v_potential_stages FROM public.pipeline_stages WHERE pipeline_id = v_potential_id;
  SELECT array_agg(id ORDER BY position) INTO v_uw_stages        FROM public.pipeline_stages WHERE pipeline_id = v_underwriting_id;
  SELECT array_agg(id ORDER BY position) INTO v_lm_stages        FROM public.pipeline_stages WHERE pipeline_id = v_lender_id;

  -- =====================================================
  -- POTENTIAL pipeline: 20 leads
  -- =====================================================
  FOR i IN 1..20 LOOP
    v_email := 'demo.pot.' || lower(replace(v_names[i], ' ', '.')) || '@' || lower(regexp_replace(v_companies[i], '[^a-zA-Z0-9]', '', 'g')) || '.com';
    v_phone := '(' || lpad(((200 + i)::int)::text, 3, '0') || ') 555-' || lpad((1000 + i * 17)::text, 4, '0');
    v_about := v_titles[i] || ' at ' || v_companies[i] || '. ' || v_collateral[i] || ' in ' || v_locations[i] || '. Active conversation about refinancing existing debt.';
    v_next_action := 'Send rate watch questionnaire and pre-qual checklist';
    v_waiting_on := 'Borrower''s last 2 yrs tax returns + rent roll';
    v_history := 'Initial outreach via ' || v_sources[i] || '. Discovery call completed; borrower expressed interest in fixed-rate refi.';
    v_stage_id := v_potential_stages[1 + ((i - 1) % array_length(v_potential_stages, 1))];

    IF NOT EXISTS (SELECT 1 FROM public.potential WHERE email = v_email) THEN
      INSERT INTO public.potential (
        id, name, email, phone, company_name, title, status, stage_id, source,
        notes, about, history, next_action, waiting_on, sla_threshold_days,
        deal_value, potential_revenue, fee_percent, loan_category, lender_type,
        priority, win_percentage, opportunity_name, description, last_activity_at,
        last_contacted, qualified_at, target_closing_date, clx_agreement,
        client_other_lenders, flagged_for_weekly, deal_outcome, source_system,
        custom_fields, interactions_count, stage_changed_at,
        referral_source, tags
      ) VALUES (
        gen_random_uuid(),
        v_names[i],
        v_email,
        v_phone,
        v_companies[i],
        v_titles[i],
        v_potential_statuses[i]::public.lead_status,
        v_stage_id,
        v_sources[i],
        'Demo lead. ' || v_collateral[i] || ' • ' || v_locations[i],
        v_about,
        v_history,
        v_next_action,
        v_waiting_on,
        7,
        v_potential_deal_values[i],
        v_potential_deal_values[i] * 0.0125,
        1.25,
        v_loan_categories[i],
        v_lender_types[i],
        v_priorities[i]::public.deal_priority,
        25 + ((i * 3) % 50),
        v_companies[i] || ' — ' || v_collateral[i] || ' Refi',
        v_collateral[i] || ' refinance for ' || v_companies[i] || '. Located in ' || v_locations[i] || '.',
        v_now - ((i * 4)::text || ' hours')::interval,
        v_now - ((i * 2)::text || ' days')::interval,
        v_now - ((i)::text || ' days')::interval,
        (v_now + ((90 + i * 3)::text || ' days')::interval)::date,
        (i % 3 = 0),
        (i % 4 = 0),
        (i % 5 = 0),
        'open'::public.deal_outcome,
        'clx',
        '{}'::jsonb,
        2 + (i % 6),
        v_now - ((i)::text || ' days')::interval,
        v_referral_sources[i],
        ARRAY[v_loan_categories[i], v_locations[i]]::text[]
      );
    END IF;
  END LOOP;

  -- =====================================================
  -- UNDERWRITING pipeline: 20 leads
  -- =====================================================
  FOR i IN 1..20 LOOP
    v_email := 'demo.uw.' || lower(replace(v_names[i], ' ', '.')) || '@' || lower(regexp_replace(v_companies[i], '[^a-zA-Z0-9]', '', 'g')) || '.com';
    v_phone := '(' || lpad(((300 + i)::int)::text, 3, '0') || ') 555-' || lpad((2000 + i * 23)::text, 4, '0');
    v_about := v_titles[i] || ' at ' || v_companies[i] || '. Deal in underwriting — gathering financials and processing needs list.';
    v_next_action := 'Send updated needs list to borrower; chase missing personal financial statement';
    v_waiting_on := 'YTD P&L, K-1s, signed PFS from sponsor';
    v_history := 'Moved from Potential after pre-qual. CLX agreement signed. Initial underwriting completed by Maura; Brad reviewing structure.';
    v_stage_id := v_uw_stages[1 + ((i - 1) % array_length(v_uw_stages, 1))];

    IF NOT EXISTS (SELECT 1 FROM public.underwriting WHERE email = v_email) THEN
      INSERT INTO public.underwriting (
        id, name, email, phone, company_name, title, status, stage_id, source,
        notes, about, history, next_action, waiting_on, sla_threshold_days,
        deal_value, potential_revenue, fee_percent, loan_category, lender_type,
        priority, win_percentage, opportunity_name, description, last_activity_at,
        last_contacted, qualified_at, target_closing_date, clx_agreement,
        client_other_lenders, flagged_for_weekly, deal_outcome, source_system,
        custom_fields, interactions_count, stage_changed_at,
        bank_relationships, uw_number, clx_file_name, tags
      ) VALUES (
        gen_random_uuid(),
        v_names[i],
        v_email,
        v_phone,
        v_companies[i],
        v_titles[i],
        v_uw_statuses[i]::public.lead_status,
        v_stage_id,
        v_sources[i],
        'Underwriting in progress. ' || v_collateral[i] || ' • ' || v_locations[i],
        v_about,
        v_history,
        v_next_action,
        v_waiting_on,
        14,
        v_uw_deal_values[i],
        v_uw_deal_values[i] * 0.0125,
        1.25,
        v_loan_categories[i],
        v_lender_types[i],
        v_priorities[i]::public.deal_priority,
        50 + ((i * 2) % 40),
        v_companies[i] || ' — ' || v_collateral[i] || ' UW',
        v_collateral[i] || ' in ' || v_locations[i] || '. Underwriting deal of $' || to_char(v_uw_deal_values[i], 'FM9,999,999') || '.',
        v_now - ((i * 3)::text || ' hours')::interval,
        v_now - ((i)::text || ' days')::interval,
        v_now - ((i + 5)::text || ' days')::interval,
        (v_now + ((45 + i * 2)::text || ' days')::interval)::date,
        true,
        (i % 3 = 0),
        (i % 4 = 0),
        'open'::public.deal_outcome,
        'clx',
        '{}'::jsonb,
        5 + (i % 8),
        v_now - ((i * 2)::text || ' days')::interval,
        'Primary: Chase + ' || v_lender_types[i] || '. Secondary: local credit union.',
        'UW-2026-' || lpad((100 + i)::text, 4, '0'),
        v_companies[i] || ' — ' || to_char(v_now, 'YYYY-MM'),
        ARRAY['underwriting', v_loan_categories[i], v_locations[i]]::text[]
      );
    END IF;
  END LOOP;

  -- =====================================================
  -- LENDER MANAGEMENT pipeline: 20 leads
  -- =====================================================
  FOR i IN 1..20 LOOP
    v_email := 'demo.lm.' || lower(replace(v_names[i], ' ', '.')) || '@' || lower(regexp_replace(v_companies[i], '[^a-zA-Z0-9]', '', 'g')) || '.com';
    v_phone := '(' || lpad(((400 + i)::int)::text, 3, '0') || ') 555-' || lpad((3000 + i * 29)::text, 4, '0');
    v_about := v_titles[i] || ' at ' || v_companies[i] || '. Deal in lender management — term sheet issued, working towards closing.';
    v_next_action := 'Coordinate closing call with lender counsel and title company';
    v_waiting_on := 'Borrower review of final loan docs; estoppels from major tenants';
    v_history := 'Lender approved at credit committee. Term sheet executed. Adam handling lender comms; Wendy chasing closing checklist.';
    v_stage_id := v_lm_stages[1 + ((i - 1) % array_length(v_lm_stages, 1))];

    IF NOT EXISTS (SELECT 1 FROM public.lender_management WHERE email = v_email) THEN
      INSERT INTO public.lender_management (
        id, name, email, phone, company_name, title, status, stage_id, source,
        notes, about, history, next_action, waiting_on, sla_threshold_days,
        deal_value, potential_revenue, fee_percent, loan_category, lender_type,
        lender_name, priority, win_percentage, opportunity_name, description,
        last_activity_at, last_contacted, qualified_at, target_closing_date,
        close_date, clx_agreement, client_other_lenders, flagged_for_weekly,
        deal_outcome, source_system, custom_fields, interactions_count,
        stage_changed_at, bank_relationships, uw_number, clx_file_name, won,
        won_at, won_reason, tags
      ) VALUES (
        gen_random_uuid(),
        v_names[i],
        v_email,
        v_phone,
        v_companies[i],
        v_titles[i],
        v_lm_statuses[i]::public.lead_status,
        v_stage_id,
        v_sources[i],
        'Lender management — ' || v_lender_types[i] || ' issued term sheet. ' || v_collateral[i],
        v_about,
        v_history,
        v_next_action,
        v_waiting_on,
        21,
        v_lm_deal_values[i],
        v_lm_deal_values[i] * 0.0125,
        1.25,
        v_loan_categories[i],
        v_lender_types[i],
        CASE v_lender_types[i]
          WHEN 'Regional Bank'         THEN 'First Midwest Commercial'
          WHEN 'CMBS'                  THEN 'Wells Fargo CMBS'
          WHEN 'Life Insurance Co'     THEN 'Northwestern Mutual'
          WHEN 'Community Bank'        THEN 'Heritage Bank of Commerce'
          WHEN 'Credit Union'          THEN 'Alliant Business CU'
          WHEN 'Agency (Fannie)'       THEN 'Walker & Dunlop (Fannie)'
          WHEN 'Equipment Finance Co'  THEN 'Balboa Capital'
          WHEN 'SBA Preferred Lender'  THEN 'Live Oak Bank'
          WHEN 'Agency (Freddie)'      THEN 'Berkadia (Freddie)'
          WHEN 'Construction Lender'   THEN 'Bridge Investment Group'
          WHEN 'Debt Fund'             THEN 'Madison Realty Capital'
          ELSE 'TBD'
        END,
        v_priorities[i]::public.deal_priority,
        80 + (i % 20),
        v_companies[i] || ' — ' || v_collateral[i] || ' Closing',
        v_collateral[i] || ' in ' || v_locations[i] || '. Term sheet issued by ' || v_lender_types[i] || '.',
        v_now - ((i * 2)::text || ' hours')::interval,
        v_now - ((i)::text || ' days')::interval,
        v_now - ((i + 30)::text || ' days')::interval,
        (v_now + ((30 + i)::text || ' days')::interval)::date,
        CASE WHEN v_lm_deal_outcomes[i] = 'won' THEN v_now - ((i)::text || ' days')::interval ELSE NULL END,
        true,
        (i % 4 = 0),
        (i % 3 = 0),
        v_lm_deal_outcomes[i]::public.deal_outcome,
        'clx',
        '{}'::jsonb,
        10 + (i % 12),
        v_now - ((i)::text || ' days')::interval,
        'Primary lender: ' || v_lender_types[i] || '. Backup: Regional Bank.',
        'LM-2026-' || lpad((200 + i)::text, 4, '0'),
        v_companies[i] || ' — Closing ' || to_char(v_now + (i || ' days')::interval, 'YYYY-MM'),
        (v_lm_deal_outcomes[i] = 'won'),
        CASE WHEN v_lm_deal_outcomes[i] = 'won' THEN v_now - ((i)::text || ' days')::interval ELSE NULL END,
        CASE WHEN v_lm_deal_outcomes[i] = 'won' THEN 'Best rate among 4 lenders; strong relationship with ' || v_lender_types[i] ELSE NULL END,
        ARRAY['lender-management', v_loan_categories[i], v_locations[i]]::text[]
      );
    END IF;
  END LOOP;

  -- =====================================================
  -- PEOPLE CRM: 20 contacts
  -- =====================================================
  -- A different roster: referral partners, attorneys, lenders, accountants
  -- so the People page reads like a real network, not a duplicate of pipelines.
  DECLARE
    p_names text[] := ARRAY[
      'Patrick Lyons','Jennifer Hsu','Marco DeLuca','Aiyana Redhawk','Theodore Bramwell',
      'Camila Restrepo','Henrik Sorensen','Naledi Mokoena','Ezekiel Okonkwo','Beatrix Lindqvist',
      'Rashid Al-Mansoori','Genevieve Boucher','Sebastian Voss','Imani Washington','Cyrus Tehrani',
      'Magdalena Kowalczyk','Tobias Reinhardt','Sunita Iyer','Hideo Yamazaki','Esperanza Ortega'
    ];
    p_companies text[] := ARRAY[
      'Lyons CPA Group','Hsu & Associates Law','DeLuca Commercial Brokerage','Redhawk Title Co','Bramwell Wealth Advisors',
      'Restrepo Commercial Insurance','Sorensen & Sons Bank','Mokoena Engineering','Okonkwo Tax Strategy','Lindqvist Real Estate',
      'Al-Mansoori Capital','Boucher Property Mgmt','Voss Lending Group','Washington Legal Services','Tehrani Appraisals',
      'Kowalczyk & Co Accountants','Reinhardt Construction Lending','Iyer Wealth Management','Yamazaki Architecture','Ortega Title & Escrow'
    ];
    p_titles text[] := ARRAY[
      'Managing Partner, CPA','Partner, Real Estate Law','Senior Broker','Title Officer','Wealth Advisor',
      'Commercial Insurance Producer','VP, Commercial Lending','PE, Civil Engineer','Tax Strategist','Broker / Owner',
      'Principal','Director of Operations','VP, Originations','Real Estate Attorney','Senior Appraiser',
      'CPA, Partner','SVP, Construction Loans','CFP, Senior Advisor','Principal, AIA','Title Officer'
    ];
    p_emails text[] := ARRAY[
      'patrick@lyonscpa.com','jennifer@hsulaw.com','marco@delucacre.com','aiyana@redhawktitle.com','ted@bramwellwealth.com',
      'camila@restrepoinsurance.com','henrik@sorensenbank.com','naledi@mokoenaeng.com','ezekiel@okonkwotax.com','beatrix@lindqvistre.com',
      'rashid@almansooricapital.com','genevieve@boucherpm.com','sebastian@vosslending.com','imani@washingtonlegal.com','cyrus@tehraniappraisals.com',
      'magda@kowalczykcpa.com','tobias@reinhardtlending.com','sunita@iyerwealth.com','hideo@yamazakiarch.com','esperanza@ortegatitle.com'
    ];
    p_phones text[] := ARRAY[
      '(312) 555-0188','(212) 555-0247','(305) 555-0312','(602) 555-0398','(214) 555-0421',
      '(404) 555-0489','(617) 555-0531','(404) 555-0612','(713) 555-0678','(206) 555-0743',
      '(212) 555-0824','(305) 555-0876','(415) 555-0921','(202) 555-0974','(312) 555-1032',
      '(773) 555-1098','(704) 555-1145','(415) 555-1203','(213) 555-1268','(602) 555-1329'
    ];
    p_contact_types text[] := ARRAY[
      'Referral Partner','Referral Partner','Other Service Provider','Other Service Provider','Other Service Provider',
      'Other Service Provider','Lender','Other Service Provider','Referral Partner','Other Service Provider',
      'Referral Partner','Other Service Provider','Lender','Referral Partner','Other Service Provider',
      'Referral Partner','Lender','Referral Partner','Other Service Provider','Other Service Provider'
    ];
    p_tags_csv text[] := ARRAY[
      'CPA,Top Referrer,Chicago',
      'Real Estate Law,NY,Closing Counsel',
      'Broker,Miami,Industrial',
      'Title,Phoenix',
      'Wealth,Dallas',
      'Insurance,Atlanta',
      'Bank,New England,Lender',
      'Engineering,Atlanta',
      'CPA,Tax,Houston',
      'Broker,Seattle,Multifamily',
      'Capital Partner,NY',
      'Property Management,FL',
      'Lender,SF Bay,Bridge',
      'Attorney,DC,Closing Counsel',
      'Appraisal,Chicago',
      'CPA,Chicago,Top Referrer',
      'Lender,Carolinas,Construction',
      'Wealth,SF Bay',
      'Architect,LA,Hospitality',
      'Title,Phoenix'
    ];
    p_about text[] := ARRAY[
      'Top CPA referral partner. Has sent 11 deals over the last 24 months, mostly owner-occupied CRE.',
      'Closing counsel for most NY-area transactions. Sharp, fast turnaround on docs.',
      'Active South Florida industrial broker. Sources deals 2-5M range.',
      'Title officer at Redhawk; coordinates Phoenix-area closings.',
      'Multi-family-office wealth advisor; refers high-net-worth borrowers seeking portfolio leverage.',
      'Insurance partner for hazard + liability on commercial properties.',
      'VP at Sorensen — competitive rates on owner-occupied loans up to $5M.',
      'Civil engineer; performs property-condition reports on construction deals.',
      'Tax strategist for sponsor structures; flags 1031/cost-seg opportunities.',
      'Pacific Northwest multifamily broker; great pipeline of stabilized 20-60 unit deals.',
      'Capital partner — co-invests on bridge deals $8M+.',
      'Property management firm; warm intros to landlords looking to refi.',
      'Bridge lender — fast quote on transitional deals $5-25M.',
      'Real estate attorney; reviews loan docs for borrower-side closings.',
      'MAI appraiser — fast turn on commercial appraisals across IL/IN/WI.',
      'CPA with deep CRE specialty; long-term Brad relationship.',
      'Construction lender — DSCR-based bridge + construction product.',
      'Wealth manager — multi-generational family clients with real estate exposure.',
      'Hospitality architect — referral source for hotel/restaurant projects.',
      'Title officer — Phoenix-area; backs up Aiyana when she is overloaded.'
    ];
    p_referral text[] := ARRAY[
      'Brad','Ilan','Adam','Brad','Ilan',
      'Adam','Brad','Adam','Brad','Ilan',
      'Adam','Ilan','Brad','Adam','Brad',
      'Brad','Adam','Ilan','Adam','Brad'
    ];
    p_websites text[] := ARRAY[
      'https://lyonscpa.com','https://hsulaw.com','https://delucacre.com','https://redhawktitle.com','https://bramwellwealth.com',
      'https://restrepoinsurance.com','https://sorensenbank.com','https://mokoenaeng.com','https://okonkwotax.com','https://lindqvistre.com',
      'https://almansooricapital.com','https://boucherpm.com','https://vosslending.com','https://washingtonlegal.com','https://tehraniappraisals.com',
      'https://kowalczykcpa.com','https://reinhardtlending.com','https://iyerwealth.com','https://yamazakiarch.com','https://ortegatitle.com'
    ];
    p_linkedins text[] := ARRAY[
      'https://linkedin.com/in/patrick-lyons','https://linkedin.com/in/jennifer-hsu','https://linkedin.com/in/marco-deluca','https://linkedin.com/in/aiyana-redhawk','https://linkedin.com/in/ted-bramwell',
      'https://linkedin.com/in/camila-restrepo','https://linkedin.com/in/henrik-sorensen','https://linkedin.com/in/naledi-mokoena','https://linkedin.com/in/ezekiel-okonkwo','https://linkedin.com/in/beatrix-lindqvist',
      'https://linkedin.com/in/rashid-almansoori','https://linkedin.com/in/genevieve-boucher','https://linkedin.com/in/sebastian-voss','https://linkedin.com/in/imani-washington','https://linkedin.com/in/cyrus-tehrani',
      'https://linkedin.com/in/magdalena-kowalczyk','https://linkedin.com/in/tobias-reinhardt','https://linkedin.com/in/sunita-iyer','https://linkedin.com/in/hideo-yamazaki','https://linkedin.com/in/esperanza-ortega'
    ];
  BEGIN
    FOR i IN 1..20 LOOP
      IF NOT EXISTS (SELECT 1 FROM public.people WHERE email = p_emails[i]) THEN
        INSERT INTO public.people (
          id, name, email, phone, title, company_name, contact_type,
          source, referral_source, about, notes, description, history,
          tags, linkedin, website, work_website,
          last_activity_at, last_contacted, source_system
        ) VALUES (
          gen_random_uuid(),
          p_names[i],
          p_emails[i],
          p_phones[i],
          p_titles[i],
          p_companies[i],
          p_contact_types[i],
          'Demo Seed',
          p_referral[i],
          p_about[i],
          'Demo CRM contact — generated for portfolio walkthrough.',
          p_about[i],
          'Connected via ' || p_referral[i] || ' network. Active relationship with ongoing referral flow.',
          string_to_array(p_tags_csv[i], ','),
          p_linkedins[i],
          p_websites[i],
          p_websites[i],
          v_now - ((i * 6)::text || ' hours')::interval,
          v_now - ((i)::text || ' days')::interval,
          'clx'
        );
      END IF;
    END LOOP;
  END;

  RAISE NOTICE 'Seeded 20 demo leads in each pipeline (60 total) + 20 People CRM contacts.';
END $$;
