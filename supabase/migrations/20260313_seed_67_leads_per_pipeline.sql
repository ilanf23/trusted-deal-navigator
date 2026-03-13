-- ============================================================
-- Seed exactly 67 mock leads per pipeline (201 total)
-- Distributes leads across stages within each pipeline
-- ============================================================

DO $$
DECLARE
  v_potential_id uuid;
  v_underwriting_id uuid;
  v_lender_id uuid;
  v_stage_id uuid;
  v_lead_id uuid;
  v_names text[] := ARRAY[
    'Alex Thompson','Beth Callahan','Carlos Rivera','Diana Frost','Edward Huang',
    'Fiona Walsh','George Nakamura','Hannah Petrov','Isaac Delgado','Julia Brennan',
    'Kevin Okafor','Laura Sinclair','Michael Benton','Nina Johansson','Oscar Fuentes',
    'Patricia Dunn','Quincy Albright','Rita Kapoor','Steven Marsh','Tanya Volkov',
    'Ulysses Grant','Vanessa Holt','Wesley Chang','Xena Torres','Yusuf Ahmed',
    'Zara Mitchell','Aaron Brooks','Brianna Soto','Clayton Voss','Deborah Keane',
    'Eliot Chambers','Francesca Lowe','Graham Patel','Heidi Zimmerman','Ivan Cruz',
    'Jasmine Tate','Karl Lindgren','Leona Diaz','Morgan Ashby','Naomi Reeves',
    'Owen Gallagher','Penny Stratton','Reed McAllister','Sienna Cho','Trevor Blackwell',
    'Uma Krishnan','Victor Espinoza','Wanda Liu','Xavier Dumont','Yolanda Fields',
    'Zachary Pearson','Abigail Stone','Bernard Fox','Celine Moreau','Dominic Russo',
    'Evelyn Harper','Felix Gutierrez','Gloria Fang','Hugo Andersen','Iris Kowalski',
    'Jake Donovan','Katrina Pham','Liam Shepherd','Meredith Yates','Nigel Barton',
    'Olivia Chen','Patrick Doyle','Quinn Hartley','Renata Silva','Samuel Ortiz',
    'Theresa Blake','Uri Goldberg','Valerie Dunn','Winston Hayes','Ximena Rojas',
    'Yannick Beaumont','Zelda Hoffman','Aiden Cross','Bethany Rowe','Caleb Nguyen',
    'Daphne Wells','Ethan Mercer','Felicity Rhodes','Garrett Bloom','Hazel Stark',
    'Ingrid Bowen','Jackson Ware','Kira Pennington','Lorenzo Bianchi','Maya Hendricks',
    'Nathan Foley','Opal Richardson','Preston Cole','Rosalind Park','Sergio Mendez',
    'Tamara Whitfield','Upton Graves','Vivian Mosley','Warren Pike','Xander Quinn',
    'Yasmin Farrell','Zane Caldwell','Alicia Baxter','Brandon Leung','Cassandra Moon',
    'Derek Swanson','Elena Vasquez','Franklin Howe','Greta Nolan','Harvey Jensen',
    'Imani Scott','Joel Carpenter','Kelsey Briggs','Lance Avery','Monica Tanaka',
    'Nolan Fritz','Ophelia Grant','Percy Maxwell','Ramona West','Spencer Kirk',
    'Tiffany Lam','Ulrich Brandt','Vera Sutton','Wyatt Fleming','Yosef Abrams',
    'Zoe Chandler','Arlo Jennings','Brenda Pace','Curtis Mathews','Dolores Griffin',
    'Elliot Saunders','Faith Connors','Gavin Hurst','Holly Pearce','Isaiah Moran',
    'Joanna Finch','Kendall Reese','Lionel Banks','Mabel Thorpe','Nathaniel Crane',
    'Oona Byrne','Phillip Stokes','Rosa Jimenez','Stewart Lamb','Tricia Emery',
    'Ursula Kemp','Vance Collier','Wendy Archer','Xyla Brennan','Yuri Volkov',
    'Zinnia Drake','Angus Pratt','Beatrice Hull','Conrad Nash','Delia Forrest',
    'Emilio Garza','Flora Beckett','Gordon Steele','Harriet Long','Ira Whitmore',
    'Janine Cook','Keith Ramsey','Lydia Vance','Miles Crawford','Nadia Frost',
    'Otis Shelby','Paloma Grey','Reginald Thorn','Sonia Marx','Tobias Glenn',
    'Unity Sharp','Vernon Dale','Winifred Oaks','Xenos Pappas','Yael Stern',
    'Zander Cobb','Alma Decker','Basil Winters','Corinne Flood','Darcy Hewitt',
    'Enrique Sosa','Freya Monroe','Gideon Chase','Helene Brock','Ivan Marsh',
    'Josephine Nye','Keegan Wolfe','Lila Barton','Marshall Day','Neva Holmes',
    'Orion Sage','Petra Lang','Ruben Hale','Selma Todd','Tyrone Paige',
    'Ursa Bright','Vaughn Stone','Wilma Ridge','Xerxes Platt','Yvette Cline',
    'Zion Ferry'
  ];
  v_companies text[] := ARRAY[
    'Summit Capital LLC','Horizon Ventures','Atlas Property Group','Pinnacle Holdings','Bridgewater Investments',
    'Clearview Realty','Emerald Partners','Falcon Equity','Gateway Development','Harbor Point LLC',
    'Ironclad Properties','Juniper Capital','Keystone Real Estate','Lakewood Partners','Meridian Group',
    'Northstar Funding','Olympus Realty','Pacific Crest Holdings','Quantum Properties','Ridgeline Capital',
    'Sapphire Investments','Titan Real Estate','Unity Capital','Vanguard Properties','Westfield Holdings',
    'Apex Development Corp','Bayshore Partners','Cascade Equity','Diamond Ridge LLC','Eastgate Capital',
    'Firestone Properties','Greenfield Ventures','Highland Capital Group','Imperial Realty','Jade Stone Holdings',
    'Kingston Development','Liberty Property Trust','Monarch Capital','Newport Holdings','Oakridge Ventures',
    'Patriot Real Estate','Redwood Capital LLC','Silverline Properties','Trident Investments','Upland Group',
    'Vista Capital Partners','Windrose Holdings','Zenith Property Group','Aspen Creek LLC','Bluerock Capital',
    'Cornerstone Realty','Driftwood Partners','Evergreen Holdings','Frontier Capital','Golden Gate Ventures',
    'Hearthstone Properties','Ivory Coast LLC','Jasper Holdings','Kingswood Capital','Legacy Partners',
    'Magnolia Properties','Noble Capital Group','Orchard Valley LLC','Prairie Capital','Quartz Holdings',
    'Riverstone Ventures','Stonebridge Properties','Timberline Capital','Urbana Holdings','Valley Vista LLC',
    'Whitehall Group','York Capital Partners','Alpine Summit LLC','Brickfield Ventures','Crescent Holdings',
    'Dune Capital LLC','Eclipse Properties','Foxwood Ventures','Granite Peak Holdings','Haven Capital',
    'Indigo Properties','Jupiter Holdings','Kestrel Capital','Lighthouse Ventures','Mesa Verde LLC',
    'Nighthawk Properties','Onyx Capital Group','Palisade Holdings','Quail Ridge LLC','Rosewood Partners',
    'Sequoia Ventures','Tidewater Capital','Underhill Properties','Verde Capital','Weston Holdings',
    'Xanadu Realty','Yarrow Capital','Zephyr Holdings','Ashford Partners','Beacon Capital',
    'Cedar Point LLC','Dominion Holdings','Edgewater Ventures','Fieldstone Capital','Glenwood Properties',
    'Hawthorne Capital','Inlet Properties','Junewood Ventures','Kensington Holdings','Lantern Capital',
    'Midtown Ventures','Newhaven Capital','Overland Partners','Pebble Creek LLC','Quartermain Holdings',
    'Riverbend Capital','Springdale Properties','Thornhill Ventures','Union Square Capital','Vineyard Holdings',
    'Wainwright LLC','Xcel Properties','Yellowstone Capital','Zinfandel Holdings','Acorn Capital',
    'Bellflower Properties','Coventry Holdings','Daybreak Ventures','Edgefield Capital','Foxglove LLC',
    'Glendale Partners','Hillcrest Holdings','Ironwood Ventures','Jade Creek Capital','Kirkland Properties',
    'Laurelwood Holdings','Mapleridge Capital','Northwood Ventures','Oakview Partners','Parkside Holdings',
    'Queensbury Capital','Ravencrest LLC','Sunstone Properties','Thornton Ventures','Uniondale Capital',
    'Valleyforge Holdings','Woodhaven Partners','Xander Capital','Yellowfin Ventures','Zanzibar Holdings',
    'Arcadia Properties'
  ];
  v_sources text[] := ARRAY['Referral','Website','Cold Call','LinkedIn','Partner','Conference','Rate Watch Import','Email Campaign','Direct Mail','Existing Client'];
  v_collateral text[] := ARRAY['Office Building','Retail Center','Industrial Warehouse','Multifamily','Mixed-Use','Medical Office','Self-Storage','Hotel','Shopping Center','Flex Space','Data Center','Senior Living','Student Housing','Mobile Home Park','Restaurant'];
  v_locations text[] := ARRAY['Chicago, IL','New York, NY','Los Angeles, CA','Miami, FL','Dallas, TX','Atlanta, GA','Denver, CO','Seattle, WA','Boston, MA','Phoenix, AZ','San Francisco, CA','Nashville, TN','Charlotte, NC','Portland, OR','Austin, TX','Tampa, FL','San Diego, CA','Minneapolis, MN','Salt Lake City, UT','Raleigh, NC'];
  v_statuses_potential text[] := ARRAY['discovery','questionnaire','pre_qualification','onboarding','initial_review','discovery','discovery'];
  v_statuses_uw text[] := ARRAY['moving_to_underwriting','underwriting','document_collection','ready_for_wu_approval','waiting_on_needs_list','waiting_on_client','complete_files_for_review','need_structure_from_brad','maura_underwriting','brad_underwriting'];
  v_statuses_lm text[] := ARRAY['pre_approval_issued','approval','funded','won','pre_approval_issued','approval','funded','pre_approval_issued'];
  -- Stage arrays per pipeline (names must match DB)
  v_potential_stages text[] := ARRAY['Initial Contact','Incoming - On Hold','In Process - On Hold','Waiting on Client to move forward','Complete Files for Review','Maura Underwriting','Ready for WU Approval'];
  v_uw_stages text[] := ARRAY['Review Kill / Keep','Initial Review','Waiting on Needs List','Waiting on Client','Complete Files for Review','Need Structure from Brad','Maura Underwriting','Brad Underwriting','UW Paused','Ready for WU Approval'];
  v_lm_stages text[] := ARRAY['Out for Review','Out for Approval','Waiting on Borrower','Term Sheet Issued','Waiting on Borrower - Final Docs','Lender & Client working towards closing','Closing Scheduled','Loan Closed'];
  v_stage_name text;
  v_status text;
  v_deal_value int;
  i int;
