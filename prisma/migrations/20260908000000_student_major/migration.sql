ALTER TABLE "Student" ADD COLUMN "major" TEXT;

DO $$
DECLARE
  old_id INTEGER;
  target_id INTEGER;
BEGIN
  SELECT id INTO old_id FROM "Department" WHERE name = 'Computer Science';
  IF old_id IS NOT NULL THEN
    SELECT id INTO target_id FROM "Department" WHERE name = 'Vincent Mary School of Engineering, Science and Technology';
    IF target_id IS NULL THEN
      UPDATE "Department" SET name = 'Vincent Mary School of Engineering, Science and Technology' WHERE id = old_id;
    ELSE
      UPDATE "User" SET "departmentId" = target_id WHERE "departmentId" = old_id;
      DELETE FROM "Department" WHERE id = old_id;
    END IF;
  END IF;

  SELECT id INTO old_id FROM "Department" WHERE name = 'Engineering';
  IF old_id IS NOT NULL THEN
    SELECT id INTO target_id FROM "Department" WHERE name = 'Martin de Tours School of Management and Economics';
    IF target_id IS NULL THEN
      UPDATE "Department" SET name = 'Martin de Tours School of Management and Economics' WHERE id = old_id;
    ELSE
      UPDATE "User" SET "departmentId" = target_id WHERE "departmentId" = old_id;
      DELETE FROM "Department" WHERE id = old_id;
    END IF;
  END IF;
END $$;

INSERT INTO "Department" (name) VALUES
  ('Martin de Tours School of Management and Economics'),
  ('Theodore Maria School of Arts'),
  ('Albert Laurence School of Communication Arts'),
  ('Vincent Mary School of Engineering, Science and Technology'),
  ('Montfort del Rosario School of Architecture and Design'),
  ('Theophane Venard School of Food Biotechnology & Innovation'),
  ('Thomas Aquinas School of Law'),
  ('Louis Nobiron School of Music'),
  ('Bernadette de Lourdes School of Nursing Science')
ON CONFLICT (name) DO NOTHING;
