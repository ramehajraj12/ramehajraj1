-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Seed data (demo accounts, consultants, catalogue, live-ish records)
-- All dates are relative to CURRENT_DATE so the demo always looks alive.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── auth users (password for all: demo123) ─────────────────────────────────
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, is_super_admin, is_sso_user, is_anonymous)
values
 ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'superadmin@statlab.al', crypt('demo123', gen_salt('bf')), now() - interval '200 days',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Arta Krasniqi","role":"super_admin"}',
  now() - interval '200 days', now(), '', '', false, false, false),
 ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'admin@statlab.al', crypt('demo123', gen_salt('bf')), now() - interval '190 days',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Driton Hoxha","role":"admin"}',
  now() - interval '190 days', now(), '', '', false, false, false),
 ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'arben@statlab.al', crypt('demo123', gen_salt('bf')), now() - interval '180 days',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Arben Krasniqi","role":"consultant"}',
  now() - interval '180 days', now(), '', '', false, false, false),
 ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'elira@statlab.al', crypt('demo123', gen_salt('bf')), now() - interval '160 days',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Elira Dema","role":"consultant"}',
  now() - interval '160 days', now(), '', '', false, false, false),
 ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'jon@statlab.al', crypt('demo123', gen_salt('bf')), now() - interval '120 days',
  '{"provider":"email","providers":["email"]}', '{"full_name":"MSc. Jon Berisha","role":"consultant"}',
  now() - interval '120 days', now(), '', '', false, false, false),
 ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
  'klient@statlab.al', crypt('demo123', gen_salt('bf')), now() - interval '60 days',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Arta Gashi","role":"client"}',
  now() - interval '60 days', now(), '', '', false, false, false);

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.id::text, now(), now(), now()
from auth.users u where u.email like '%@statlab.al';

-- profiles are auto-created by trigger; set roles correctly
update public.profiles set role = 'super_admin', full_name = 'Arta Krasniqi' where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', full_name = 'Driton Hoxha' where id = '10000000-0000-0000-0000-000000000002';
update public.profiles set role = 'consultant', full_name = 'Dr. Arben Krasniqi' where id = '10000000-0000-0000-0000-000000000003';
update public.profiles set role = 'consultant', full_name = 'Dr. Elira Dema' where id = '10000000-0000-0000-0000-000000000004';
update public.profiles set role = 'consultant', full_name = 'MSc. Jon Berisha' where id = '10000000-0000-0000-0000-000000000005';
update public.profiles set role = 'client', full_name = 'Arta Gashi', phone = '+383 44 123 456' where id = '10000000-0000-0000-0000-000000000007';

-- guest client profiles (created during past guest bookings)
insert into public.profiles (id, user_id, email, full_name, phone, role, created_at) values
 ('40000000-0000-0000-0000-000000000001', null, 'besnik@example.com', 'Besnik Rama', '+383 45 555 210', 'client', now() - interval '40 days'),
 ('40000000-0000-0000-0000-000000000002', null, 'kaltrina@example.com', 'Kaltrina Berisha', '+383 49 777 902', 'client', now() - interval '15 days');

-- ── consultants ─────────────────────────────────────────────────────────────
insert into public.consultants
 (id, user_id, slug, display_name, professional_title, bio, education, certifications,
  years_experience, languages, specializations, status, is_active, is_featured, google_calendar_connected)
values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'dr-arben-krasniqi',
  'Dr. Arben Krasniqi', 'Statistikan i aplikuar · Ekspert SPSS',
  'Doktor i shkencave statistikore me 12 vjet përvojë në analizën e të dhënave për kërkime akademike. Specializohet në regresion, analizë faktoriale dhe mbështetje të tezave master. Ka udhëhequr mbi 300 konsulta individuale me studentë dhe hulumtues.',
  '["PhD në Statistikë të Aplikuar — Universiteti i Prishtinës", "MSc në Ekonometri — Universiteti i Vjenës"]',
  '["IBM SPSS Advanced Analytics", "Certifikatë: Design of Experiments"]',
  12, '["sq","de","en"]',
  '["SPSS","Regression","Factor Analysis","Descriptive Statistics","Reliability Analysis","Master Thesis Support","Statistical Interpretation"]',
  'active', true, true, false),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'dr-elira-dema',
  'Dr. Elira Dema', 'Metodologe e hulumtimit · Dizajn pyetësorësh',
  'Eksperte për metodologjinë kuantitative të hulumtimit, me fokus në zhvillimin e pyetësorëve, shkallët e validuara dhe validitetin e konstruktëve. Bashkëpunon me departamente universitare në Kosovë, Shqipëri dhe Gjermani.',
  '["PhD në Psikologji Metodologjike — Universiteti i Tiranës", "MSc në Hulumtim Social — TU Berlin"]',
  '["Survey Design Professional (GDSS)", "Scale Development — Advanced"]',
  9, '["sq","de","en"]',
  '["Research Methodology","Survey Design","Questionnaire Development","Factor Analysis","PhD Research Support","APA Reporting"]',
  'active', true, false, false),
 ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'msc-jon-berisha',
  'MSc. Jon Berisha', 'Analist i të dhënave · Mbështetje doktorature',
  'Analist me përvojë të gjerë në pastrimin e të dhënave, testet joparametrike dhe modelet e regresionit logjistik. Mbështet kandidatë doktorature nga dizajni deri te raporti përfundimtar në format APA.',
  '["MSc në Statistikë — Universiteti i Graz-it"]',
  '["IBM SPSS Statistics Base", "R për analizë statistikore"]',
  6, '["sq","en"]',
  '["SPSS","Logistic Regression","Non-Parametric Statistics","PhD Research Support","Correlation","ANOVA","Data Cleaning"]',
  'active', true, false, false);