BEGIN
  -- Get pipeline IDs
  SELECT id INTO v_potential_id FROM public.pipelines WHERE name = 'Potential' AND is_system = true LIMIT 1;
  SELECT id INTO v_underwriting_id FROM public.pipelines WHERE name = 'Underwriting' AND is_system = true LIMIT 1;
  SELECT id INTO v_lender_id FROM public.pipelines WHERE name = 'Lender Management' AND is_system = true LIMIT 1;

  IF v_potential_id IS NULL OR v_underwriting_id IS NULL OR v_lender_id IS NULL THEN
    RAISE EXCEPTION 'System pipelines not found. Run copper pipelines seed first.';
  END IF;

  -- =====================================================
  -- POTENTIAL pipeline: 67 leads (indices 1..67)
  -- =====================================================
  FOR i IN 1..67 LOOP
    v_stage_name := v_potential_stages[1 + ((i - 1) % array_length(v_potential_stages, 1))];
    v_status := v_statuses_potential[1 + ((i - 1) % array_length(v_statuses_potential, 1))];
    v_deal_value := 500000 + (i * 73000);

    INSERT INTO public.leads (id, name, email, phone, company_name, source, status, deal_value, description)
    VALUES (
      gen_random_uuid(),
      v_names[i],
      lower(replace(v_names[i], ' ', '.')) || '@' || lower(replace(replace(v_companies[i], ' ', ''), '''', '')) || '.com',
      '(555) ' || lpad((100 + i)::text, 3, '0') || '-' || lpad((1000 + i * 13)::text, 4, '0'),
      v_companies[i],
      v_sources[1 + ((i - 1) % array_length(v_sources, 1))],
      v_status::public.lead_status,
      v_deal_value,
      v_collateral[1 + ((i - 1) % array_length(v_collateral, 1))] || ' in ' || v_locations[1 + ((i - 1) % array_length(v_locations, 1))]
    )
    RETURNING id INTO v_lead_id;

    SELECT ps.id INTO v_stage_id
    FROM public.pipeline_stages ps
    WHERE ps.pipeline_id = v_potential_id AND ps.name = v_stage_name
    LIMIT 1;

    INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
    VALUES (v_potential_id, v_lead_id, v_stage_id)
    ON CONFLICT (pipeline_id, lead_id) DO NOTHING;
  END LOOP;

  -- =====================================================
  -- UNDERWRITING pipeline: 67 leads (indices 68..134)
  -- =====================================================
  FOR i IN 68..134 LOOP
    v_stage_name := v_uw_stages[1 + ((i - 68) % array_length(v_uw_stages, 1))];
    v_status := v_statuses_uw[1 + ((i - 68) % array_length(v_statuses_uw, 1))];
    v_deal_value := 800000 + ((i - 67) * 91000);

    INSERT INTO public.leads (id, name, email, phone, company_name, source, status, deal_value, description)
    VALUES (
      gen_random_uuid(),
      v_names[i],
      lower(replace(v_names[i], ' ', '.')) || '@' || lower(replace(replace(v_companies[i], ' ', ''), '''', '')) || '.com',
      '(555) ' || lpad((200 + (i - 67))::text, 3, '0') || '-' || lpad((2000 + (i - 67) * 17)::text, 4, '0'),
      v_companies[i],
      v_sources[1 + ((i - 1) % array_length(v_sources, 1))],
      v_status::public.lead_status,
      v_deal_value,
      v_collateral[1 + ((i - 1) % array_length(v_collateral, 1))] || ' in ' || v_locations[1 + ((i - 1) % array_length(v_locations, 1))]
    )
    RETURNING id INTO v_lead_id;

    SELECT ps.id INTO v_stage_id
    FROM public.pipeline_stages ps
    WHERE ps.pipeline_id = v_underwriting_id AND ps.name = v_stage_name
    LIMIT 1;

    INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
    VALUES (v_underwriting_id, v_lead_id, v_stage_id)
    ON CONFLICT (pipeline_id, lead_id) DO NOTHING;
  END LOOP;

  -- =====================================================
  -- LENDER MANAGEMENT pipeline: 67 leads (indices 135..201)
  -- =====================================================
  FOR i IN 135..201 LOOP
    v_stage_name := v_lm_stages[1 + ((i - 135) % array_length(v_lm_stages, 1))];
    v_status := v_statuses_lm[1 + ((i - 135) % array_length(v_statuses_lm, 1))];
    v_deal_value := 1200000 + ((i - 134) * 85000);

    INSERT INTO public.leads (id, name, email, phone, company_name, source, status, deal_value, description)
    VALUES (
      gen_random_uuid(),
      v_names[i],
      lower(replace(v_names[i], ' ', '.')) || '@' || lower(replace(replace(v_companies[i], ' ', ''), '''', '')) || '.com',
      '(555) ' || lpad((300 + (i - 134))::text, 3, '0') || '-' || lpad((3000 + (i - 134) * 19)::text, 4, '0'),
      v_companies[i],
      v_sources[1 + ((i - 1) % array_length(v_sources, 1))],
      v_status::public.lead_status,
      v_deal_value,
      v_collateral[1 + ((i - 1) % array_length(v_collateral, 1))] || ' in ' || v_locations[1 + ((i - 1) % array_length(v_locations, 1))]
    )
    RETURNING id INTO v_lead_id;

    SELECT ps.id INTO v_stage_id
    FROM public.pipeline_stages ps
    WHERE ps.pipeline_id = v_lender_id AND ps.name = v_stage_name
    LIMIT 1;

    INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
    VALUES (v_lender_id, v_lead_id, v_stage_id)
    ON CONFLICT (pipeline_id, lead_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Seeded 201 leads: 67 Potential, 67 Underwriting, 67 Lender Management';
END $$;
