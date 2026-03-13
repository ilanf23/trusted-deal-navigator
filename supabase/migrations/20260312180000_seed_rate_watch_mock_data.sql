-- Seed 10 mock leads and rate_watch entries for development/demo purposes
-- Each lead gets a corresponding rate_watch entry with realistic commercial lending data

-- 1. Marcus Chen - Office building, ready to refinance (rate at target)
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Marcus Chen', 'marcus.chen@silverlakedev.com', '(312) 555-0147', 'Silver Lake Development', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email, initial_review, last_contacted_at)
    VALUES (lid, 6.25, 6.50, 'Commercial Real Estate', 2850000, true, 'Office Building', 4200000, 'Chicago, IL', 'Fixed', 10, '25 years', 'Regional Bank', 185000, 'Office / Class A', 100, '2028-06-15', '2% declining', 'Lower monthly payment, better terms', 'Strong borrower, 780+ FICO. Looking to lock in before maturity.', true, 'Approved', '2026-03-01T14:30:00Z');
  END IF;
END $$;

-- 2. Rachel Goldstein - Retail center, watching (close to target)
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Rachel Goldstein', 'rachel@goldsteinproperties.com', '(646) 555-0293', 'Goldstein Properties LLC', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email, initial_review)
    VALUES (lid, 7.10, 6.75, 'Commercial Real Estate', 5400000, true, 'Retail Center', 7800000, 'Brooklyn, NY', 'Fixed', 7, '30 years', 'CMBS', 320000, 'Retail / Multi-Tenant', 0, '2027-11-01', '1% flat', 'Rate reduction, extend term', 'NNN leases, 92% occupied. Anchor tenant renews 2027.', true, 'Pending');
  END IF;
END $$;

-- 3. David Park - Industrial warehouse, watching
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('David Park', 'dpark@parklogistics.com', '(714) 555-0184', 'Park Logistics Inc', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email)
    VALUES (lid, 7.85, 6.50, 'Commercial Real Estate', 3200000, true, 'Industrial Warehouse', 5100000, 'Anaheim, CA', 'Variable', 5, '20 years', 'Credit Union', 210000, 'Industrial / Logistics', 75, '2029-03-01', 'None', 'Convert variable to fixed, reduce rate', 'Index: SOFR + 275bps. Wants to lock fixed before rates move.', true);
  END IF;
END $$;

-- 4. Sarah Martinez - Mixed-use, ready to refinance
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Sarah Martinez', 'smartinez@sunbeltcapital.com', '(305) 555-0362', 'Sunbelt Capital Group', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, seeking_to_improve, notes, confirm_email, initial_review, last_contacted_at)
    VALUES (lid, 5.90, 6.25, 'Commercial Real Estate', 8750000, true, 'Mixed-Use', 12500000, 'Miami, FL', 'Fixed', 10, '25 years', 'Life Insurance Co', 540000, 'Mixed-Use / Retail + Residential', 30, '2028-09-01', 'Better terms, cash-out for renovation', 'Class A mixed-use in Brickell. Ground floor retail 100% leased. Seeking cash-out for upper floor reno.', true, 'Approved', '2026-02-28T10:00:00Z');
  END IF;
END $$;

-- 5. James O'Brien - SBA loan, watching
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('James O''Brien', 'jobrien@obrienauto.com', '(617) 555-0428', 'O''Brien Auto Group', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email)
    VALUES (lid, 8.25, 7.00, 'SBA', 1850000, true, 'Auto Dealership', 3400000, 'Boston, MA', 'Variable', 25, '25 years', 'SBA Preferred Lender', 125000, 'Auto Dealership / Owner-Occupied', 100, '2031-06-01', 'None', 'Lower rate, potentially convert to conventional', 'SBA 504 loan. Prime + 2.75%. Strong cash flow, been paying 6 years. May qualify for conventional refi.', false);
  END IF;
END $$;

