import type {
  DB, User, Consultant, Service, Appointment, Project, AnalysisTask,
  Payment, Invoice, ProjectFile, AppointmentStatus, PaymentPolicy, StudyLevel,
} from "../types";
import { addDaysISO, todayISO, timeToMin, minToTime, hashPw, nowISO, uid } from "./utils";

// Seed is generated RELATIVE TO TODAY so calendars, availability and analytics
// always look alive.

export function buildSeed(): DB {
  const T = todayISO();
  const D = (offset: number) => addDaysISO(T, offset);
  const now = nowISO();
  const iso = (offset: number, h: number, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const users: User[] = [
    mkUser("u-super", "super@statlab.al", "Driton Krasniqi", "super_admin", "+383 49 111 000"),
    mkUser("u-admin", "admin@statlab.al", "Arta Berisha", "admin", "+383 49 222 000"),
    mkUser("u-arben", "arben@statlab.al", "Dr. Arben Hoxha", "consultant", "+383 49 333 001"),
    mkUser("u-elira", "elira@statlab.al", "MSc. Elira Kelmendi", "consultant", "+383 49 333 002"),
    mkUser("u-besnik", "besnik@statlab.al", "Dr. Besnik Gashi", "consultant", "+383 49 333 003"),
    mkUser("u-teuta", "teuta@statlab.al", "MSc. Teuta Morina", "consultant", "+383 49 333 004"),
    mkUser("u-liridon", "liridon@statlab.al", "Liridon Shala", "consultant", "+383 49 333 005"),
    mkUser("u-fjolla", "fjolla@statlab.al", "MSc. Fjolla Dema", "consultant", "+383 49 333 006"),
    mkUser("u-klient", "klient@demo.al", "Klient Demo", "client", "+383 44 555 111"),
    mkUser("u-mira", "mira@demo.al", "Mira Jahja", "client", "+383 44 555 222"),
    mkUser("u-valon", "valon@demo.al", "Valon Krasniqi", "client", "+383 44 555 333"),
  ];

  const consultants: Consultant[] = [
    {
      id: "c-arben", user_id: "u-arben", slug: "dr-arben-hoxha",
      display_name: "Dr. Arben Hoxha",
      professional_title: "Statistikan i aplikuar · Ekspert SPSS",
      bio: "Mbi 12 vite përvojë në analizë statistikore për shkencat sociale, ekonominë dhe mjekësinë. Specializohet në regresion, analizë faktoriale dhe interpretim të outputit të SPSS me raportim të saktë APA. Ka mbështetur mbi 300 punime akademike nga faza e dizajnit deri te interpretimi përfundimtar.",
      profile_photo: null,
      education: ["Doktoraturë në Statistika të Aplikuara — Universiteti i Vjenës", "Master në Ekonometri — Universiteti i Prishtinës"],
      certifications: ["IBM SPSS Advanced Statistics", "Coursera — Statistical Inference (Johns Hopkins)"],
      years_experience: 12, languages: ["sq", "en", "de"],
      specializations: ["spss", "regression", "factor", "interpretation", "apa", "descriptive"],
      rating: 4.9, review_count: 87, status: "active", commission_percentage: 20,
      is_active: true, is_featured: true, google_calendar_connected: true,
      created_at: iso(-400, 9), updated_at: iso(-3, 9),
    },
    {
      id: "c-elira", user_id: "u-elira", slug: "elira-kelmendi",
      display_name: "MSc. Elira Kelmendi",
      professional_title: "Metodologe e hulumtimit · Dizajn pyetësorësh",
      bio: "Eksperte për metodologji kuantitative, dizajn të pyetësorëve dhe shkallëve të validuara. Punon me instrumente të standardizuara, analizë besueshmërie (Cronbach's Alpha) dhe validim konstrukti. Bashkëpunon me ekipe hulumtimi në Kosovë, Shqipëri dhe Gjermani.",
      profile_photo: null,
      education: ["Master në Metodologji të Hulumtimit — Universiteti i Ljubljanës"],
      certifications: ["ESRA — Survey Research Methods", "Advanced Questionnaire Design (GESIS)"],
      years_experience: 8, languages: ["sq", "en", "de"],
      specializations: ["methodology", "survey", "questionnaire", "reliability", "bachelor"],
      rating: 4.8, review_count: 54, status: "active", commission_percentage: 25,
      is_active: true, is_featured: true, google_calendar_connected: false,
      created_at: iso(-320, 9), updated_at: iso(-6, 9),
    },
    {
      id: "c-besnik", user_id: "u-besnik", slug: "dr-besnik-gashi",
      display_name: "Dr. Besnik Gashi",
      professional_title: "Konsulent për analiza multivariate · Doktoratura",
      bio: "Fokus në analiza të avancuara: regresion logjistik, ANOVA me matje të përsëritura, modelim me ekuacione strukturore. Mbështet doktorantë në hartimin e hipotezave, përcaktimin e mostrës dhe analizën përfundimtare. Autor i 15 publikimeve ndërkombëtare.",
      profile_photo: null,
      education: ["Doktoraturë në Psikometri — Universiteti i Graz-it"],
      certifications: ["AMOS Structural Equation Modeling", "R & SPSS për shkencat e shëndetit"],
      years_experience: 10, languages: ["sq", "de", "en"],
      specializations: ["regression", "logistic", "anova", "phd", "factor", "interpretation"],
      rating: 4.9, review_count: 63, status: "active", commission_percentage: 20,
      is_active: true, is_featured: true, google_calendar_connected: true,
      created_at: iso(-300, 9), updated_at: iso(-2, 9),
    },
    {
      id: "c-teuta", user_id: "u-teuta", slug: "teuta-morina",
      display_name: "MSc. Teuta Morina",
      professional_title: "Statistikane · Mbështetje për master & diplomë",
      bio: "E specializuar në mbështetjen e studentëve të masterit: nga formulimi i pyetjeve hulumtuese, përgatitja e të dhënave, deri te testimi i hipotezave (t-test, ANOVA, korelacion) dhe raportimi sipas APA. E njohur për shpjegime të qarta dhe durim me studentët.",
      profile_photo: null,
      education: ["Master në Biostatistikë — Universiteti i Zagrebit"],
      certifications: ["SPSS Essentials (IBM)"],
      years_experience: 6, languages: ["sq", "en"],
      specializations: ["master", "bachelor", "ttest", "anova", "correlation", "descriptive", "apa"],
      rating: 4.7, review_count: 41, status: "active", commission_percentage: 20,
      is_active: true, is_featured: false, google_calendar_connected: false,
      created_at: iso(-220, 9), updated_at: iso(-9, 9),
    },
    {
      id: "c-liridon", user_id: "u-liridon", slug: "liridon-shala",
      display_name: "Liridon Shala",
      professional_title: "Asistent analize · Përgatitje të dhënash",
      bio: "Ndihmon studentët në hapat e parë me SPSS: importi i të dhënave, kodimi i variablave, pastrimi, statistikat përshkruese dhe testimi i normalitetit. Ideal për consulta praktike dhe të shpejta.",
      profile_photo: null,
      education: ["Bachelor në Informatikë — Universiteti i Prishtinës", "Master në vazhdim — Shkenca e të Dhënave"],
      certifications: ["Data Cleaning with SPSS (Udemy)"],
      years_experience: 3, languages: ["sq", "en"],
      specializations: ["spss", "descriptive", "bachelor", "questionnaire"],
      rating: 4.5, review_count: 18, status: "active", commission_percentage: 30,
      is_active: true, is_featured: false, google_calendar_connected: false,
      created_at: iso(-120, 9), updated_at: iso(-15, 9),
    },
    {
      id: "c-fjolla", user_id: "u-fjolla", slug: "fjolla-dema",
      display_name: "MSc. Fjolla Dema",
      professional_title: "Hulumtuese shëndeti publik",
      bio: "Përvojë në studime epidemiologjike dhe analiza të të dhënave shëndetësore. Aplikimi i saj është në shqyrtim nga ekipi i platformës.",
      profile_photo: null,
      education: ["Master në Shëndet Publik — Universiteti i Basel-it"],
      certifications: ["EpiInfo & SPSS"],
      years_experience: 5, languages: ["sq", "de", "en"],
      specializations: ["methodology", "descriptive", "nonparametric"],
      rating: 0, review_count: 0, status: "pending", commission_percentage: 20,
      is_active: false, is_featured: false, google_calendar_connected: false,
      created_at: iso(-5, 9), updated_at: iso(-5, 9),
    },
  ];

  const mkSvc = (
    id: string, name: string, slug: string, short_description: string, category: string,
    duration: number, price: number, policy: PaymentPolicy, deposit: number, description: string,
  ): Service => ({
    id, name, slug, short_description, description, category,
    default_duration_minutes: duration, default_price: price, currency: "EUR",
    is_active: true, payment_policy: policy, deposit_amount: deposit,
    created_at: iso(-380, 9), updated_at: iso(-20, 9),
  });

  const services: Service[] = [
    mkSvc("s-spss", "Konsulencë SPSS", "konsulence-spss", "Sesion individual për çdo pyetje në SPSS — nga përdorimi bazë te gabimet në syntax.", "consultation", 60, 50, "full", 0,
      "Sesion 1-on-1 online ku trajtojmë problemin tuaj konkret në SPSS: navigimi, transformimet, syntax, interpretimi i outputit dhe zgjidhja e gabimeve. Përfshin ndarjen e ekranit dhe udhëzime hap pas hapi."),
    mkSvc("s-stat", "Analizë statistikore", "analize-statistikore", "Analizë e plotë e të dhënave tuaja: nga pastrimi deri te testimi i hipotezave.", "analysis", 90, 80, "deposit", 30,
      "Analizë e plotë statistikore sipas dizajnit tuaj hulumtues: përgatitje e të dhënave, statistika përshkruese, teste të përshtatshme hipotezash dhe interpretim. Përfshin SPSS output dhe raport të shkurtër."),
    mkSvc("s-meth", "Metodologji e hulumtimit", "metodologji-hulumtimi", "Dizajni hulumtues, pyetjet hulumtuese, hipotezat dhe strategjia e mostrimit.", "methodology", 60, 60, "full", 0,
      "Konsulencë për metodologjinë: formulimi i pyetjeve hulumtuese dhe hipotezave, zgjedhja e dizajnit, përcaktimi i mostrës dhe instrumenteve. Ju ndihmojmë të ndërtoni një plan të qëndrueshëm hulumtimi."),
    mkSvc("s-reg", "Analiza e regresionit", "analiza-regresionit", "Regresion linear, i shumëfishtë, logjistik dhe hierarkik me interpretim të plotë.", "analysis", 90, 85, "deposit", 30,
      "Analizë e thelluar regresioni: kontrolli i supozimeve (lineariteti, homoskedasticiteti, multikolineariteti), ndërtimi i modelit, interpretimi i koeficientëve dhe raportimi APA i rezultateve."),
    mkSvc("s-factor", "Analiza faktoriale", "analiza-faktoriale", "EFA/CFA, struktura e konstrukteve dhe validimi i instrumentit tuaj.", "analysis", 90, 90, "deposit", 30,
      "Analizë faktoriale eksploratore (EFA) dhe konfirmatore (CFA): përshtatshmëria e mostrës (KMO, Bartlett), ekstraktimi i faktorëve, rotacioni dhe interpretimi i ngarkesave faktoriale."),
    mkSvc("s-quest", "Dizajni i pyetësorit", "dizajni-pyetesorit", "Ndërtimi i pyetësorit nga konstruktet te shkallët e validuara.", "survey", 60, 70, "full", 0,
      "Dizajnim i pyetësorit hulumtues: operacionalizimi i konstrukteve, zgjedhja e shkallëve të validuara, formulimi i pyetjeve, struktura e shkallës Likert dhe testi pilot."),
    mkSvc("s-bach", "Mbështetje për diplomë", "mbeshtetje-diplome", "Udhëheqje statistikore për punimin e diplomës nga fillimi në fund.", "thesis", 60, 60, "full", 0,
      "Mbështetje e plotë për punimin e diplomës (Bachelor): struktura e kapitullit metodologjik, përzgjedhja e analizave, interpretimi i rezultateve dhe përgatitja për mbrojtje."),
    mkSvc("s-master", "Mbështetje për master", "mbeshtetje-master", "Partner statistik për tezën e masterit — metodologji, analizë dhe raportim.", "thesis", 90, 100, "deposit", 40,
      "Bashkëpunim i vazhdueshëm për tezën e masterit: dizajni hulumtues, përgatitja e të dhënave, analizat statistikore (t-test, ANOVA, regresion, korelacion), interpretimi dhe raportimi APA."),
    mkSvc("s-phd", "Mbështetje për doktoraturë", "mbeshtetje-doktorature", "Konsulencë e avancuar për projektet doktorale dhe publikimet.", "thesis", 90, 120, "deposit", 50,
      "Konsulencë e nivelit të lartë për doktorantë: dizajne komplekse, analiza multivariate, përcaktimi i madhësisë së mostrës, përgatitja e rezultateve për publikim dhe mbrojtja e metodologjisë para komisionit."),
    mkSvc("s-custom", "Konsulencë sipas porosisë", "konsulence-porosi", "Format fleksibël për nevoja specifike — ekipet, organizatat, projektet.", "custom", 60, 75, "free_booking", 0,
      "Konsulencë e personalizuar sipas nevojës suaj: gjatësia, përmbajtja dhe formati përcaktohen bashkë. E përshtatshme për organizata, ekipe hulumtuese dhe projekte me shumë faza."),
  ];

  const cs = (consultant_id: string, service_id: string, price: number, duration_minutes: number) => ({
    id: uid("cs-"), consultant_id, service_id, price, duration_minutes, is_active: true,
    created_at: iso(-300, 9), updated_at: iso(-30, 9),
  });

  const consultant_services = [
    cs("c-arben", "s-spss", 50, 60), cs("c-arben", "s-stat", 80, 90),
    cs("c-arben", "s-reg", 85, 90), cs("c-arben", "s-factor", 90, 90),
    cs("c-arben", "s-master", 100, 90),
    cs("c-elira", "s-meth", 60, 60), cs("c-elira", "s-quest", 70, 60), cs("c-elira", "s-spss", 55, 60),
    cs("c-elira", "s-bach", 60, 60),
    cs("c-besnik", "s-reg", 95, 90), cs("c-besnik", "s-factor", 100, 90),
    cs("c-besnik", "s-stat", 90, 90), cs("c-besnik", "s-phd", 130, 90),
    cs("c-teuta", "s-master", 100, 90), cs("c-teuta", "s-bach", 65, 60),
    cs("c-teuta", "s-stat", 75, 90), cs("c-teuta", "s-spss", 45, 60),
    cs("c-liridon", "s-spss", 40, 60), cs("c-liridon", "s-bach", 50, 60), cs("c-liridon", "s-quest", 60, 60),
  ];

  const aw = (consultant_id: string, day_of_week: number, start_time: string, end_time: string) => ({
    id: uid("aw-"), consultant_id, day_of_week, start_time, end_time, is_available: true,
  });

  const availability = [
    ...[1, 2, 3, 4, 5].flatMap((d) => [aw("c-arben", d, "09:00", "12:00"), aw("c-arben", d, "13:00", "17:00")]),
    ...[1, 3, 4].flatMap((d) => [aw("c-elira", d, "10:00", "18:00")]),
    ...[2, 3, 4, 5, 6].flatMap((d) => [aw("c-besnik", d, "09:00", "14:00")]),
    ...[1, 2, 3, 4].flatMap((d) => [aw("c-teuta", d, "12:00", "19:00")]),
    ...[1, 2, 3, 4, 5].flatMap((d) => [aw("c-liridon", d, "08:00", "14:00")]),
  ];

  const blocks = [
    { id: uid("b-"), consultant_id: "c-arben", date: D(10), end_date: D(11), start_time: null, end_time: null, reason: "Pushim vjetor", type: "vacation" as const },
    { id: uid("b-"), consultant_id: "c-elira", date: D(5), end_date: null, start_time: "14:00", end_time: "15:30", reason: "Takim ekipi", type: "meeting" as const },
    { id: uid("b-"), consultant_id: "c-teuta", date: D(2), end_date: null, start_time: "16:00", end_time: "17:00", reason: "Orar ligjërate", type: "personal" as const },
  ];

  let refCounter = 101;
  const mkAppt = (p: Partial<Appointment> & Pick<Appointment, "id" | "client_id" | "client_name" | "client_email" | "client_phone" | "consultant_id" | "service_id" | "date" | "start_time" | "duration_minutes" | "price" | "status">): Appointment => {
    const end = minToTime(timeToMin(p.start_time) + p.duration_minutes);
    return {
      reference: `SPSS-2026-${String(refCounter++).padStart(6, "0")}`,
      manage_token: uid("mt-"), project_id: null, end_time: end, currency: "EUR",
      language: "sq", university: "", study_level: "master" as StudyLevel,
      research_topic: "", problem_description: "", spss_experience: "basic",
      required_analysis: "", intake: {}, payment_status: "unpaid",
      payment_policy: "full" as PaymentPolicy, meeting_provider: "none", meeting_url: null,
      external_event_id: null, internal_notes: "", completion: null, history: [],
      rescheduled_from: null, created_at: iso(-20, 10), ...p,
    } as Appointment;
  };
  const meet = () => `https://meet.google.com/${uid("").slice(0, 3)}-${uid("").slice(0, 4)}-${uid("").slice(0, 3)}`;

  const K1 = { client_id: "u-klient", client_name: "Klient Demo", client_email: "klient@demo.al", client_phone: "+383 44 555 111" };
  const K2 = { client_id: "u-mira", client_name: "Mira Jahja", client_email: "mira@demo.al", client_phone: "+383 44 555 222" };
  const K3 = { client_id: "u-valon", client_name: "Valon Krasniqi", client_email: "valon@demo.al", client_phone: "+383 44 555 333" };

  const appointments: Appointment[] = [
    mkAppt({ id: "a101", ...K1, consultant_id: "c-arben", service_id: "s-spss", date: D(-9), start_time: "10:00", duration_minutes: 60, price: 50, status: "completed", payment_status: "paid", payment_policy: "full", project_id: null, university: "Universiteti i Prishtinës", research_topic: "Gabime në syntax gjatë recode", completion: { summary: "U rregulluan gabimet e syntax dhe u demonstrua transformimi i variablave.", analyses_performed: "Recode, Compute Variable", findings: "Syntax-i kishte gabim në komandën RECODE për vlerat e munguara.", recommendations: "Përdorni MISSING VALUES analysis para çdo transformimi.", next_steps: "Vazhdoni me statistikat përshkruese.", follow_up: "none", follow_up_timeframe: "" } }),
    mkAppt({ id: "a102", ...K2, consultant_id: "c-elira", service_id: "s-meth", date: D(-7), start_time: "11:00", duration_minutes: 60, price: 60, status: "completed", payment_status: "paid", university: "Universiteti i Tiranës", research_topic: "Formulimi i hipotezave për studimin e motivimit", completion: { summary: "U rishkruan 3 hipoteza dhe u qartësua dizajni korrelacional.", analyses_performed: "Dizajni hulumtues", findings: "Hipotezat fillestare ishin të pa-testueshme operacionalisht.", recommendations: "Operacionalizoni variablat përmes shkallës së validuar.", next_steps: "Dërgoni draftin e pyetësorit për rishikim.", follow_up: "recommended", follow_up_timeframe: "2 javë" } }),
    mkAppt({ id: "a103", ...K3, consultant_id: "c-liridon", service_id: "s-spss", date: D(-6), start_time: "09:00", duration_minutes: 60, price: 40, status: "no_show", university: "UBT", research_topic: "Importi i të dhënave nga Excel" }),
    mkAppt({ id: "a104", ...K2, consultant_id: "c-besnik", service_id: "s-reg", date: D(-5), start_time: "10:00", duration_minutes: 90, price: 95, status: "completed", payment_status: "paid", project_id: "p2", university: "Universiteti i Graz-it", research_topic: "Parashikuesit e ankthit te studentët", completion: { summary: "U ndërtua modeli i regresionit të shumëfishtë me 5 parashikues.", analyses_performed: "Regresion i shumëfishtë, VIF, Durbin-Watson", findings: "Modeli shpjegon 42% të variancës (R²=0.42, p<.001). Stresi akademik është parashikuesi më i fortë (β=0.38).", recommendations: "Kontrolloni ndikimin e outliers me Cook's Distance.", next_steps: "Interpretimi përfundimtar dhe raportimi APA.", follow_up: "required", follow_up_timeframe: "1 javë" } }),
    mkAppt({ id: "a105", ...K1, consultant_id: "c-teuta", service_id: "s-master", date: D(-4), start_time: "14:00", duration_minutes: 90, price: 100, status: "completed", payment_status: "paid", project_id: "p1", university: "Universiteti i Prishtinës", research_topic: "Teza master: kënaqësia në punë dhe performanca", completion: { summary: "U përfundua analiza e besueshmërisë dhe statistikat përshkruese.", analyses_performed: "Cronbach's Alpha, Descriptives, Normality", findings: "Të gjitha shkallët kanë Alpha mbi 0.80. Të dhënat shpërndahen normalisht.", recommendations: "Vazhdoni me korelacionin Pearson.", next_steps: "Analiza e korelacionit javën tjetër.", follow_up: "recommended", follow_up_timeframe: "1 javë" } }),
    mkAppt({ id: "a106", ...K3, consultant_id: "c-elira", service_id: "s-quest", date: D(-3), start_time: "15:00", duration_minutes: 60, price: 70, status: "cancelled" }),
    mkAppt({ id: "a107", ...K1, consultant_id: "c-arben", service_id: "s-stat", date: D(-2), start_time: "10:00", duration_minutes: 90, price: 80, status: "rescheduled", payment_status: "paid" }),
    mkAppt({ id: "a108", ...K1, consultant_id: "c-arben", service_id: "s-stat", date: D(8), start_time: "10:00", duration_minutes: 90, price: 80, status: "confirmed", payment_status: "paid", meeting_provider: "google_meet", meeting_url: meet(), external_event_id: "gcal-" + uid(""), rescheduled_from: "a107", history: [{ old_date: D(-2), old_start: "10:00", new_date: D(8), new_start: "10:00", changed_by: "Klient Demo", changed_by_role: "client", changed_at: iso(-2, 15) }], research_topic: "Analiza e plotë për artikull shkencor" }),
    mkAppt({ id: "a109", ...K1, consultant_id: "c-teuta", service_id: "s-master", date: D(-1), start_time: "15:00", duration_minutes: 90, price: 100, status: "completed", payment_status: "paid", project_id: "p1", university: "Universiteti i Prishtinës", research_topic: "Korelacioni dhe regresioni për tezën master", completion: { summary: "U krye analiza e korelacionit dhe u interpretuan rezultatet.", analyses_performed: "Pearson correlation, Multiple regression", findings: "Kënaqësia në punë korelon pozitivisht me performancën (r=0.56, p<.001). Modeli i regresionit është significant (F=18.4, p<.001).", recommendations: "Raportoni rezultatet në tabelë APA dhe shtoni intervalin e besimit.", next_steps: "Drafti i kapitullit të rezultateve.", follow_up: "recommended", follow_up_timeframe: "2 javë" } }),
    mkAppt({ id: "a110", ...K1, consultant_id: "c-arben", service_id: "s-spss", date: D(1), start_time: "09:00", duration_minutes: 60, price: 50, status: "confirmed", payment_status: "paid", meeting_provider: "google_meet", meeting_url: meet(), external_event_id: "gcal-" + uid(""), university: "Universiteti i Prishtinës", research_topic: "Testimi i normalitetit para analizës" }),
    mkAppt({ id: "a111", ...K3, consultant_id: "c-elira", service_id: "s-quest", date: D(1), start_time: "14:00", duration_minutes: 60, price: 70, status: "confirmed", payment_status: "paid", meeting_provider: "google_meet", meeting_url: meet(), university: "UBT", research_topic: "Pyetësori për klimën organizative" }),
    mkAppt({ id: "a112", ...K2, consultant_id: "c-besnik", service_id: "s-reg", date: D(2), start_time: "10:00", duration_minutes: 90, price: 95, status: "confirmed", payment_status: "deposit_paid", payment_policy: "deposit", project_id: "p2", meeting_provider: "google_meet", meeting_url: meet(), university: "Universiteti i Graz-it", research_topic: "Kontrolli i supozimeve të regresionit" }),
    mkAppt({ id: "a113", ...K3, consultant_id: "c-teuta", service_id: "s-bach", date: D(2), start_time: "13:30", duration_minutes: 60, price: 65, status: "pending", university: "UBT", research_topic: "Struktura e kapitullit metodologjik" }),
    mkAppt({ id: "a114", ...K2, consultant_id: "c-arben", service_id: "s-reg", date: D(3), start_time: "10:00", duration_minutes: 90, price: 85, status: "confirmed", payment_status: "unpaid", payment_policy: "full", university: "Universiteti i Tiranës", research_topic: "Regresioni hierarkik për moderimin" }),
    mkAppt({ id: "a115", ...K1, consultant_id: "c-liridon", service_id: "s-spss", date: D(4), start_time: "09:00", duration_minutes: 60, price: 40, status: "pending", university: "Universiteti i Prishtinës", research_topic: "Kodimi i variablave demografike" }),
    mkAppt({ id: "a116", ...K1, consultant_id: "c-teuta", service_id: "s-master", date: D(5), start_time: "13:00", duration_minutes: 90, price: 100, status: "confirmed", payment_status: "deposit_paid", payment_policy: "deposit", project_id: "p1", meeting_provider: "google_meet", meeting_url: meet(), university: "Universiteti i Prishtinës", research_topic: "Interpretimi përfundimtar i rezultateve" }),
    mkAppt({ id: "a117", ...K2, consultant_id: "c-elira", service_id: "s-meth", date: D(6), start_time: "10:00", duration_minutes: 60, price: 60, status: "confirmed", payment_status: "paid", meeting_provider: "google_meet", meeting_url: meet(), university: "Universiteti i Tiranës", research_topic: "Rishikimi i dizajnit hulumtues" }),
    mkAppt({ id: "a118", ...K2, consultant_id: "c-besnik", service_id: "s-phd", date: D(7), start_time: "12:00", duration_minutes: 90, price: 130, status: "pending", payment_status: "unpaid", payment_policy: "deposit", project_id: "p2", university: "Universiteti i Graz-it", research_topic: "Mbrojtja e metodologjisë para komisionit" }),
  ];

  const projects: Project[] = [
    {
      id: "p1", client_id: "u-klient", primary_consultant_id: "c-teuta",
      title: "Teza master — Kënaqësia në punë & performanca",
      description: "Studim korrelacional mbi lidhjen mes kënaqësisë në punë dhe performancës së punonjësve në sektorin e shërbimeve.",
      research_topic: "Kënaqësia në punë dhe performanca organizative",
      research_questions: "A ekziston lidhja mes kënaqësisë në punë dhe performancës? Sa e fortë është ajo?",
      hypotheses: "H1: Kënaqësia në punë korelon pozitivisht me performancën. H2: Kushtet e punës parashikojnë kënaqësinë.",
      study_level: "master", university: "Universiteti i Prishtinës", deadline: D(30),
      status: "analysis_in_progress", created_at: iso(-14, 10), updated_at: iso(-1, 16),
    },
    {
      id: "p2", client_id: "u-mira", primary_consultant_id: "c-besnik",
      title: "Doktoraturë — Parashikuesit e ankthit akademik",
      description: "Model regresioni me 5 parashikues për ankthin akademik te studentët universitarë.",
      research_topic: "Parashikuesit e ankthit akademik",
      research_questions: "Cilët faktorë parashikojnë ankthin akademik?",
      hypotheses: "H1: Stresi akademik parashikon ankthin. H2: Mbështetja sociale moderon efektin.",
      study_level: "phd", university: "Universiteti i Graz-it", deadline: D(75),
      status: "data_review", created_at: iso(-25, 10), updated_at: iso(-5, 11),
    },
    {
      id: "p3", client_id: "u-valon", primary_consultant_id: "c-elira",
      title: "Pyetësori — Klima organizative në IT",
      description: "Zhvillimi i pyetësorit të klimës organizative me shkallë të validuara.",
      research_topic: "Klima organizative në kompanitë IT",
      research_questions: "Si perceptohet klima organizative nga punonjësit?",
      hypotheses: "—", study_level: "professional", university: "UBT", deadline: D(-10),
      status: "completed", created_at: iso(-60, 10), updated_at: iso(-10, 12),
    },
    {
      id: "p4", client_id: "u-klient", primary_consultant_id: "c-arben",
      title: "Analizë për artikull shkencor",
      description: "Analizë e plotë statistikore për artikull në revistë ndërkombëtare (SPSS + raportim APA).",
      research_topic: "Faktorët e suksesit të e-learning",
      research_questions: "Cilët faktorë ndikojnë në suksesin e mësimit online?",
      hypotheses: "H1: Vetë-efikasiteti ndikon në sukses.",
      study_level: "phd", university: "Universiteti i Prishtinës", deadline: D(45),
      status: "waiting_for_files", created_at: iso(-2, 10), updated_at: iso(-1, 9),
    },
  ];

  const project_consultants = [
    { id: uid("pc-"), project_id: "p1", consultant_id: "c-teuta", role: "lead" as const, assigned_at: iso(-14, 10) },
    { id: uid("pc-"), project_id: "p1", consultant_id: "c-arben", role: "statistics" as const, assigned_at: iso(-12, 10) },
    { id: uid("pc-"), project_id: "p2", consultant_id: "c-besnik", role: "lead" as const, assigned_at: iso(-25, 10) },
    { id: uid("pc-"), project_id: "p3", consultant_id: "c-elira", role: "lead" as const, assigned_at: iso(-60, 10) },
    { id: uid("pc-"), project_id: "p4", consultant_id: "c-arben", role: "lead" as const, assigned_at: iso(-2, 10) },
  ];

  const mkTask = (project_id: string, name: string, order: number, status: AnalysisTask["status"], progress: number, notes = "", assigned: string | null = null): AnalysisTask => ({
    id: uid("t-"), project_id, name, task_order: order, status, progress,
    assigned_consultant_id: assigned, notes,
    completed_at: status === "completed" ? iso(-2, 12) : null,
  });

  const analysis_tasks: AnalysisTask[] = [
    mkTask("p1", "Data received", 1, "completed", 100, "Seti u pranua (n=214)."), mkTask("p1", "Data preparation", 2, "completed", 100),
    mkTask("p1", "Data cleaning", 3, "completed", 100, "U hoqën 6 raste me të dhëna të munguara."),
    mkTask("p1", "Missing values", 4, "completed", 100),
    mkTask("p1", "Reliability analysis", 5, "completed", 100, "Cronbach's Alpha: 0.82–0.91.", "c-teuta"),
    mkTask("p1", "Normality testing", 6, "completed", 100, "Shapiro-Wilk p>0.05 për të gjitha variablat."),
    mkTask("p1", "Descriptive statistics", 7, "completed", 100),
    mkTask("p1", "Correlation", 8, "in_progress", 80, "Pearson u krye; mbetet tabela APA.", "c-teuta"),
    mkTask("p1", "Regression", 9, "in_progress", 40, "Modeli i parë i ndërtuar; duhet kontrolli i supozimeve.", "c-arben"),
    mkTask("p1", "Statistical interpretation", 10, "not_started", 0),
    mkTask("p1", "APA reporting", 11, "not_started", 0),
    mkTask("p1", "Final report", 12, "not_started", 0),
    mkTask("p2", "Data received", 1, "completed", 100), mkTask("p2", "Data cleaning", 2, "in_progress", 60, "Outlier detection në vazhdim.", "c-besnik"),
    mkTask("p2", "Variable coding", 3, "in_progress", 50), mkTask("p2", "Regression", 4, "completed", 100, "R²=0.42."),
    mkTask("p2", "Logistic Regression", 5, "waiting", 0, "Pritet pastrimi i të dhënave."),
    mkTask("p2", "Hypothesis testing", 6, "not_started", 0),
    mkTask("p3", "Composite variables", 1, "completed", 100), mkTask("p3", "Reliability analysis", 2, "completed", 100),
    mkTask("p3", "Descriptive statistics", 3, "completed", 100), mkTask("p3", "Final report", 4, "completed", 100),
    mkTask("p4", "Data received", 1, "in_progress", 50, "Pritet seti nga klienti."),
    mkTask("p4", "Descriptive statistics", 2, "not_started", 0), mkTask("p4", "Regression", 3, "not_started", 0),
    mkTask("p4", "APA reporting", 4, "not_required", 0),
  ];

  const mkFile = (p: Omit<ProjectFile, "id" | "file_path" | "created_at"> & { created_at?: string }): ProjectFile => ({
    id: uid("f-"), file_path: "private/files/" + uid("fp-") + "/" + p.file_name, created_at: iso(-3, 11), ...p,
  } as ProjectFile);

  const files: ProjectFile[] = [
    mkFile({ client_id: "u-klient", project_id: "p1", appointment_id: null, uploaded_by: "u-klient", file_name: "kenaqesia_punes_n214.sav", file_type: ".sav", file_size: 482133, category: "dataset", content_note: "Seti kryesor i të dhënave (n=214, 34 variabla)." }),
    mkFile({ client_id: "u-klient", project_id: "p1", appointment_id: null, uploaded_by: "u-klient", file_name: "pyetesori_final.docx", file_type: ".docx", file_size: 88112, category: "questionnaire", content_note: "Pyetësori i validuar me 4 shkallë." }),
    mkFile({ client_id: "u-klient", project_id: "p1", appointment_id: null, uploaded_by: "u-teuta", file_name: "reliability_output.spv", file_type: ".spv", file_size: 154002, category: "spss_output", content_note: "Cronbach's Alpha për të gjitha shkallët." }),
    mkFile({ client_id: "u-klient", project_id: "p1", appointment_id: null, uploaded_by: "u-teuta", file_name: "korrelacioni_tabela.xlsx", file_type: ".xlsx", file_size: 45201, category: "report", content_note: "Matrica e korelacionit (Pearson)." }),
    mkFile({ client_id: "u-mira", project_id: "p2", appointment_id: null, uploaded_by: "u-mira", file_name: "ankthi_studentet_n340.sav", file_type: ".sav", file_size: 611904, category: "dataset", content_note: "Seti i doktoraturës (n=340)." }),
    mkFile({ client_id: "u-mira", project_id: "p2", appointment_id: null, uploaded_by: "u-besnik", file_name: "regresioni_modeli1.spv", file_type: ".spv", file_size: 201332, category: "spss_output", content_note: "Modeli i regresionit të shumëfishtë." }),
    mkFile({ client_id: "u-valon", project_id: "p3", appointment_id: null, uploaded_by: "u-elira", file_name: "raporti_klimes_it.pdf", file_type: ".pdf", file_size: 1204113, category: "deliverable", content_note: "Raporti përfundimtar i klimës organizative." }),
    mkFile({ client_id: "u-valon", project_id: "p3", appointment_id: null, uploaded_by: "u-elira", file_name: "pyetesori_klima_v3.docx", file_type: ".docx", file_size: 72044, category: "deliverable", content_note: "Versioni final i pyetësorit." }),
    mkFile({ client_id: "u-klient", project_id: null, appointment_id: "a110", uploaded_by: "u-klient", file_name: "dhenat_paraprake.csv", file_type: ".csv", file_size: 30111, category: "dataset", content_note: "Të dhëna paraprake për konsulencën e normalitetit." }),
    mkFile({ client_id: "u-mira", project_id: "p2", appointment_id: null, uploaded_by: "u-mira", file_name: "tezja_kapitulli3.docx", file_type: ".docx", file_size: 350220, category: "thesis", content_note: "Kapitulli metodologjik për rishikim." }),
  ];

  const mkPay = (p: Partial<Payment> & Pick<Payment, "id" | "appointment_id" | "client_id" | "consultant_id" | "amount_gross" | "type" | "status">): Payment => {
    const c = consultants.find((x) => x.id === p.consultant_id)!;
    const fee = +(p.amount_gross * (c.commission_percentage / 100)).toFixed(2);
    return {
      project_id: null, platform_fee: fee, consultant_net: +(p.amount_gross - fee).toFixed(2),
      currency: "EUR", payout_status: "pending", method: "stripe", invoice_id: null,
      created_at: iso(-8, 12), paid_at: p.status === "paid" ? iso(-8, 12) : null, ...p,
    } as Payment;
  };

  const payments: Payment[] = [
    mkPay({ id: "pay1", appointment_id: "a101", client_id: "u-klient", consultant_id: "c-arben", amount_gross: 50, type: "full", status: "paid", payout_status: "approved", paid_at: iso(-9, 9) }),
    mkPay({ id: "pay2", appointment_id: "a102", client_id: "u-mira", consultant_id: "c-elira", amount_gross: 60, type: "full", status: "paid", payout_status: "paid", paid_at: iso(-7, 10) }),
    mkPay({ id: "pay3", appointment_id: "a103", client_id: "u-valon", consultant_id: "c-liridon", amount_gross: 40, type: "full", status: "failed" }),
    mkPay({ id: "pay4", appointment_id: "a104", client_id: "u-mira", consultant_id: "c-besnik", amount_gross: 95, type: "full", status: "paid", paid_at: iso(-5, 9) }),
    mkPay({ id: "pay5", appointment_id: "a105", client_id: "u-klient", consultant_id: "c-teuta", amount_gross: 40, type: "deposit", status: "paid", paid_at: iso(-6, 9) }),
    mkPay({ id: "pay6", appointment_id: "a105", client_id: "u-klient", consultant_id: "c-teuta", amount_gross: 60, type: "balance", status: "paid", paid_at: iso(-4, 17) }),
    mkPay({ id: "pay7", appointment_id: "a109", client_id: "u-klient", consultant_id: "c-teuta", amount_gross: 100, type: "full", status: "paid", paid_at: iso(-2, 9) }),
    mkPay({ id: "pay8", appointment_id: "a110", client_id: "u-klient", consultant_id: "c-arben", amount_gross: 50, type: "full", status: "paid", paid_at: iso(-1, 9) }),
    mkPay({ id: "pay9", appointment_id: "a111", client_id: "u-valon", consultant_id: "c-elira", amount_gross: 70, type: "full", status: "paid", paid_at: iso(-1, 14) }),
    mkPay({ id: "pay10", appointment_id: "a112", client_id: "u-mira", consultant_id: "c-besnik", amount_gross: 30, type: "deposit", status: "paid", paid_at: iso(-1, 11) }),
    mkPay({ id: "pay11", appointment_id: "a112", client_id: "u-mira", consultant_id: "c-besnik", amount_gross: 65, type: "balance", status: "pending" }),
    mkPay({ id: "pay12", appointment_id: "a116", client_id: "u-klient", consultant_id: "c-teuta", amount_gross: 40, type: "deposit", status: "paid", paid_at: iso(0, 8) }),
    mkPay({ id: "pay13", appointment_id: "a116", client_id: "u-klient", consultant_id: "c-teuta", amount_gross: 60, type: "balance", status: "pending" }),
    mkPay({ id: "pay14", appointment_id: "a114", client_id: "u-mira", consultant_id: "c-arben", amount_gross: 85, type: "full", status: "pending" }),
    mkPay({ id: "pay15", appointment_id: "a117", client_id: "u-mira", consultant_id: "c-elira", amount_gross: 60, type: "full", status: "paid", paid_at: iso(0, 9) }),
    mkPay({ id: "pay16", appointment_id: "a108", client_id: "u-klient", consultant_id: "c-arben", amount_gross: 80, type: "full", status: "paid", paid_at: iso(-3, 10) }),
  ];

  const invoices: Invoice[] = [
    { id: "inv1", invoice_number: "INV-2026-0001", client_id: "u-klient", appointment_id: "a101", project_id: null, payment_id: "pay1", amount_net: 42.37, tax_amount: 7.63, amount_total: 50, currency: "EUR", status: "paid", issue_date: D(-9), due_date: D(5), pdf_path: "invoices/0001.pdf", created_at: iso(-9, 10) },
    { id: "inv2", invoice_number: "INV-2026-0002", client_id: "u-mira", appointment_id: "a102", project_id: null, payment_id: "pay2", amount_net: 50.85, tax_amount: 9.15, amount_total: 60, currency: "EUR", status: "paid", issue_date: D(-7), due_date: D(7), pdf_path: "invoices/0002.pdf", created_at: iso(-7, 11) },
    { id: "inv3", invoice_number: "INV-2026-0003", client_id: "u-mira", appointment_id: "a104", project_id: "p2", payment_id: "pay4", amount_net: 80.51, tax_amount: 14.49, amount_total: 95, currency: "EUR", status: "paid", issue_date: D(-5), due_date: D(9), pdf_path: "invoices/0003.pdf", created_at: iso(-5, 10) },
    { id: "inv4", invoice_number: "INV-2026-0004", client_id: "u-klient", appointment_id: "a105", project_id: "p1", payment_id: "pay5", amount_net: 33.9, tax_amount: 6.1, amount_total: 40, currency: "EUR", status: "paid", issue_date: D(-6), due_date: D(8), pdf_path: "invoices/0004.pdf", created_at: iso(-6, 9) },
    { id: "inv5", invoice_number: "INV-2026-0005", client_id: "u-klient", appointment_id: "a109", project_id: "p1", payment_id: "pay7", amount_net: 84.75, tax_amount: 15.25, amount_total: 100, currency: "EUR", status: "paid", issue_date: D(-2), due_date: D(12), pdf_path: "invoices/0005.pdf", created_at: iso(-2, 10) },
    { id: "inv6", invoice_number: "INV-2026-0006", client_id: "u-valon", appointment_id: "a103", project_id: null, payment_id: "pay3", amount_net: 33.9, tax_amount: 6.1, amount_total: 40, currency: "EUR", status: "overdue", issue_date: D(-6), due_date: D(-1), pdf_path: null, created_at: iso(-6, 10) },
  ];

  const reviews = [
    { id: "r1", appointment_id: "a101", client_id: "u-klient", consultant_id: "c-arben", rating: 5, clarity: 5, usefulness: 5, recommendation: 5, comment: "Shpjegim jashtëzakonisht i qartë. E zgjidhi problemin tim me syntax brenda sesionit dhe më mësoi si ta shmang në të ardhmen.", consent_to_publish: true, show_name: true, status: "published" as const, created_at: iso(-8, 10) },
    { id: "r2", appointment_id: "a102", client_id: "u-mira", consultant_id: "c-elira", rating: 4, clarity: 5, usefulness: 4, recommendation: 5, comment: "Më ndihmoi të riformuloj hipotezat në mënyrë të testueshme. Shumë profesionale.", consent_to_publish: true, show_name: false, status: "published" as const, created_at: iso(-6, 10) },
    { id: "r3", appointment_id: "a104", client_id: "u-mira", consultant_id: "c-besnik", rating: 5, clarity: 5, usefulness: 5, recommendation: 5, comment: "Analiza e regresionit u interpretua hap pas hapi, me kontroll të plotë të supozimeve. E rekomandoj për çdo doktorant.", consent_to_publish: true, show_name: true, status: "published" as const, created_at: iso(-4, 10) },
    { id: "r4", appointment_id: "a105", client_id: "u-klient", consultant_id: "c-teuta", rating: 5, clarity: 5, usefulness: 4, recommendation: 5, comment: "Durim i madh me studentët. Tabela APA ishte gati menjëherë pas sesionit.", consent_to_publish: true, show_name: true, status: "pending" as const, created_at: iso(-3, 10) },
  ];

  const waitlist = [
    { id: uid("w-"), name: "Arta Nika", email: "arta.nika@email.com", phone: "+383 44 777 111", service_id: "s-spss", consultant_id: null, preferred_dates: "Çdo ditë e javës", preferred_time: "Pasdite", status: "waiting" as const, matched_appointment_id: null, created_at: iso(-2, 10) },
    { id: uid("w-"), name: "Gent Berisha", email: "gent.b@email.com", phone: "+383 44 777 222", service_id: "s-reg", consultant_id: "c-besnik", preferred_dates: "Java tjetër", preferred_time: "Paradite", status: "notified" as const, matched_appointment_id: null, created_at: iso(-5, 10) },
    { id: uid("w-"), name: "Elza Krasniqi", email: "elza.k@email.com", phone: "+383 44 777 333", service_id: "s-bach", consultant_id: "c-teuta", preferred_dates: "Sa më shpejt", preferred_time: "Çfarëdo", status: "booked" as const, matched_appointment_id: "a113", created_at: iso(-8, 10) },
  ];

  const applications = [
    { id: uid("app-"), name: "MSc. Fjolla Dema", email: "fjolla@statlab.al", phone: "+383 49 333 006", country: "Zvicër", education: "Master në Shëndet Publik — Universiteti i Basel-it", experience: "5 vite në studime epidemiologjike", spss_experience: "SPSS për analiza të të dhënave shëndetësore, teste joparametrike", methodology_experience: "Dizajne studimesh të prerjes tërthore dhe kohorte", specializations: ["methodology", "nonparametric", "descriptive"], languages: ["sq", "de", "en"], cv_file: "cv_fjolla_dema.pdf", linkedin: "linkedin.com/in/fjolla-dema", motivation: "Dëshiroj të mbështes studentët shqiptarë në analizat e tyre me standarde ndërkombëtare.", status: "under_review" as const, created_at: iso(-5, 12) },
    { id: uid("app-"), name: "Dr. Uran Maloku", email: "uran.maloku@uni-pr.edu", phone: "+383 49 888 000", country: "Kosovë", education: "Doktoraturë në Sociologji — UP", experience: "8 vite mësimdhënie metodologjie", spss_experience: "I përditshëm në mësimdhënie dhe hulumtime", methodology_experience: "Metoda sasiore e cilësore, mostra komplekse", specializations: ["methodology", "spss", "survey"], languages: ["sq", "en"], cv_file: "cv_uran_maloku.pdf", linkedin: "linkedin.com/in/uran-maloku", motivation: "Bashkëpunim afatgjatë me platformën për mentorim studentësh.", status: "submitted" as const, created_at: iso(-1, 9) },
  ];

  const activity = [
    { id: uid("al-"), actor_id: "u-klient", actor_name: "Klient Demo", actor_role: "client", action: "appointment.created", entity_type: "appointment", entity_id: "a115", metadata: "Konsulencë SPSS me Liridon Shala", created_at: iso(0, 8) },
    { id: uid("al-"), actor_id: "u-admin", actor_name: "Arta Berisha", actor_role: "admin", action: "appointment.confirmed", entity_type: "appointment", entity_id: "a117", metadata: "SPSS-2026-000117 u konfirmua", created_at: iso(0, 9) },
    { id: uid("al-"), actor_id: "system", actor_name: "Sistemi", actor_role: "system", action: "payment.received", entity_type: "payment", entity_id: "pay15", metadata: "€60 — Mira Jahja", created_at: iso(0, 9) },
    { id: uid("al-"), actor_id: "u-teuta", actor_name: "MSc. Teuta Morina", actor_role: "consultant", action: "appointment.completed", entity_type: "appointment", entity_id: "a109", metadata: "U plotësua përmbledhja e konsulencës", created_at: iso(-1, 17) },
    { id: uid("al-"), actor_id: "u-klient", actor_name: "Klient Demo", actor_role: "client", action: "review.submitted", entity_type: "review", entity_id: "r4", metadata: "Vlerësim 5★ për Teuta Morina", created_at: iso(-1, 18) },
    { id: uid("al-"), actor_id: "u-teuta", actor_name: "MSc. Teuta Morina", actor_role: "consultant", action: "file.uploaded", entity_type: "file", entity_id: "spv", metadata: "reliability_output.spv → Projekti p1", created_at: iso(-1, 16) },
    { id: uid("al-"), actor_id: "u-klient", actor_name: "Klient Demo", actor_role: "client", action: "appointment.rescheduled", entity_type: "appointment", entity_id: "a108", metadata: `Nga ${D(-2)} 10:00 në ${D(8)} 10:00`, created_at: iso(-2, 15) },
    { id: uid("al-"), actor_id: "u-admin", actor_name: "Arta Berisha", actor_role: "admin", action: "invoice.generated", entity_type: "invoice", entity_id: "inv5", metadata: "INV-2026-0005 — €100", created_at: iso(-2, 10) },
    { id: uid("al-"), actor_id: "u-besnik", actor_name: "Dr. Besnik Gashi", actor_role: "consultant", action: "project.status_changed", entity_type: "project", entity_id: "p2", metadata: "analysis_in_progress → data_review", created_at: iso(-5, 11) },
    { id: uid("al-"), actor_id: "u-admin", actor_name: "Arta Berisha", actor_role: "admin", action: "consultant.approved", entity_type: "consultant", entity_id: "c-liridon", metadata: "Liridon Shala u aktivizua", created_at: iso(-10, 10) },
    { id: uid("al-"), actor_id: "u-admin", actor_name: "Arta Berisha", actor_role: "admin", action: "service.updated", entity_type: "service", entity_id: "s-master", metadata: "Çmimi u ndryshua në €100", created_at: iso(-20, 9) },
    { id: uid("al-"), actor_id: "u-admin", actor_name: "Arta Berisha", actor_role: "admin", action: "project.created", entity_type: "project", entity_id: "p4", metadata: "Analizë për artikull shkencor", created_at: iso(-2, 10) },
  ];

  const notifications = [
    { id: uid("n-"), recipient_id: "u-admin", recipient_email: "admin@statlab.al", appointment_id: "a115", type: "booking_received" as const, channel: "email" as const, subject: "Rezervim i ri — SPSS-2026-000115", body: "Klient Demo rezervoi Konsulencë SPSS me Liridon Shala.", status: "sent" as const, sent_at: iso(0, 8) },
    { id: uid("n-"), recipient_id: "u-liridon", recipient_email: "liridon@statlab.al", appointment_id: "a115", type: "consultant_assigned" as const, channel: "email" as const, subject: "Termin i ri në pritje", body: "Keni një kërkesë të re për konsultë.", status: "sent" as const, sent_at: iso(0, 8) },
    { id: uid("n-"), recipient_id: "u-klient", recipient_email: "klient@demo.al", appointment_id: "a110", type: "reminder_24h" as const, channel: "email" as const, subject: "Kujtesë: konsulta juaj nesër në 09:00", body: "Konsulencë SPSS me Dr. Arben Hoxha. Linku: " + (appointments.find((a) => a.id === "a110")?.meeting_url ?? ""), status: "queued" as const, sent_at: iso(0, 7) },
    { id: uid("n-"), recipient_id: "u-klient", recipient_email: "klient@demo.al", appointment_id: "a109", type: "consultation_completed" as const, channel: "email" as const, subject: "Konsulta u përfundua — rezultatet janë gati", body: "Përmbledhja dhe rekomandimet janë në portalin tuaj.", status: "sent" as const, sent_at: iso(-1, 17) },
    { id: uid("n-"), recipient_id: "u-klient", recipient_email: "klient@demo.al", appointment_id: "a108", type: "booking_rescheduled" as const, channel: "email" as const, subject: "Rezervimi u rizhvendos", body: `Termini i ri: ${D(8)} në 10:00.`, status: "sent" as const, sent_at: iso(-2, 15) },
    { id: uid("n-"), recipient_id: "u-mira", recipient_email: "mira@demo.al", appointment_id: "a112", type: "payment_received" as const, channel: "email" as const, subject: "Parapagimi u pranua — €30", body: "Faktura INV do t'ju dërgohet së shpejti.", status: "sent" as const, sent_at: iso(-1, 11) },
  ];

  const consents = [
    { id: uid("cns-"), user_id: "u-klient", consent_type: "privacy" as const, consent_version: "1.2", accepted_at: iso(-30, 10) },
    { id: uid("cns-"), user_id: "u-klient", consent_type: "terms" as const, consent_version: "1.2", accepted_at: iso(-30, 10) },
    { id: uid("cns-"), user_id: "u-klient", consent_type: "data_processing" as const, consent_version: "1.0", accepted_at: iso(-30, 10) },
    { id: uid("cns-"), user_id: "u-klient", consent_type: "confidentiality" as const, consent_version: "1.0", accepted_at: iso(-30, 10) },
  ];

  const intake_templates = [
    {
      id: "it-regression", category: "regression",
      fields: [
        { key: "research_question", label: "Pyetja hulumtuese", type: "textarea" as const, required: true, placeholder: "p.sh. Cilët faktorë parashikojnë suksesin akademik?" },
        { key: "dv", label: "Variabla e varur", type: "text" as const, required: true, placeholder: "p.sh. Performanca" },
        { key: "ivs", label: "Variablat e pavarura", type: "textarea" as const, required: true, placeholder: "Lista e parashikuesve" },
        { key: "sample_size", label: "Madhësia e mostrës (n)", type: "number" as const, required: true },
        { key: "predictors", label: "Numri i parashikuesve", type: "number" as const },
        { key: "dataset_ready", label: "A e keni setin e të dhënave?", type: "radio" as const, options: ["Po", "Jo", "Pjesërisht"], required: true },
        { key: "dataset_cleaned", label: "A janë të pastruara të dhënat?", type: "radio" as const, options: ["Po", "Jo", "Nuk e di"] },
        { key: "hypotheses_ready", label: "A i keni hipotezat të formuluara?", type: "radio" as const, options: ["Po", "Jo"] },
        { key: "regression_type", label: "Lloji i regresionit", type: "select" as const, options: ["Linear i thjeshtë", "I shumëfishtë", "Logjistik", "Hierarkik", "Nuk jam i sigurt"] },
      ],
    },
    {
      id: "it-thesis", category: "thesis",
      fields: [
        { key: "program", label: "Programi i studimeve", type: "text" as const, required: true, placeholder: "p.sh. Menaxhment, Psikologji…" },
        { key: "stage", label: "Faza aktuale e punimit", type: "select" as const, options: ["Tema e miratuar", "Mbledhja e të dhënave", "Analiza", "Shkrimi i rezultateve", "Rishikim final"], required: true },
        { key: "questions", label: "Pyetjet hulumtuese", type: "textarea" as const, required: true },
        { key: "hypotheses", label: "Hipotezat", type: "textarea" as const },
        { key: "methodology", label: "Metodologjia (dizajni, mostra, instrumentet)", type: "textarea" as const },
        { key: "sample_size", label: "Madhësia e planifikuar e mostrës", type: "number" as const },
        { key: "deadline", label: "Afati i dorëzimit", type: "text" as const, placeholder: "p.sh. fundi i qershorit" },
        { key: "dataset_ready", label: "A i keni mbledhur të dhënat?", type: "radio" as const, options: ["Po", "Jo", "Në vazhdim"], required: true },
        { key: "supervisor_feedback", label: "Keni feedback nga mentori?", type: "textarea" as const, placeholder: "Nëse po, përshkruani shkurtimisht" },
      ],
    },
    {
      id: "it-questionnaire", category: "questionnaire",
      fields: [
        { key: "constructs", label: "Konstruktet e hulumtimit", type: "textarea" as const, required: true, placeholder: "p.sh. Motivimi, Kënaqësia, Stresi" },
        { key: "population", label: "Popullata synuese", type: "text" as const, required: true, placeholder: "p.sh. punonjësit e bankave" },
        { key: "validated_scales", label: "A ka shkallë të validuara ekzistuese?", type: "radio" as const, options: ["Po", "Jo", "Pjesërisht"] },
        { key: "num_constructs", label: "Numri i konstrukteve", type: "number" as const },
        { key: "likert", label: "Shkalla Likert", type: "select" as const, options: ["5-pikëshe", "7-pikëshe", "E pa përcaktuar"] },
        { key: "languages", label: "Gjuhët e nevojshme", type: "text" as const, placeholder: "p.sh. Shqip, Anglisht" },
      ],
    },
    {
      id: "it-analysis", category: "analysis",
      fields: [
        { key: "data_format", label: "Formati i të dhënave", type: "select" as const, options: [".sav (SPSS)", ".xlsx", ".csv", ".dta", "Tjetër"] },
        { key: "variables_count", label: "Numri i variablave", type: "number" as const },
        { key: "sample_size", label: "Madhësia e mostrës", type: "number" as const, required: true },
        { key: "tests_needed", label: "Testet që mendoni se ju duhen", type: "textarea" as const, placeholder: "p.sh. Cronbach's Alpha, korelacion, regresion…" },
        { key: "cleaned", label: "A janë të pastruara të dhënat?", type: "radio" as const, options: ["Po", "Jo", "Nuk e di"] },
        { key: "deadline", label: "Afati", type: "text" as const },
      ],
    },
    {
      id: "it-consultation", category: "consultation",
      fields: [
        { key: "spss_version", label: "Versioni i SPSS", type: "select" as const, options: ["25", "26", "27", "28", "29", "Nuk e di"] },
        { key: "os", label: "Sistemi operativ", type: "radio" as const, options: ["Windows", "macOS"] },
        { key: "session_goal", label: "Çfarë doni të arrini në këtë sesion?", type: "textarea" as const, required: true },
      ],
    },
  ];

  const settings = {
    min_cancel_hours: 24,
    min_reschedule_hours: 12,
    buffer_minutes: 15,
    min_notice_hours: 4,
    booking_horizon_days: 60,
    default_commission: 20,
    tax_rate: 18,
    reminder_hours: [24, 1],
    counter_appointment: refCounter,
    counter_invoice: 7,
    platform_name: "StatLab",
  };

  const db: DB = {
    version: 3,
    users, consultants, services, consultant_services, availability, blocks,
    appointments, projects, project_consultants, analysis_tasks, files,
    payments, invoices, reviews, waitlist, applications, activity, notifications,
    consents, intake_templates, settings,
  };
  return db;

  function mkUser(id: string, email: string, full_name: string, role: User["role"], phone: string): User {
    return {
      id, email, password_hash: hashPw("demo123"), full_name, phone,
      avatar_color: ["#1b44cc", "#0e8f96", "#c98d08", "#7a3fb0", "#177a48"][Math.abs(id.length * 7) % 5],
      role, preferred_language: "sq", status: "active", created_at: iso(-90, 9), updated_at: iso(-3, 9),
    };
  }
}
