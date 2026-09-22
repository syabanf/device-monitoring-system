-- Seeds the three distribution centers and one admin account each, so a fresh install has
-- someone who can sign in and build the rest of the master data from the dashboard.
--
-- Every account starts with the demo password "admin123". Change it before the install
-- faces real users: the hash below is public in this repository.
--
-- ON CONFLICT keeps the migration harmless on a database that already holds these rows, and
-- `pnpm db:seed` replaces them with the same ids when it loads the full demo data.

INSERT INTO distributor (id, code, name, region, city, address, admin_user_id) VALUES
  ('dst-sby', 'DC-SBY', 'Distribution Center Surabaya',      'Jawa Timur', 'Surabaya', 'Jl. Raya Industri No. 39, Surabaya', 'adm-001'),
  ('dst-jkt', 'DC-JKT', 'Distribution Center Jakarta Utara', 'DKI Jakarta', 'Jakarta Utara', 'Jl. Raya Industri No. 76, Jakarta Utara', 'adm-002'),
  ('dst-dps', 'DC-DPS', 'Distribution Center Denpasar',      'Bali',        'Denpasar', 'Jl. Raya Industri No. 63, Denpasar', 'adm-003')
ON CONFLICT DO NOTHING;

INSERT INTO admin_user (id, distributor_id, name, email, password_hash, role, avatar_color) VALUES
  ('adm-001', 'dst-sby', 'Dewi Anggraini', 'admin@indomaret.co.id',     'pbkdf2$210000$1f8d5552a58be993b503f54c9eb1581a$de0d132442cc6a0d7c436bbcb13ed19f3c477e373573e949e0bd7803d5ca8890', 'admin', '#9b1c1c'),
  ('adm-002', 'dst-jkt', 'Hendra Wijaya',  'admin.jkt@indomaret.co.id', 'pbkdf2$210000$1f8d5552a58be993b503f54c9eb1581a$de0d132442cc6a0d7c436bbcb13ed19f3c477e373573e949e0bd7803d5ca8890', 'admin', '#1d4ed8'),
  ('adm-003', 'dst-dps', 'Putu Mahendra',  'admin.dps@indomaret.co.id', 'pbkdf2$210000$1f8d5552a58be993b503f54c9eb1581a$de0d132442cc6a0d7c436bbcb13ed19f3c477e373573e949e0bd7803d5ca8890', 'admin', '#047857')
ON CONFLICT DO NOTHING;