insert into public.consultant_terms (consultant_id, commission_percentage, payout_email) values
 ('20000000-0000-0000-0000-000000000001', 20, 'arben@statlab.al'),
 ('20000000-0000-0000-0000-000000000002', 25, 'elira@statlab.al'),
 ('20000000-0000-0000-0000-000000000003', 20, 'jon@statlab.al');

-- ── service catalogue ───────────────────────────────────────────────────────
insert into public.services (id, name, slug, short_description, description, category,
  default_duration_minutes, default_price, payment_policy, deposit_amount) values
 ('30000000-0000-0000-0000-000000000001', 'Konsulencë SPSS', 'konsulence-spss',
  'Sesion individual për çdo pyetje rreth SPSS — nga hyrja e të dhënave deri te interpretimi.',
  'Konsulencë një-në-një për punën me SPSS: importi i të dhënave, transformimet, menytë e analizës, leximi i output-it dhe zgjidhja e problemeve konkrete në datasetin tuaj.',
  'consultation', 60, 50, 'full', 0),
 ('30000000-0000-0000-0000-000000000002', 'Analizë statistikore', 'analize-statistikore',
  'Analizë e plotë e të dhënave: nga pastrimi deri te testet inferenciale.',
  'Përgatitja e të dhënave, statistikat përshkruese, testet e normalitetit dhe testet inferenciale të përshtatshme për pyetjet tuaja të hulumtimit, me interpretim të plotë.',
  'analysis', 90, 80, 'full', 0),
 ('30000000-0000-0000-0000-000000000003', 'Metodologji hulumtimi', 'metodologji-hulumtimi',
  'Dizajni i hulumtimit, mostrimi, operacionalizimi i variablave.',
  'Ndihmë në strukturimin e hulumtimit: pyetjet e hulumtimit, hipotezat, dizajni, mostrimi dhe operacionalizimi i variablave përpara mbledhjes së të dhënave.',
  'methodology', 60, 60, 'full', 0),
 ('30000000-0000-0000-0000-000000000004', 'Analizë regresioni', 'analize-regresioni',
  'Regresion linear, i shumëfishtë dhe logjistik me raportim të plotë.',
  'Modelimi i regresionit: kontrolli i supozimeve, diagnoza e modeleve, efektet dhe interpretimi, përfshirë raportimin në format APA.',
  'analysis', 90, 85, 'deposit', 30),
 ('30000000-0000-0000-0000-000000000005', 'Analizë faktoriale', 'analize-faktoriale',
  'EFA / CFA për strukturën e konstruktëve tuaj.',
  'Analiza eksploruese dhe konfirmuese e faktorëve: përshtatshmëria e mostrës, ekstraksioni, rrotullimi dhe interpretimi i strukturës faktoriale.',
  'analysis', 90, 85, 'full', 0),
 ('30000000-0000-0000-0000-000000000006', 'Dizajn i pyetësorit', 'dizajn-pyetesori',
  'Ndërtimi i pyetësorëve me shkallë të validuara dhe logjikë të qartë.',
  'Zhvillimi i pyetësorit: operacionalizimi i konstruktëve, zgjedhja e shkallëve të validuara, formati i pyetjeve dhe testimi pilot.',
  'survey', 60, 70, 'full', 0),
 ('30000000-0000-0000-0000-000000000007', 'Mbështetje teze master', 'mbeshtetje-teze-master',
  'Udhëheqje statistikore gjatë gjithë tezës së masterit.',
  'Mbështetje e plotë për tezën e masterit: metodologjia, analizat statistikore në SPSS, interpretimi i rezultateve dhe kapitulli i rezultateve në APA.',
  'thesis', 90, 100, 'deposit', 40),
 ('30000000-0000-0000-0000-000000000008', 'Mbështetje doktorature', 'mbeshtetje-doktorature',
  'Bashkëpunim statistikor për kandidatët e doktoraturës.',
  'Bashkëpunim afatgjatë për projektet doktoraturale: dizajni, madhësia e mostrës, modelet e avancuara dhe mbrojtja e rezultateve para komisionit.',
  'thesis', 120, 140, 'deposit', 50),
 ('30000000-0000-0000-0000-000000000009', 'Konsulencë sipas porosisë', 'konsulence-porosi',
  'Çdo nevojë tjetër statistikore — përshkruani dhe ne përshtatemi.',
  'Format fleksibël për nevoja specifike: rishikim i analizave ekzistuese, second opinion, përgatitje të dhënash ose pyetje ad-hoc.',
  'consultation', 60, 55, 'free_booking', 0),
 ('30000000-0000-0000-0000-000000000010', 'Tezë diplome', 'teze-diplome',
  'Mbështetje statistikore për tezën e diplomës (bachelor).',
  'Udhëheqje e thjeshtë dhe e qartë për analizat e tezës së diplomës: statistikat përshkruese, testet bazë dhe interpretimi për mbrojtje.',
  'thesis', 60, 70, 'full', 0);

insert into public.consultant_services (consultant_id, service_id, price, duration_minutes) values
 ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 50, 60),
 ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 80, 90),
 ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 90, 90),
 ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 90, 90),
 ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 100, 90),
 ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 55, 60),
 ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 60, 60),
 ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', 70, 60),
 ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000007', 100, 90),
 ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000010', 70, 60),
 ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 45, 60),
 ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 75, 90),
 ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 80, 90),
 ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000008', 140, 120);

