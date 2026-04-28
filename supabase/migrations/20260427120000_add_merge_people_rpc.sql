-- merge_people: atomically merge two rows in public.people.
--
-- Re-points the 4 junction tables that reference people.id from the loser
-- to the winner (de-duplicating on unique-pair conflicts), applies caller-
-- supplied resolved field values to the winner, then deletes the loser.
--
-- The whole body runs in a single transaction (per supabase.rpc call); any
-- RAISE rolls back every change.

CREATE OR REPLACE FUNCTION public.merge_people(
  p_winner_id uuid,
  p_loser_id  uuid,
  p_resolved_fields jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_winner_exists boolean;
  v_loser_exists  boolean;
  v_allowed_keys  text[] := ARRAY[
    'name','email','phone','title','company_name','company_id',
    'contact_type','tags','assigned_to','notes','linkedin','twitter',
    'source','referral_source','website','work_website','known_as',
    'about','description','history','last_activity_at','last_contacted'
  ];
  v_key text;
BEGIN
  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN
    RAISE EXCEPTION 'merge_people: winner_id and loser_id are required';
  END IF;

  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'merge_people: winner_id and loser_id must differ';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.people WHERE id = p_winner_id) INTO v_winner_exists;
  SELECT EXISTS (SELECT 1 FROM public.people WHERE id = p_loser_id ) INTO v_loser_exists;

  IF NOT v_winner_exists THEN
    RAISE EXCEPTION 'merge_people: winner % does not exist', p_winner_id;
  END IF;
  IF NOT v_loser_exists THEN
    RAISE EXCEPTION 'merge_people: loser % does not exist', p_loser_id;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_resolved_fields) LOOP
    IF NOT v_key = ANY(v_allowed_keys) THEN
      RAISE EXCEPTION 'merge_people: column % is not allowed in p_resolved_fields', v_key;
    END IF;
  END LOOP;

  -- company_people (unique pair: company_id, person_id)
  UPDATE public.company_people cp
     SET person_id = p_winner_id
   WHERE cp.person_id = p_loser_id
     AND NOT EXISTS (
       SELECT 1 FROM public.company_people cp2
        WHERE cp2.person_id = p_winner_id
          AND cp2.company_id = cp.company_id
     );
  DELETE FROM public.company_people WHERE person_id = p_loser_id;

  -- lender_management_people
  UPDATE public.lender_management_people lmp
     SET person_id = p_winner_id
   WHERE lmp.person_id = p_loser_id
     AND NOT EXISTS (
       SELECT 1 FROM public.lender_management_people lmp2
        WHERE lmp2.person_id = p_winner_id
          AND lmp2.lender_management_id = lmp.lender_management_id
     );
  DELETE FROM public.lender_management_people WHERE person_id = p_loser_id;

  -- potential_people
  UPDATE public.potential_people pp
     SET person_id = p_winner_id
   WHERE pp.person_id = p_loser_id
     AND NOT EXISTS (
       SELECT 1 FROM public.potential_people pp2
        WHERE pp2.person_id = p_winner_id
          AND pp2.potential_id = pp.potential_id
     );
  DELETE FROM public.potential_people WHERE person_id = p_loser_id;

  -- underwriting_people
  UPDATE public.underwriting_people up
     SET person_id = p_winner_id
   WHERE up.person_id = p_loser_id
     AND NOT EXISTS (
       SELECT 1 FROM public.underwriting_people up2
        WHERE up2.person_id = p_winner_id
          AND up2.underwriting_id = up.underwriting_id
     );
  DELETE FROM public.underwriting_people WHERE person_id = p_loser_id;

  -- Apply user-resolved field values to the winner.
  -- Empty string in JSON clears nullable text columns; for `name` (NOT NULL)
  -- an empty string would violate the constraint, so it's coerced via NULLIF
  -- and the constraint will raise (intentional safety).
  UPDATE public.people p SET
    name             = CASE WHEN p_resolved_fields ? 'name'             THEN NULLIF(p_resolved_fields->>'name','') ELSE p.name END,
    email            = CASE WHEN p_resolved_fields ? 'email'            THEN p_resolved_fields->>'email'            ELSE p.email END,
    phone            = CASE WHEN p_resolved_fields ? 'phone'            THEN p_resolved_fields->>'phone'            ELSE p.phone END,
    title            = CASE WHEN p_resolved_fields ? 'title'            THEN p_resolved_fields->>'title'            ELSE p.title END,
    company_name     = CASE WHEN p_resolved_fields ? 'company_name'     THEN p_resolved_fields->>'company_name'     ELSE p.company_name END,
    company_id       = CASE WHEN p_resolved_fields ? 'company_id'       THEN NULLIF(p_resolved_fields->>'company_id','')::uuid       ELSE p.company_id END,
    contact_type     = CASE WHEN p_resolved_fields ? 'contact_type'     THEN p_resolved_fields->>'contact_type'     ELSE p.contact_type END,
    tags             = CASE WHEN p_resolved_fields ? 'tags'
                              THEN (SELECT ARRAY(SELECT jsonb_array_elements_text(p_resolved_fields->'tags')))
                              ELSE p.tags END,
    assigned_to      = CASE WHEN p_resolved_fields ? 'assigned_to'      THEN NULLIF(p_resolved_fields->>'assigned_to','')::uuid      ELSE p.assigned_to END,
    notes            = CASE WHEN p_resolved_fields ? 'notes'            THEN p_resolved_fields->>'notes'            ELSE p.notes END,
    linkedin         = CASE WHEN p_resolved_fields ? 'linkedin'         THEN p_resolved_fields->>'linkedin'         ELSE p.linkedin END,
    twitter          = CASE WHEN p_resolved_fields ? 'twitter'          THEN p_resolved_fields->>'twitter'          ELSE p.twitter END,
    source           = CASE WHEN p_resolved_fields ? 'source'           THEN p_resolved_fields->>'source'           ELSE p.source END,
    referral_source  = CASE WHEN p_resolved_fields ? 'referral_source'  THEN p_resolved_fields->>'referral_source'  ELSE p.referral_source END,
    website          = CASE WHEN p_resolved_fields ? 'website'          THEN p_resolved_fields->>'website'          ELSE p.website END,
    work_website     = CASE WHEN p_resolved_fields ? 'work_website'     THEN p_resolved_fields->>'work_website'     ELSE p.work_website END,
    known_as         = CASE WHEN p_resolved_fields ? 'known_as'         THEN p_resolved_fields->>'known_as'         ELSE p.known_as END,
    about            = CASE WHEN p_resolved_fields ? 'about'            THEN p_resolved_fields->>'about'            ELSE p.about END,
    description      = CASE WHEN p_resolved_fields ? 'description'      THEN p_resolved_fields->>'description'      ELSE p.description END,
    history          = CASE WHEN p_resolved_fields ? 'history'          THEN p_resolved_fields->>'history'          ELSE p.history END,
    last_activity_at = CASE WHEN p_resolved_fields ? 'last_activity_at' THEN NULLIF(p_resolved_fields->>'last_activity_at','')::timestamptz ELSE p.last_activity_at END,
    last_contacted   = CASE WHEN p_resolved_fields ? 'last_contacted'   THEN NULLIF(p_resolved_fields->>'last_contacted','')::timestamptz   ELSE p.last_contacted END,
    updated_at       = now()
   WHERE p.id = p_winner_id;

  DELETE FROM public.people WHERE id = p_loser_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) TO authenticated;