-- 6. Linda Tran - Multifamily, close to target
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Linda Tran', 'linda@trantreeproperties.com', '(503) 555-0571', 'Trantree Properties', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email, initial_review, last_contacted_at)
    VALUES (lid, 6.80, 6.50, 'Commercial Real Estate', 4100000, true, 'Multifamily (24 units)', 6200000, 'Portland, OR', 'Fixed', 7, '30 years', 'Agency (Fannie)', 275000, 'Multifamily / Workforce Housing', 0, '2027-08-01', '1% yield maintenance', 'Rate reduction, extend term past maturity', '24-unit workforce housing. 96% occupied. DSCR 1.45x. Agency eligible.', true, 'Approved', '2026-03-05T16:15:00Z');
  END IF;
END $$;

-- 7. Robert Kim - Hotel, watching (far from target)
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Robert Kim', 'rkim@pacificshore.com', '(808) 555-0639', 'Pacific Shore Hospitality', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes)
    VALUES (lid, 8.50, 7.00, 'Commercial Real Estate', 12000000, true, 'Hotel (120 rooms)', 18000000, 'Honolulu, HI', 'Variable', 5, '25 years', 'CMBS', 890000, 'Hospitality / Full-Service Hotel', 0, '2027-05-01', '3% declining over 3 years', 'Rate reduction, convert to fixed', 'Boutique hotel near Waikiki. RevPAR recovering post-COVID. SOFR + 325bps. Wants fixed rate stability.');
  END IF;
END $$;

-- 8. Amanda Foster - Medical office, ready
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Amanda Foster', 'afoster@fostermedical.com', '(480) 555-0712', 'Foster Medical Partners', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, seeking_to_improve, notes, confirm_email, initial_review, last_contacted_at)
    VALUES (lid, 6.00, 6.25, 'Commercial Real Estate', 1950000, true, 'Medical Office', 2800000, 'Scottsdale, AZ', 'Fixed', 10, '25 years', 'Community Bank', 145000, 'Medical Office / Single Tenant', 100, '2029-01-15', 'Extend term, cash-out for expansion', '3-location medical practice. Owner-occupied. Wants to cash out equity for 4th location buildout.', true, 'Approved', '2026-03-08T09:45:00Z');
  END IF;
END $$;

-- 9. Tony Russo - Equipment loan, watching
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Tony Russo', 'trusso@russocontractors.com', '(201) 555-0845', 'Russo & Sons Contractors', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email)
    VALUES (lid, 9.10, 7.50, 'Equipment', 780000, true, 'Heavy Construction Equipment', 1200000, 'Newark, NJ', 'Fixed', 5, '5 years', 'Equipment Finance Co', 95000, 'Construction / Heavy Equipment', 100, '2028-04-01', 'None', 'Lower rate on equipment line', 'Fleet of excavators and cranes. Current lender gave high rate due to industry risk. Shopping for better terms.', true);
  END IF;
END $$;

-- 10. Michelle Wang - Self-storage, close to target
DO $$
DECLARE
  lid uuid;
BEGIN
  INSERT INTO leads (name, email, phone, company_name, source, status)
  VALUES ('Michelle Wang', 'mwang@safeguardstorage.com', '(512) 555-0963', 'Safeguard Storage Partners', 'Rate Watch Import', 'discovery')
  ON CONFLICT DO NOTHING
  RETURNING id INTO lid;
  IF lid IS NOT NULL THEN
    INSERT INTO rate_watch (lead_id, current_rate, target_rate, loan_type, loan_amount, is_active, collateral_type, collateral_value, re_location, rate_type, original_term_years, amortization, lender_type, estimated_cf, occupancy_use, owner_occupied_pct, loan_maturity, penalty, seeking_to_improve, notes, confirm_email, initial_review)
    VALUES (lid, 7.15, 6.75, 'Commercial Real Estate', 6500000, true, 'Self-Storage (300 units)', 9500000, 'Austin, TX', 'Fixed', 10, '25 years', 'Regional Bank', 420000, 'Self-Storage / Climate Controlled', 0, '2028-12-01', '1% flat first 3 years', 'Rate reduction, potential acquisition financing', '300-unit climate controlled facility. 89% occupied. Strong NOI growth. May want to acquire adjacent parcel.', true, 'Pending');
  END IF;
END $$;