-- ── weekly availability ─────────────────────────────────────────────────────
insert into public.weekly_availability (consultant_id, day_of_week, start_time, end_time) values
 ('20000000-0000-0000-0000-000000000001', 1, '09:00', '13:00'),
 ('20000000-0000-0000-0000-000000000001', 1, '14:00', '18:00'),
 ('20000000-0000-0000-0000-000000000001', 2, '09:00', '13:00'),
 ('20000000-0000-0000-0000-000000000001', 3, '13:00', '18:00'),
 ('20000000-0000-0000-0000-000000000001', 4, '09:00', '17:00'),
 ('20000000-0000-0000-0000-000000000001', 5, '09:00', '13:00'),
 ('20000000-0000-0000-0000-000000000002', 1, '10:00', '16:00'),
 ('20000000-0000-0000-0000-000000000002', 2, '10:00', '18:00'),
 ('20000000-0000-0000-0000-000000000002', 3, '09:00', '13:00'),
 ('20000000-0000-0000-0000-000000000002', 4, '12:00', '18:00'),
 ('20000000-0000-0000-0000-000000000002', 6, '10:00', '14:00'),
 ('20000000-0000-0000-0000-000000000003', 1, '14:00', '19:00'),
 ('20000000-0000-0000-0000-000000000003', 2, '09:00', '14:00'),
 ('20000000-0000-0000-0000-000000000003', 3, '09:00', '14:00'),
 ('20000000-0000-0000-0000-000000000003', 4, '14:00', '19:00'),
 ('20000000-0000-0000-0000-000000000003', 5, '10:00', '15:00');

insert into public.blocked_periods (consultant_id, block_date, end_date, start_time, end_time, reason, block_type) values
 ('20000000-0000-0000-0000-000000000001', current_date + 30, current_date + 34, null, null, 'Pushim vjetor', 'vacation'),
 ('20000000-0000-0000-0000-000000000002', current_date + 2, null, '13:00', '14:30', 'Mbledhje departamenti', 'meeting');

-- ── projects ────────────────────────────────────────────────────────────────
insert into public.projects (id, client_id, primary_consultant_id, title, description, research_topic,
  research_questions, hypotheses, study_level, university, deadline, status, created_at, updated_at) values
 ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001',
  'Teza master — Faktorët e stresit akademik', 'Projekti kryesor i tezës së masterit: nga pastrimi i të dhënave deri te modeli i regresionit.',
  'Ndikimi i faktorëve organizativë dhe individualë në nivelin e stresit akademik te studentët e mjekësisë.',
  'P1: A parashikon ngarkesa akademike nivelin e stresit? P2: A moderohet marrëdhënia nga mbështetja sociale?',
  'H1: Ngarkesa akademike ka efekt pozitiv në stres. H2: Mbështetja sociale e dobëson këtë efekt.',
  'master', 'Universiteti i Prishtinës', current_date + 45, 'analysis_in_progress', now() - interval '25 days', now() - interval '1 day'),
 ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  'Pyetësori i angazhimit të punonjësve', 'Zhvillimi i pyetësorit dhe testimi pilot për një hulumtim organizativ.',
  'Matja e angazhimit të punonjësve në sektorin e shërbimeve.',
  'P1: A është pyetësori njëdimensional apo tridimensional?', '',
  'professional', 'Hulumtim privat', current_date + 20, 'data_review', now() - interval '12 days', now() - interval '2 days'),
 ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001',
  'Analiza ANOVA — eksperimenti i kujtesës', 'Projekt i përfunduar: analiza e diferencave mes grupeve eksperimentale.',
  'Efekti i tri teknikave të përsëritjes në kujtesën afatshkurtër.',
  'A ka dallim mes teknikave?', 'H1: Teknika e ndarë e përsëritjes jep rezultate më të mira.',
  'bachelor', 'Universiteti i Prishtinës', current_date - 10, 'completed', now() - interval '70 days', now() - interval '12 days');

insert into public.project_consultants (project_id, consultant_id, role, assigned_at) values
 ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'lead', now() - interval '25 days'),
 ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'methodology', now() - interval '20 days'),
 ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'lead', now() - interval '12 days'),
 ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'lead', now() - interval '70 days');

insert into public.analysis_tasks (project_id, name, task_order, status, progress, notes, assigned_consultant_id, completed_at) values
 ('50000000-0000-0000-0000-000000000001', 'Të dhënat u pranuan', 1, 'completed', 100, 'Dataset .sav me 214 raste.', '20000000-0000-0000-0000-000000000001', now() - interval '20 days'),
 ('50000000-0000-0000-0000-000000000001', 'Pastrimi i të dhënave', 2, 'completed', 100, '6 raste të dyfishta u hoqën; 2 outlier u winsorizuan.', '20000000-0000-0000-0000-000000000001', now() - interval '16 days'),
 ('50000000-0000-0000-0000-000000000001', 'Analiza e besueshmërisë', 3, 'completed', 100, 'Cronbach α = .87 për shkallën e stresit.', '20000000-0000-0000-0000-000000000001', now() - interval '12 days'),
 ('50000000-0000-0000-0000-000000000001', 'Statistikat përshkruese', 4, 'in_progress', 80, 'Mbetet: tabela e ndarë sipas vitit të studimit.', '20000000-0000-0000-0000-000000000001', null),
 ('50000000-0000-0000-0000-000000000001', 'Korelacioni', 5, 'in_progress', 60, 'Pearson për 4 variabla — pjesërisht i raportuar.', '20000000-0000-0000-0000-000000000001', null),
 ('50000000-0000-0000-0000-000000000001', 'Regresioni', 6, 'not_started', 0, 'Regresion i shumëfishtë hierarkik (2 hapa).', '20000000-0000-0000-0000-000000000001', null),
 ('50000000-0000-0000-0000-000000000001', 'Raportimi APA', 7, 'not_started', 0, '', '20000000-0000-0000-0000-000000000002', null),
 ('50000000-0000-0000-0000-000000000002', 'Drafti i pyetësorit', 1, 'completed', 100, '24 pyetje, 3 konstruktet.', '20000000-0000-0000-0000-000000000002', now() - interval '8 days'),
 ('50000000-0000-0000-0000-000000000002', 'Testimi pilot', 2, 'in_progress', 50, 'n = 30 — pritje për të dhënat.', '20000000-0000-0000-0000-000000000002', null),
 ('50000000-0000-0000-0000-000000000003', 'ANOVA njëfaktorëshe', 1, 'completed', 100, 'F(2, 87) = 6.41, p = .002.', '20000000-0000-0000-0000-000000000001', now() - interval '30 days'),
 ('50000000-0000-0000-0000-000000000003', 'Testet post-hoc', 2, 'completed', 100, 'Tukey HSD: diferenca mes grupit 1 dhe 3.', '20000000-0000-0000-0000-000000000001', now() - interval '28 days'),
 ('50000000-0000-0000-0000-000000000003', 'Raporti përfundimtar', 3, 'completed', 100, 'Dorëzuar në PDF.', '20000000-0000-0000-0000-000000000001', now() - interval '14 days');

