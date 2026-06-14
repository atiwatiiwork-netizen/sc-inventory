-- ============================================================================
--  SC Inventory Management — Seed data
--  Mirrors the Claude Design prototype (data.js): ~50 SKUs, 5 categories,
--  4 customer groups, 4 workers. Run AFTER schema.sql.
--  Idempotent: re-running upserts the same rows.
-- ============================================================================

-- ---- reporting units (extensible) ----
insert into public.report_units (id, th, sort) values
  ('pcs','ชิ้น',1), ('m','เมตร',2), ('kg','กิโลกรัม',3),
  ('box','กล่อง',4), ('can','กระป๋อง',5), ('carton','ลัง',6),
  ('liter','ลิตร',7), ('roll','ม้วน',8), ('unit','หน่วย',9)
on conflict (id) do update set th = excluded.th, sort = excluded.sort;

-- ---- visualization types ----
insert into public.viz_types (id, th, en) values
  ('rail','ตารางราง + เมตร','Rail matrix + meters'),
  ('product','แยกตามสินค้า','By product'),
  ('trend','แนวโน้มการใช้','Consumption trend')
on conflict (id) do update set th = excluded.th, en = excluded.en;

-- ---- categories ----
insert into public.categories
  (id, name, name_en, display_order, report_unit, report_unit_th, secondary_unit, secondary_unit_th, viz, active, archived) values
  ('rails',       'รางเหล็ก',       'Steel Rails',     1, 'm',   'เมตร',   'pcs', 'เส้น', 'rail',    true, false),
  ('screws',      'สกรู / น็อต',     'Screws & Bolts',  2, 'box', 'กล่อง',  null,  null,   'product', true, false),
  ('paint',       'สี / เคลือบ',     'Paint & Coating', 3, 'can', 'กระป๋อง', null,  null,   'product', true, false),
  ('parts',       'อะไหล่',          'Spare Parts',     4, 'pcs', 'ชิ้น',   null,  null,   'product', true, false),
  ('consumables', 'วัสดุสิ้นเปลือง', 'Consumables',     5, 'unit','หน่วย',  null,  null,   'trend',   true, false)
on conflict (id) do update set
  name = excluded.name, name_en = excluded.name_en, display_order = excluded.display_order,
  report_unit = excluded.report_unit, report_unit_th = excluded.report_unit_th,
  secondary_unit = excluded.secondary_unit, secondary_unit_th = excluded.secondary_unit_th,
  viz = excluded.viz, active = excluded.active, archived = excluded.archived;

-- ---- customer groups ----
insert into public.customer_groups (id, name, name_en, active) values
  ('bkk',    'ลูกค้าท้องถิ่น กรุงเทพ',   'Local Bangkok',           true),
  ('upc',    'ลูกค้าท้องถิ่น ต่างจังหวัด', 'Local Upcountry',         true),
  ('truck',  'รถส่งต่างจังหวัด',          'Upcountry Delivery Truck', true),
  ('modern', 'โมเดิร์นเทรด',             'Modern Trade',            true)
on conflict (id) do update set name = excluded.name, name_en = excluded.name_en, active = excluded.active;

-- ---- workers (default PINs from the spec) ----
insert into public.workers (code, name, name_en, pin, active) values
  ('EMP001','สมชาย',   'Worker 1','1111', true),
  ('EMP002','สมหญิง',  'Worker 2','2222', true),
  ('EMP003','วิชัย',    'Worker 3','3333', true),
  ('EMP004','ประเสริฐ', 'Worker 4','4444', true)
on conflict (code) do update set name = excluded.name, name_en = excluded.name_en, pin = excluded.pin, active = excluded.active;

-- ---- products: steel rails (size × length matrix) ----
insert into public.products
  (sku, name, name_en, category_id, unit, unit_en, size, length, length_m, stock, min_stock, display_order, active) values
  ('RAIL-1-1M','รางเหล็ก 1" 1 ม.','Steel Rail 1" 1m','rails','เส้น','pcs','1"','1m',1,420,80, 1,true),
  ('RAIL-1-2M','รางเหล็ก 1" 2 ม.','Steel Rail 1" 2m','rails','เส้น','pcs','1"','2m',2,310,80, 2,true),
  ('RAIL-1-3M','รางเหล็ก 1" 3 ม.','Steel Rail 1" 3m','rails','เส้น','pcs','1"','3m',3, 62,70, 3,true),
  ('RAIL-1-4M','รางเหล็ก 1" 4 ม.','Steel Rail 1" 4m','rails','เส้น','pcs','1"','4m',4, 18,60, 4,true),
  ('RAIL-2-1M','รางเหล็ก 2" 1 ม.','Steel Rail 2" 1m','rails','เส้น','pcs','2"','1m',1,275,60, 5,true),
  ('RAIL-2-2M','รางเหล็ก 2" 2 ม.','Steel Rail 2" 2m','rails','เส้น','pcs','2"','2m',2,188,60, 6,true),
  ('RAIL-2-3M','รางเหล็ก 2" 3 ม.','Steel Rail 2" 3m','rails','เส้น','pcs','2"','3m',3,240,70, 7,true),
  ('RAIL-2-4M','รางเหล็ก 2" 4 ม.','Steel Rail 2" 4m','rails','เส้น','pcs','2"','4m',4, 44,50, 8,true),
  ('RAIL-3-1M','รางเหล็ก 3" 1 ม.','Steel Rail 3" 1m','rails','เส้น','pcs','3"','1m',1,150,40, 9,true),
  ('RAIL-3-2M','รางเหล็ก 3" 2 ม.','Steel Rail 3" 2m','rails','เส้น','pcs','3"','2m',2, 96,45,10,true),
  ('RAIL-3-3M','รางเหล็ก 3" 3 ม.','Steel Rail 3" 3m','rails','เส้น','pcs','3"','3m',3, 70,45,11,true),
  ('RAIL-3-4M','รางเหล็ก 3" 4 ม.','Steel Rail 3" 4m','rails','เส้น','pcs','3"','4m',4,120,40,12,true)
