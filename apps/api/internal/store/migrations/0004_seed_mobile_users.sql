-- Seeds one outlet employee and one technician per distribution center, so the mobile app has
-- accounts to sign in with on a fresh install, next to the admins from 0003. Employees belong to
-- outlets, so the outlets they work at come along.
--
-- The mobile app signs in with an email and a registration token. These tokens are public in
-- this repository: an admin should issue new ones in User Management before real staff use the
-- app.
--
-- Ids and values match packages/fixtures, and ON CONFLICT skips rows that already exist, so
-- `pnpm db:seed` loads the full demo data over them without a clash.

INSERT INTO outlet (id, distributor_id, code, name, address, city, province, lat, lng, maps_url, open_time, close_time, timezone, phone) VALUES
  ('out-001', 'dst-sby', 'IDM-SBY-0001', 'Indomaret Margorejo 1',     'Jl. Margorejo No. 92, Surabaya, Jawa Timur',          'Surabaya',      'Jawa Timur',  -0.05403, 0.07517, 'https://maps.google.com/?q=-0.05403,0.07517', '07:00', '22:00', 'Asia/Jakarta',  '031-5555687'),
  ('out-002', 'dst-sby', 'IDM-SBY-0002', 'Indomaret Rungkut 1',       'Jl. Rungkut No. 92, Surabaya, Jawa Timur',            'Surabaya',      'Jawa Timur',   0.01757, 0.12751, 'https://maps.google.com/?q=0.01757,0.12751',  '07:00', '22:00', 'Asia/Jakarta',  '031-5364030'),
  ('out-021', 'dst-jkt', 'IDM-JKT-0001', 'Indomaret Permata Intan 1', 'Jl. Permata Intan No. 95, Jakarta Utara, DKI Jakarta', 'Jakarta Utara', 'DKI Jakarta', -0.03528, 0.16586, 'https://maps.google.com/?q=-0.03528,0.16586', '07:00', '22:00', 'Asia/Jakarta',  '021-7813409'),
  ('out-028', 'dst-dps', 'IDM-DPS-0003', 'Indomaret Sesetan 1',       'Jl. Sesetan No. 20, Denpasar, Bali',                  'Denpasar',      'Bali',         0.02923, 0.06574, 'https://maps.google.com/?q=0.02923,0.06574',  '07:00', '22:00', 'Asia/Makassar', '0361-8941150')
ON CONFLICT DO NOTHING;

INSERT INTO employee (id, distributor_id, primary_outlet_id, name, phone, email, role, registration_token, registration_status, registered_at, approved_at, avatar_color) VALUES
  ('emp-demo', 'dst-sby', 'out-001', 'Rizky Pratama', '081234567890', 'user123@indomaret.co.id',        'store_manager', '9634871231', 'approved', now(), now(), '#9b1c1c'),
  ('emp-101',  'dst-jkt', 'out-021', 'Dewi Kusuma',   '086063424748', 'dewi.kusuma101@indomaret.co.id', 'store_manager', '5519965858', 'approved', now(), now(), '#4d7c0f'),
  ('emp-136',  'dst-dps', 'out-028', 'Dian Gunawan',  '083212810675', 'dian.gunawan136@indomaret.co.id', 'store_manager', '3553120696', 'approved', now(), now(), '#be185d')
ON CONFLICT DO NOTHING;

INSERT INTO employee_outlet (employee_id, outlet_id) VALUES
  ('emp-demo', 'out-001'),
  ('emp-demo', 'out-002'),
  ('emp-101',  'out-021'),
  ('emp-136',  'out-028')
ON CONFLICT DO NOTHING;

INSERT INTO technician (id, distributor_id, name, phone, specialty, avatar_color, email, registration_token) VALUES
  ('tech-001', 'dst-sby', 'Andi Saputra',  '086811216865', 'Room Alert hardware', '#6d28d9', 'tech@wit.id',          '2468013579'),
  ('tech-004', 'dst-jkt', 'Eko Purnama',   '086711176657', 'Room Alert hardware', '#9b1c1c', 'eko.purnama@wit.id',   '6893220859'),
  ('tech-007', 'dst-dps', 'Intan Pratama', '089516427089', 'Room Alert hardware', '#4d7c0f', 'intan.pratama@wit.id', '4589475365')
ON CONFLICT DO NOTHING;
