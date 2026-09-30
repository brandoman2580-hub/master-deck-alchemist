-- Phase 1b: hard-cap persisted decks per account (75). Soft warn (60) is client-only.
-- Enforced on INSERT only; updates to existing rows are unaffected.

CREATE OR REPLACE FUNCTION public.enforce_deck_account_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  deck_count integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO deck_count
  FROM public.decks
  WHERE user_id = NEW.user_id;

  IF deck_count >= 75 THEN
    RAISE EXCEPTION 'DECK_CAP_EXCEEDED: Maximum of 75 decks per account'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_deck_account_cap ON public.decks;

CREATE TRIGGER trg_enforce_deck_account_cap
BEFORE INSERT ON public.decks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_deck_account_cap();

COMMENT ON FUNCTION public.enforce_deck_account_cap() IS
  'Hard-cap: block INSERT when the user already has >= 75 decks (Phase 1b).';