on conflict (sku) do update set
  name = excluded.name, name_en = excluded.name_en, category_id = excluded.category_id,
  unit = excluded.unit, unit_en = excluded.unit_en, size = excluded.size, length = excluded.length,
  length_m = excluded.length_m, stock = excluded.stock, min_stock = excluded.min_stock,
  display_order = excluded.display_order, active = excluded.active;

-- ---- products: other categories (SKUs match prototype generation) ----
insert into public.products
  (sku, name, name_en, category_id, unit, unit_en, stock, min_stock, display_order, active) values
  -- screws / fasteners
  ('SCR-013','สกรูยึดราง M6×40','Rail Screw M6×40','screws','กล่อง','box',240,50,13,true),
  ('SCR-014','สกรูยึดราง M8×50','Rail Screw M8×50','screws','กล่อง','box',188,50,14,true),
  ('SCR-015','สกรูยึดราง M10×60','Rail Screw M10×60','screws','กล่อง','box', 36,40,15,true),
  ('SCR-016','น็อตหกเหลี่ยม M8','Hex Nut M8','screws','กล่อง','box',410,60,16,true),
  ('SCR-017','น็อตหกเหลี่ยม M10','Hex Nut M10','screws','กล่อง','box', 95,60,17,true),
  ('SCR-018','แหวนสปริง M8','Spring Washer M8','screws','กล่อง','box',520,80,18,true),
  ('SCR-019','แหวนอีแปะ M10','Flat Washer M10','screws','กล่อง','box', 70,60,19,true),
  ('SCR-020','พุกเหล็ก 3/8"','Steel Anchor 3/8"','screws','กล่อง','box',134,40,20,true),
  ('SCR-021','แคลมป์ยึดราง','Rail Clamp','screws','ชิ้น','pcs',280,80,21,true),
  ('SCR-022','แผ่นรองราง','Rail Base Plate','screws','ชิ้น','pcs',156,60,22,true),
  -- paint / coating
  ('PAI-023','สีกันสนิม แดง 1กล.','Anti-rust Paint Red 1gal','paint','กระป๋อง','can', 64,20,23,true),
  ('PAI-024','สีกันสนิม เทา 1กล.','Anti-rust Paint Grey 1gal','paint','กระป๋อง','can', 18,20,24,true),
  ('PAI-025','สีรองพื้น 1กล.','Primer 1gal','paint','กระป๋อง','can', 41,18,25,true),
  ('PAI-026','ทินเนอร์ AAA 1กล.','Thinner AAA 1gal','paint','กระป๋อง','can', 88,24,26,true),
  ('PAI-027','สเปรย์กันสนิม','Anti-rust Spray','paint','กระป๋อง','can',132,36,27,true),
  ('PAI-028','แปรงทาสี 3"','Paint Brush 3"','paint','ชิ้น','pcs', 76,24,28,true),
  -- spare parts
  ('PAR-029','ลูกล้อรับราง 2"','Rail Roller 2"','parts','ชิ้น','pcs', 52,24,29,true),
  ('PAR-030','ลูกล้อรับราง 3"','Rail Roller 3"','parts','ชิ้น','pcs',  9,20,30,true),
  ('PAR-031','ตัวกั้นปลายราง','Rail End Stop','parts','ชิ้น','pcs', 68,30,31,true),
  ('PAR-032','ข้อต่อราง 1"','Rail Joiner 1"','parts','ชิ้น','pcs',145,50,32,true),
  ('PAR-033','ข้อต่อราง 2"','Rail Joiner 2"','parts','ชิ้น','pcs',110,50,33,true),
  ('PAR-034','ข้อต่อราง 3"','Rail Joiner 3"','parts','ชิ้น','pcs', 47,50,34,true),
  ('PAR-035','ยางกันกระแทก','Rubber Bumper','parts','ชิ้น','pcs',200,60,35,true),
  ('PAR-036','ตลับลูกปืน 6204','Bearing 6204','parts','ตลับ','pcs', 38,24,36,true),
  -- consumables
  ('CON-037','ใบตัดเหล็ก 4"','Cutting Disc 4"','consumables','ใบ','pcs',320,100,37,true),
  ('CON-038','ใบตัดเหล็ก 7"','Cutting Disc 7"','consumables','ใบ','pcs', 78,100,38,true),
  ('CON-039','ใบเจียร 4"','Grinding Disc 4"','consumables','ใบ','pcs',210, 80,39,true),
  ('CON-040','ลวดเชื่อม 2.6มม.','Welding Rod 2.6mm','consumables','กก.','kg',156,60,40,true),
  ('CON-041','ลวดเชื่อม 3.2มม.','Welding Rod 3.2mm','consumables','กก.','kg', 28,60,41,true),
  ('CON-042','ถุงมือหนัง','Leather Gloves','consumables','คู่','pair', 64,30,42,true),
  ('CON-043','แว่นตานิรภัย','Safety Goggles','consumables','อัน','pcs', 41,20,43,true),
  ('CON-044','เทปพันสายไฟ','Electrical Tape','consumables','ม้วน','roll',188,50,44,true)
on conflict (sku) do update set
  name = excluded.name, name_en = excluded.name_en, category_id = excluded.category_id,
  unit = excluded.unit, unit_en = excluded.unit_en, stock = excluded.stock,
  min_stock = excluded.min_stock, display_order = excluded.display_order, active = excluded.active;