-- ── appointments ────────────────────────────────────────────────────────────
insert into public.appointments
 (id, reference, client_id, client_name, client_email, client_phone, consultant_id, consultant_name,
  service_id, service_name, project_id, date, start_time, duration_minutes, price, status,
  language, university, study_level, research_topic, problem_description, spss_experience,
  required_analysis, intake, payment_status, payment_policy, meeting_provider, meeting_url, completion, created_at)
values
 ('60000000-0000-0000-0000-000000000001', 'SPSS-2026-000101', '10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'klient@statlab.al', '+383 44 123 456',
  '20000000-0000-0000-0000-000000000001', 'Dr. Arben Krasniqi', '30000000-0000-0000-0000-000000000004', 'Analizë regresioni',
  '50000000-0000-0000-0000-000000000001', current_date - 21, '10:00', 90, 90, 'completed',
  'sq', 'Universiteti i Prishtinës', 'master', 'Faktorët e stresit akademik', 'Duhet të verifikoj supozimet e regresionit para hapit të dytë.', 'intermediate',
  'Regresion i shumëfishtë hierarkik', '{"research_question":"Parashikuesit e stresit akademik","dependent":"Stresi akademik","sample_size":"214"}',
  'paid', 'deposit', 'google_meet', 'https://meet.google.com/qzd-mpkr-hwt',
  '{"summary":"U verifikuan supozimet e regresionit: lineariteti, homoskedasticiteti dhe multikolineariteti (VIF < 2.1).","analyses_performed":"Korelacion Pearson, regresion linear i shumëfishtë","findings":"Modeli shpjegon 34% të variancës (R² = .34, p < .001). Ngarkesa akademike është parashikuesi më i fortë.","recommendations":"Shtoni ndërveprimin me mbështetjen sociale në hapin e dytë.","next_steps":"Modeli hierarkik me 2 hapa javën e ardhshme.","follow_up":"required","follow_up_timeframe":"1 javë"}',
  now() - interval '23 days'),
 ('60000000-0000-0000-0000-000000000002', 'SPSS-2026-000108', '10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'klient@statlab.al', '+383 44 123 456',
  '20000000-0000-0000-0000-000000000001', 'Dr. Arben Krasniqi', '30000000-0000-0000-0000-000000000007', 'Mbështetje teze master',
  '50000000-0000-0000-0000-000000000001', current_date - 10, '14:00', 90, 100, 'completed',
  'sq', 'Universiteti i Prishtinës', 'master', 'Faktorët e stresit akademik', 'Interpretimi i output-it të besueshmërisë.', 'intermediate',
  'Cronbach alpha, EFA', '{"university":"Universiteti i Prishtinës","stage":"Analiza e të dhënave"}',
  'paid', 'deposit', 'google_meet', 'https://meet.google.com/abc-defg-hij',
  '{"summary":"Analiza e besueshmërisë tregoi konsistencë të lartë të brendshme.","analyses_performed":"Cronbach alpha, statistika përshkruese","findings":"α = .87 për shkallën kryesore; 2 pika rritin α në .89 nëse hiqen.","recommendations":"Mbani të gjitha pikat — .87 është i mjaftueshëm.","next_steps":"Korelacionet dhe regresioni.","follow_up":"recommended","follow_up_timeframe":"2 javë"}',
  now() - interval '12 days'),
 ('60000000-0000-0000-0000-000000000003', 'SPSS-2026-000117', '10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'klient@statlab.al', '+383 44 123 456',
  '20000000-0000-0000-0000-000000000001', 'Dr. Arben Krasniqi', '30000000-0000-0000-0000-000000000001', 'Konsulencë SPSS',
  '50000000-0000-0000-0000-000000000001', current_date + 2, '10:00', 60, 50, 'confirmed',
  'sq', 'Universiteti i Prishtinës', 'master', 'Faktorët e stresit akademik', 'Hapja e modelit hierarkik në SPSS.', 'intermediate',
  'Regresion hierarkik', '{}', 'paid', 'full', 'google_meet', 'https://meet.google.com/stl-mbrt-vjq', null,
  now() - interval '3 days'),
 ('60000000-0000-0000-0000-000000000004', 'SPSS-2026-000121', '10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'klient@statlab.al', '+383 44 123 456',
  '20000000-0000-0000-0000-000000000001', 'Dr. Arben Krasniqi', '30000000-0000-0000-0000-000000000005', 'Analizë faktoriale',
  '50000000-0000-0000-0000-000000000001', current_date + 5, '14:30', 90, 90, 'pending',
  'sq', 'Universiteti i Prishtinës', 'master', 'Struktura faktoriale e shkallës', 'Verifikimi i strukturës 3-faktoriale.', 'intermediate',
  'EFA me rrotullim oblimin', '{}', 'unpaid', 'full', 'none', null, null,
  now() - interval '1 day'),
 ('60000000-0000-0000-0000-000000000005', 'SPSS-2026-000112', '10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'klient@statlab.al', '+383 44 123 456',
  '20000000-0000-0000-0000-000000000002', 'Dr. Elira Dema', '30000000-0000-0000-0000-000000000003', 'Metodologji hulumtimi',
  '50000000-0000-0000-0000-000000000001', current_date - 4, '11:00', 60, 60, 'cancelled',
  'sq', 'Universiteti i Prishtinës', 'master', 'Operacionalizimi i variablave', '', 'intermediate', '', '{}',
  'refunded', 'full', 'none', null, null, now() - interval '8 days'),
 ('60000000-0000-0000-0000-000000000006', 'SPSS-2026-000119', '40000000-0000-0000-0000-000000000001', 'Besnik Rama', 'besnik@example.com', '+383 45 555 210',
  '20000000-0000-0000-0000-000000000002', 'Dr. Elira Dema', '30000000-0000-0000-0000-000000000006', 'Dizajn i pyetësorit',
  '50000000-0000-0000-0000-000000000002', current_date + 1, '11:00', 60, 70, 'confirmed',
  'sq', '', 'professional', 'Angazhimi i punonjësve', 'Rishikim i draftit të pyetësorit.', 'none',
  'Konstrukte: vigjilenca, përkushtimi, përthithja', '{}', 'paid', 'full', 'google_meet', 'https://meet.google.com/pll-qstr-dwm', null,
  now() - interval '5 days'),
 ('60000000-0000-0000-0000-000000000007', 'SPSS-2026-000105', '40000000-0000-0000-0000-000000000002', 'Kaltrina Berisha', 'kaltrina@example.com', '+383 49 777 902',
  '20000000-0000-0000-0000-000000000003', 'MSc. Jon Berisha', '30000000-0000-0000-0000-000000000008', 'Mbështetje doktorature',
  null, current_date - 6, '15:00', 120, 140, 'completed',
  'en', 'Universiteti i Graz-it', 'phd', 'Parashikuesit e burnout-it te infermierët', 'Regresion logjistik me variabla kontrolli.', 'advanced',
  'Regresion logjistik binar', '{}', 'deposit_paid', 'deposit', 'google_meet', 'https://meet.google.com/grz-kntr-bnp',
  '{"summary":"Modeli logjistik u specifikua me 3 blloqe variablash.","analyses_performed":"Regresion logjistik binar, testet e supozimeve","findings":"OR = 2.3 (95% CI 1.4–3.7) për orët e natës.","recommendations":"Raportoni sipas udhëzimeve STROBE.","next_steps":"Analiza e ndërveprimeve.","follow_up":"required","follow_up_timeframe":"10 ditë"}',
  now() - interval '9 days'),
 ('60000000-0000-0000-0000-000000000008', 'SPSS-2026-000098', '40000000-0000-0000-0000-000000000001', 'Besnik Rama', 'besnik@example.com', '+383 45 555 210',
  '20000000-0000-0000-0000-000000000003', 'MSc. Jon Berisha', '30000000-0000-0000-0000-000000000001', 'Konsulencë SPSS',
  null, current_date - 30, '13:00', 60, 45, 'completed',
  'sq', '', 'master', '', 'Probleme me importin nga Excel.', 'basic', '', '{}', 'paid', 'full', 'google_meet', null,
  '{"summary":"U rregullua importi i të dhënave dhe u krijua sintaksa bazë.","analyses_performed":"Importi dhe pastrimi","findings":"Formati i datave ishte burimi i problemit.","recommendations":"Përdorni sintaksën për import të përsëritshëm.","next_steps":"","follow_up":"none","follow_up_timeframe":""}',
  now() - interval '32 days'),
 ('60000000-0000-0000-0000-000000000009', 'SPSS-2026-000103', '10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'klient@statlab.al', '+383 44 123 456',
  '20000000-0000-0000-0000-000000000001', 'Dr. Arben Krasniqi', '30000000-0000-0000-0000-000000000002', 'Analizë statistikore',
  '50000000-0000-0000-0000-000000000001', current_date - 15, '09:30', 90, 80, 'rescheduled',
  'sq', 'Universiteti i Prishtinës', 'master', 'Statistika përshkruese', '', 'intermediate', '', '{}', 'paid', 'full', 'none', null, null,
  now() - interval '18 days');

