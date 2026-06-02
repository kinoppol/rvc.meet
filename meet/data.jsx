/* data.jsx — time helpers, status logic, department data.
   Data persistence is handled by the PHP API (api/meetings.php, api/auth.php).
   No localStorage is used in this version. */

/* ── Departments ─────────────────────────────────────────── */
const DEPARTMENTS = [
  /* ── ผู้บริหาร ── */
  { id: "director",   name: "ผู้อำนวยการ",                              color: "#1a73e8", group: "ผู้บริหาร" },

  /* ── ฝ่ายวิชาการ ── */
  { id: "academic",   name: "ฝ่ายวิชาการ",                              color: "#1e8e3e", group: "ฝ่ายวิชาการ" },
  { id: "curriculum", name: "งานพัฒนาหลักสูตรการเรียนการสอน",           color: "#2da050", group: "ฝ่ายวิชาการ" },
  { id: "evaluation", name: "งานวัดผลและประเมินผล",                     color: "#2da050", group: "ฝ่ายวิชาการ" },
  { id: "library",    name: "งานวิทยบริการและห้องสมุด",                  color: "#2da050", group: "ฝ่ายวิชาการ" },
  { id: "dual",       name: "งานอาชีวศึกษาระบบทวิภาคี",                 color: "#2da050", group: "ฝ่ายวิชาการ" },
  { id: "media",      name: "งานสื่อการเรียนการสอน",                     color: "#2da050", group: "ฝ่ายวิชาการ" },
  { id: "registry",   name: "งานทะเบียน",                               color: "#2da050", group: "ฝ่ายวิชาการ" },

  /* ── ฝ่ายแผนงานและความร่วมมือ ── */
  { id: "planning",   name: "ฝ่ายแผนงานและความร่วมมือ",                 color: "#6c5ce7", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "budget",     name: "งานวางแผนและงบประมาณ",                     color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "it",         name: "งานศูนย์ข้อมูลสารสนเทศ",                   color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "cooperation",name: "งานความร่วมมือ",                           color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "research",   name: "งานวิจัย พัฒนา นวัตกรรมและสิ่งประดิษฐ์",   color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "qa",         name: "งานประกันคุณภาพและมาตรฐานการศึกษา",        color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "commerce",   name: "งานส่งเสริมผลิตผล การค้า และการประกอบธุรกิจ", color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },
  { id: "incubator",  name: "งานศูนย์บ่มเพาะวิสาหกิจเพื่อการศึกษา",    color: "#8a7cf0", group: "ฝ่ายแผนงานและความร่วมมือ" },

  /* ── ฝ่ายบริหารทรัพยากร ── */
  { id: "resource",   name: "ฝ่ายบริหารทรัพยากร",                       color: "#f9ab00", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "general",    name: "งานบริหารงานทั่วไป",                        color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "hr",         name: "งานบุคลากร",                               color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "finance",    name: "งานการเงิน",                               color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "accounting", name: "งานการบัญชี",                              color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "procurement",name: "งานพัสดุ",                                 color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "facilities", name: "งานอาคารสถานที่",                           color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },
  { id: "pr",         name: "งานประชาสัมพันธ์",                         color: "#e0960a", group: "ฝ่ายบริหารทรัพยากร" },

  /* ── ฝ่ายพัฒนากิจการนักเรียน นักศึกษา ── */
  { id: "student",    name: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา",         color: "#e91e8c", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
  { id: "discipline", name: "งานปกครอง",                                color: "#c4177a", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
  { id: "activities", name: "งานกิจกรรมนักเรียน นักศึกษา",              color: "#c4177a", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
  { id: "advisor",    name: "งานครูที่ปรึกษา",                          color: "#c4177a", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
  { id: "guidance",   name: "งานแนะแนวอาชีพและการจัดหางาน",             color: "#c4177a", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
  { id: "welfare",    name: "งานสวัสดิการนักเรียน นักศึกษา",            color: "#c4177a", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
  { id: "community",  name: "งานโครงการพิเศษและบริการชุมชน",            color: "#c4177a", group: "ฝ่ายพัฒนากิจการนักเรียน นักศึกษา" },
];
const deptById = (id) => DEPARTMENTS.find(d => d.id === id) || DEPARTMENTS[0];

/* ── Time helpers ────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, "0");
const TH_DOW      = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
const TH_DOW_S    = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const TH_MON      = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const TH_MON_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                     "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const fmtTime      = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDateTime  = (isoStr) => { const d = new Date(isoStr.replace(' ', 'T') + (isoStr.includes('Z') ? '' : 'Z')); return `${fmtDateShort(d)} ${fmtTime(d)} น.`; };
const fmtDateShort = (d) => `${TH_DOW_S[d.getDay()]} ${d.getDate()} ${TH_MON[d.getMonth()]}`;
const fmtDateLong  = (d) => `วัน${TH_DOW[d.getDay()]}ที่ ${d.getDate()} ${TH_MON_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
const fmtDateNum   = (d) => `${d.getDate()} ${TH_MON[d.getMonth()]} ${(d.getFullYear()+543)%100}`;
const sameDay = (a, b) =>
  a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const isToday      = (d) => sameDay(d, new Date());
const dayKey       = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toInputLocal = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const durationMin  = (s, e) => Math.max(0, Math.round((e - s) / 60000));
const fmtDuration  = (s, e) => {
  const m = durationMin(s, e), h = Math.floor(m/60), mm = m%60;
  return h ? (mm ? `${h} ชม. ${mm} นาที` : `${h} ชม.`) : `${mm} นาที`;
};

/* ── Meeting status logic ────────────────────────────────── */
const ONE_HOUR = 3600 * 1000;
function meetingStatus(m, now = new Date()) {
  const s = new Date(m.start), e = new Date(m.end);
  if (now < s)                                     return "upcoming";
  if (now <= e)                                    return "live";
  if (now <= new Date(e.getTime() + ONE_HOUR))     return "ended";
  return "expired";
}
function countdownTo(target, now = new Date()) {
  let ms = Math.max(0, new Date(target) - now);
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const mn = Math.floor(ms / 60000);  ms -= mn * 60000;
  const sc = Math.floor(ms / 1000);
  return { h, m: mn, s: sc, text: (h ? `${pad(h)}:` : "") + `${pad(mn)}:${pad(sc)}` };
}

/* ── Client-side uid for new meetings (server accepts as-is) */
const uid = () => "m" + Math.random().toString(36).slice(2, 9);

/* ── Export to window (used by all JSX modules) ─────────── */
Object.assign(window, {
  DEPARTMENTS, deptById,
  PLATFORMS_ORDER: ["meet","zoom","webex","teams","other"],
  fmtTime, fmtDateTime, fmtDateShort, fmtDateLong, fmtDateNum,
  sameDay, isToday, dayKey, toInputLocal, durationMin, fmtDuration,
  TH_DOW_S, TH_MON, TH_MON_FULL, TH_DOW,
  meetingStatus, countdownTo, uid,
});