insert into public.appointment_history (appointment_id, old_date, old_start, new_date, new_start, changed_by, changed_by_role, changed_at) values
 ('60000000-0000-0000-0000-000000000003', current_date - 1, '10:00', current_date + 2, '10:00', 'Arta Gashi', 'client', now() - interval '2 days');

-- ── payments (commission: Arben/Jon 20%, Elira 25%) ────────────────────────
insert into public.payments
 (id, appointment_id, project_id, client_id, consultant_id, type, amount_gross, platform_fee, consultant_net,
  status, payout_status, method, paid_at, created_at)
values
 ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'deposit', 30, 6, 24, 'paid', 'paid', 'stripe_demo', now() - interval '23 days', now() - interval '23 days'),
 ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'balance', 60, 12, 48, 'paid', 'approved', 'stripe_demo', now() - interval '19 days', now() - interval '20 days'),
 ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'deposit', 40, 8, 32, 'paid', 'paid', 'stripe_demo', now() - interval '12 days', now() - interval '12 days'),
 ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'balance', 60, 12, 48, 'paid', 'pending', 'stripe_demo', now() - interval '8 days', now() - interval '9 days'),
 ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'full', 50, 10, 40, 'paid', 'pending', 'stripe_demo', now() - interval '3 days', now() - interval '3 days'),
 ('70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'full', 90, 18, 72, 'pending', 'pending', 'stripe_demo', null, now() - interval '1 day'),
 ('70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'full', 60, 15, 45, 'refunded', 'pending', 'stripe_demo', now() - interval '8 days', now() - interval '8 days'),
 ('70000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'full', 70, 17.5, 52.5, 'paid', 'pending', 'stripe_demo', now() - interval '5 days', now() - interval '5 days'),
 ('70000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000007', null, '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'deposit', 50, 10, 40, 'paid', 'pending', 'stripe_demo', now() - interval '9 days', now() - interval '9 days'),
 ('70000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000007', null, '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'balance', 90, 18, 72, 'pending', 'pending', 'stripe_demo', null, now() - interval '5 days'),
 ('70000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000008', null, '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'full', 45, 9, 36, 'paid', 'paid', 'stripe_demo', now() - interval '32 days', now() - interval '32 days'),
 ('70000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'full', 80, 16, 64, 'paid', 'paid', 'stripe_demo', now() - interval '18 days', now() - interval '18 days');

-- ── invoices ────────────────────────────────────────────────────────────────
insert into public.invoices
 (id, invoice_number, client_id, appointment_id, project_id, payment_id, amount_net, tax_amount, amount_total, status, issue_date, due_date)
values
 ('80000000-0000-0000-0000-000000000001', 'SPSS-2026-0101', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 25.42, 4.58, 30, 'paid', current_date - 23, current_date - 9),
 ('80000000-0000-0000-0000-000000000002', 'SPSS-2026-0102', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 50.85, 9.15, 60, 'paid', current_date - 20, current_date - 6),
 ('80000000-0000-0000-0000-000000000003', 'SPSS-2026-0103', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 33.90, 6.10, 40, 'paid', current_date - 12, current_date + 2),
 ('80000000-0000-0000-0000-000000000004', 'SPSS-2026-0104', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', 50.85, 9.15, 60, 'paid', current_date - 9, current_date + 5),
 ('80000000-0000-0000-0000-000000000005', 'SPSS-2026-0105', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', 42.37, 7.63, 50, 'paid', current_date - 3, current_date + 11),
 ('80000000-0000-0000-0000-000000000006', 'SPSS-2026-0106', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', 76.27, 13.73, 90, 'issued', current_date - 1, current_date + 13),
 ('80000000-0000-0000-0000-000000000007', 'SPSS-2026-0107', '10000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007', 50.85, 9.15, 60, 'cancelled', current_date - 8, current_date + 6),
 ('80000000-0000-0000-0000-000000000008', 'SPSS-2026-0108', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000008', 59.32, 10.68, 70, 'paid', current_date - 5, current_date + 9),
 ('80000000-0000-0000-0000-000000000009', 'SPSS-2026-0109', '40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000007', null, '70000000-0000-0000-0000-000000000009', 42.37, 7.63, 50, 'paid', current_date - 9, current_date + 5),
 ('80000000-0000-0000-0000-000000000010', 'SPSS-2026-0110', '40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000007', null, '70000000-0000-0000-0000-000000000010', 76.27, 13.73, 90, 'issued', current_date - 5, current_date + 9);

update public.payments set invoice_id = '80000000-0000-0000-0000-000000000001' where id = '70000000-0000-0000-0000-000000000001';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000002' where id = '70000000-0000-0000-0000-000000000002';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000003' where id = '70000000-0000-0000-0000-000000000003';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000004' where id = '70000000-0000-0000-0000-000000000004';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000005' where id = '70000000-0000-0000-0000-000000000005';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000006' where id = '70000000-0000-0000-0000-000000000006';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000007' where id = '70000000-0000-0000-0000-000000000007';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000008' where id = '70000000-0000-0000-0000-000000000008';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000009' where id = '70000000-0000-0000-0000-000000000009';
update public.payments set invoice_id = '80000000-0000-0000-0000-000000000010' where id = '70000000-0000-0000-0000-000000000010';

-- ── files (metadata; seeded objects are placeholders) ──────────────────────
insert into public.project_files (id, client_id, project_id, appointment_id, uploaded_by, file_name, file_path, file_type, file_size, category, created_at) values
 ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000007', 'stresi_akademik_v3.sav', '50000000-0000-0000-0000-000000000001/stresi_akademik_v3.sav', 'sav', 486000, 'dataset', now() - interval '22 days'),
 ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000001', null, '20000000-0000-0000-0000-000000000001', 'output_besueshmeria.spv', '50000000-0000-0000-0000-000000000001/output_besueshmeria.spv', 'spv', 214000, 'spss_output', now() - interval '12 days'),
 ('90000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000001', null, '20000000-0000-0000-0000-000000000001', 'rezultatet_korelacioni.xlsx', '50000000-0000-0000-0000-000000000001/rezultatet_korelacioni.xlsx', 'xlsx', 68000, 'deliverable', now() - interval '4 days'),
 ('90000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', null, '40000000-0000-0000-0000-000000000001', 'pyetesori_angazhimi_draft.docx', '50000000-0000-0000-0000-000000000002/pyetesori_angazhimi_draft.docx', 'docx', 41000, 'questionnaire', now() - interval '8 days'),
 ('90000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000003', null, '20000000-0000-0000-0000-000000000001', 'raporti_anova_perfundimtar.pdf', '50000000-0000-0000-0000-000000000003/raporti_anova_perfundimtar.pdf', 'pdf', 892000, 'report', now() - interval '14 days');

-- ── reviews (trigger recalculates consultant ratings) ──────────────────────
insert into public.reviews (appointment_id, client_id, consultant_id, rating, clarity, usefulness, recommendation, comment, show_name, consent_to_publish, status, created_at) values
 ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 5, 5, 5, 5,
  'Shpjegime jashtëzakonisht të qarta për supozimet e regresionit. Tani e kuptoj saktësisht çfarë të raportoj në tezë.', true, true, 'published', now() - interval '19 days'),
 ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 5, 4, 5, 5,
  'Mbështetje e shkëlqyer për tezën. Rekomandohet për çdo student masteri.', false, true, 'published', now() - interval '7 days'),
 ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 4, 4, 5, 4,
  'Komunikim i mirë në anglishte dhe njohuri e thellë e regresionit logjistik.', false, true, 'published', now() - interval '4 days'),
 ('60000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 5, 5, 4, 5,
  'Zgjidhi problemin e importit brenda 20 minutash dhe më la sintaksën gati.', true, true, 'published', now() - interval '28 days'),
 ('60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 4, 5, 4, 4,
  'Analizë e plotë përshkruese; pres vazhdimin me korelacionet.', false, true, 'pending', now() - interval '13 days');

-- ── notifications, activity, waitlist, applications ────────────────────────
insert into public.notifications (recipient_id, recipient_email, appointment_id, type, subject, body, dedupe_key, sent_at) values
 ('10000000-0000-0000-0000-000000000007', 'klient@statlab.al', '60000000-0000-0000-0000-000000000003', 'booking_confirmed',
  'Rezervimi u konfirmua — SPSS-2026-000117', 'Konsulencë SPSS me Dr. Arben Krasniqi më ' || to_char(current_date + 2, 'YYYY-MM-DD') || ' në 10:00.', 'seed:n1', now() - interval '3 days'),
 ('10000000-0000-0000-0000-000000000007', 'klient@statlab.al', '60000000-0000-0000-0000-000000000004', 'booking_received',
  'Rezervimi u pranua — SPSS-2026-000121', 'Rezervimi juaj po pret konfirmimin nga platforma.', 'seed:n2', now() - interval '1 day'),
 ('10000000-0000-0000-0000-000000000007', 'klient@statlab.al', '60000000-0000-0000-0000-000000000007', 'consultation_completed',
  'Konsulta u përfundua', 'Rezultatet dhe rekomandimet janë në portalin tuaj.', 'seed:n3', now() - interval '6 days'),
 ('10000000-0000-0000-0000-000000000002', 'admin@statlab.al', '60000000-0000-0000-0000-000000000004', 'booking_received',
  'Rezervim i ri — SPSS-2026-000121', 'Arta Gashi rezervoi Analizë faktoriale me Dr. Arben Krasniqi.', 'seed:n4', now() - interval '1 day');

insert into public.activity_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, metadata, created_at) values
 ('10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'client', 'appointment.created', 'appointment', '60000000-0000-0000-0000-000000000003', 'Konsulencë SPSS me Dr. Arben Krasniqi', now() - interval '3 days'),
 ('10000000-0000-0000-0000-000000000002', 'Driton Hoxha', 'admin', 'appointment.confirmed', 'appointment', '60000000-0000-0000-0000-000000000006', 'SPSS-2026-000119 → confirmed', now() - interval '4 days'),
 ('10000000-0000-0000-0000-000000000003', 'Dr. Arben Krasniqi', 'consultant', 'task.updated', 'project', '50000000-0000-0000-0000-000000000001', 'Korelacioni → in_progress (60%)', now() - interval '2 days'),
 ('10000000-0000-0000-0000-000000000002', 'Driton Hoxha', 'admin', 'consultant.approved', 'consultant', '20000000-0000-0000-0000-000000000003', 'MSc. Jon Berisha u aktivizua', now() - interval '120 days'),
 ('10000000-0000-0000-0000-000000000007', 'Arta Gashi', 'client', 'file.uploaded', 'file', '90000000-0000-0000-0000-000000000001', 'stresi_akademik_v3.sav', now() - interval '22 days'),
 ('10000000-0000-0000-0000-000000000002', 'Driton Hoxha', 'admin', 'invoice.generated', 'invoice', '80000000-0000-0000-0000-000000000006', 'SPSS-2026-0106', now() - interval '1 day');

insert into public.waitlist (name, email, phone, service_id, consultant_id, preferred_dates, preferred_time, status, has_match, profile_id) values
 ('Agron Kelmendi', 'agron.k@example.com', '+383 44 909 112', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
  'Çdo ditë pas 17:00', 'afternoon', 'waiting', true, null),
 ('Fjolla Murati', 'fjolla.m@example.com', '+383 45 303 871', '30000000-0000-0000-0000-000000000007', null,
  'Fundjava', 'morning', 'waiting', false, null);

insert into public.consultant_applications (name, email, phone, country, education, experience, spss_experience, methodology_experience, specializations, languages, cv_file, linkedin, motivation, status, created_at) values
 ('Dr. Bleona Salihu', 'bleona.salihu@example.com', '+383 49 220 544', 'Kosovë',
  'PhD në Epidemiologji — Universiteti i Beogradit', '8 vjet analizë e të dhënave klinike',
  '10+ vjet; SPSS, Stata', 'Dizajne longitudinale, meta-analizë',
  '["ANOVA","Regression","Non-Parametric Statistics","PhD Research Support"]', '["sq","en"]',
  'CV_BleonaSalihu.pdf', 'linkedin.com/in/bleona-salihu',
  'Dëshiroj të ndihmoj studentët e shkencave shëndetësore me analiza rigoroze dhe raportim transparent.',
  'submitted', now() - interval '3 days'),
 ('MSc. Valon Gashi', 'valon.gashi@example.com', '+355 68 441 902', 'Shqipëri',
  'MSc në Statistikë — Universiteti i Tiranës', '5 vjet konsulent biznesi për analiza tregu',
  '7 vjet; SPSS dhe R', 'Analiza të thjeshta eksploruese',
  '["SPSS","Descriptive Statistics","Correlation"]', '["sq","en"]',
  'CV_ValonGashi.pdf', '',
  'Fokusohem në statistikat përshkruese dhe vizualizimin e të dhënave për biznese të vogla.',
  'under_review', now() - interval '9 days');

-- ── intake templates (admin-editable, drives dynamic booking forms) ────────
insert into public.intake_templates (category, title, description, fields) values
 ('consultation', 'Informacione për konsultencë', 'Detaje bazë për të përgatitur sesionin.',
  '[{"key":"dataset_status","label":"A keni dataset gati?","type":"select","required":true,"options":["Po, i pastruar","Po, i papastruar","Jo, ende jo"]},
    {"key":"spss_version","label":"Versioni i SPSS","type":"text","required":false},
    {"key":"goal","label":"Qëllimi i sesionit","type":"textarea","required":true}]'),
 ('regression', 'Detaje për analizën e regresionit', 'Na ndihmon të përgatisim modelin e duhur.',
  '[{"key":"research_question","label":"Pyetja e hulumtimit","type":"textarea","required":true},
    {"key":"dependent","label":"Variabla e varur","type":"text","required":true},
    {"key":"independents","label":"Variablat e pavarura","type":"text","required":true},
    {"key":"sample_size","label":"Madhësia e mostrës (n)","type":"text","required":true},
    {"key":"predictors","label":"Numri i parashikuesve","type":"text","required":false},
    {"key":"dataset_available","label":"A e keni datasetin?","type":"select","required":true,"options":["Po","Jo"]},
    {"key":"dataset_cleaned","label":"A është i pastruar?","type":"select","required":false,"options":["Po","Jo","Pjesërisht"]},
    {"key":"hypotheses","label":"A keni hipoteza të formuluar?","type":"select","required":false,"options":["Po","Jo"]},
    {"key":"regression_type","label":"Lloji i regresionit","type":"select","required":false,"options":["Linear i thjeshtë","I shumëfishtë","Logjistik","Hierarkik","Nuk e di"]}]'),
 ('thesis', 'Detaje për mbështetjen e tezës', 'Konteksti i tezës suaj.',
  '[{"key":"university","label":"Universiteti","type":"text","required":true},
    {"key":"program","label":"Programi i studimit","type":"text","required":true},
    {"key":"topic","label":"Tema e hulumtimit","type":"textarea","required":true},
    {"key":"stage","label":"Faza aktuale e tezës","type":"select","required":true,"options":["Propozimi","Mbledhja e të dhënave","Analiza e të dhënave","Shkrimi i rezultateve"]},
    {"key":"research_questions","label":"Pyetjet e hulumtimit","type":"textarea","required":false},
    {"key":"hypotheses","label":"Hipotezat","type":"textarea","required":false},
    {"key":"methodology","label":"Metodologjia","type":"text","required":false},
    {"key":"sample_size","label":"Madhësia e mostrës","type":"text","required":false},
    {"key":"deadline","label":"Afati i dorëzimit","type":"text","required":false},
    {"key":"dataset_available","label":"A i keni të dhënat?","type":"select","required":true,"options":["Po","Jo","Në mbledhje e sipër"]},
    {"key":"supervisor_feedback","label":"Komentet e mbikëqyrësit","type":"textarea","required":false}]'),
 ('questionnaire', 'Detaje për dizajnin e pyetësorit', 'Konstruktet dhe popullata e synuar.',
  '[{"key":"constructs","label":"Konstruktet e hulumtimit","type":"textarea","required":true},
    {"key":"population","label":"Popullata e synuar","type":"text","required":true},
    {"key":"existing_scales","label":"A keni shkallë të validuara?","type":"select","required":true,"options":["Po","Jo","Pjesërisht"]},
    {"key":"n_constructs","label":"Numri i konstruktëve","type":"text","required":false},
    {"key":"likert","label":"Pikat e shkallës Likert","type":"select","required":false,"options":["5","7","Nuk e di"]},
    {"key":"languages","label":"Gjuhët e kërkuara","type":"text","required":false}]'),
 ('analysis', 'Detaje për analizën statistikore', 'Çfarë duhet të analizohet.',
  '[{"key":"research_questions","label":"Pyetjet e hulumtimit","type":"textarea","required":true},
    {"key":"variables","label":"Variablat kryesore","type":"textarea","required":false},
    {"key":"sample_size","label":"Madhësia e mostrës","type":"text","required":true},
    {"key":"tests_needed","label":"Testet e nevojshme (nëse i dini)","type":"text","required":false},
    {"key":"dataset_available","label":"A e keni datasetin?","type":"select","required":true,"options":["Po","Jo"]}]');

-- ── consents for demo client ────────────────────────────────────────────────
insert into public.consents (user_id, consent_type, consent_version, accepted_at) values
 ('10000000-0000-0000-0000-000000000007', 'privacy', '1.2', now() - interval '60 days'),
 ('10000000-0000-0000-0000-000000000007', 'terms', '1.2', now() - interval '60 days'),
 ('10000000-0000-0000-0000-000000000007', 'data_processing', '1.2', now() - interval '60 days'),
 ('10000000-0000-0000-0000-000000000007', 'confidentiality', '1.0', now() - interval '25 days');

-- keep sequences ahead of seeded values
select setval('public.appointment_ref_seq', 130, true);
select setval('public.invoice_number_seq', 1110, true);
