/* views_admin.jsx — login, dashboard (manage), form, calendar, user management. Exports to window. */
const { useState: useS, useMemo: useM, useEffect: useE, useRef: useR } = React;

/* ── Permission meta ─────────────────────────────────────── */
const PERM_META = {
  admin:     { label:"ผู้ดูแลระบบ",          color:"var(--red)",    bg:"var(--red-50)"    },
  organizer: { label:"ผู้กำหนดการประชุม",    color:"var(--purple)", bg:"var(--purple-50)" },
  staff:     { label:"บุคลากรทั่วไป",         color:"var(--muted)",  bg:"var(--bg-2)"      },
};
const PERM_LABEL = { admin:"ผู้ดูแลระบบ", organizer:"ผู้กำหนดการประชุม", staff:"บุคลากรทั่วไป" };

/* ===================== LOGIN ===================== */
function Login({ onLogin, onBack }) {
  const [u,    setU]    = useS("");
  const [p,    setP]    = useS("");
  const [err,  setErr]  = useS("");
  const [show, setShow] = useS(false);
  const [busy, setBusy] = useS(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!u.trim() || !p) { setErr("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"); return; }
    setBusy(true);
    setErr("");
    try {
      const res  = await fetch("api/auth.php", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "same-origin",
        body:        JSON.stringify({ username: u.trim(), password: p }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.data.user);
      } else {
        setErr(data.error ?? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setErr("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="blob" style={{ width:300, height:300, background:"#fff", top:-60, right:-40 }}></div>
        <div className="blob" style={{ width:220, height:220, background:"#ffd54f", bottom:40, left:-50 }}></div>
        <div className="row" style={{ gap:12, position:"relative" }}>
          <span style={{ width:44, height:44, borderRadius:13, background:"rgba(255,255,255,.18)",
            display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
            <IcoVideo size={24} stroke="#fff" />
          </span>
          <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:20 }}>RVCMeet</div>
        </div>
        <div style={{ position:"relative" }}>
          <h2>ระบบบริหารจัดการ<br/>การประชุมออนไลน์</h2>
          <p style={{ marginTop:14 }}>สร้างและจัดการวาระการประชุมของสถานศึกษาได้ในที่เดียว เผยแพร่สู่หน้าสาธารณะโดยอัตโนมัติ</p>
          <div className="feats">
            {[
              [IcoCalendar, "จัดวาระและกำหนดเวลาประชุมอย่างเป็นระบบ"],
              [IcoLink,     "แนบลิงก์ Meet, Zoom, Webex, Teams"],
              [IcoShield,   "ควบคุมการเปิด–ปิดลิงก์ตามเวลาจริง"],
            ].map(([Ic, t], i) => (
              <div className="feat" key={i}>
                <span className="fi"><Ic size={18} stroke="#fff" /></span>{t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize:13, opacity:.8, position:"relative" }}>ระบบประชุมออนไลน์สำหรับสถานศึกษา</div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:26, fontWeight:700, margin:"0 0 6px" }}>เข้าสู่ระบบ</h2>
          <p className="muted" style={{ margin:"0 0 24px", fontSize:14.5 }}>สำหรับเจ้าหน้าที่ผู้จัดการประชุมเท่านั้น</p>

          <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="field">
              <label>ชื่อผู้ใช้</label>
              <input className="input" value={u}
                onChange={e => { setU(e.target.value); setErr(""); }}
                placeholder="กรอกชื่อผู้ใช้" autoFocus autoComplete="username" />
            </div>
            <div className="field">
              <label>รหัสผ่าน</label>
              <div style={{ position:"relative" }}>
                <input className="input" type={show ? "text" : "password"} value={p}
                  onChange={e => { setP(e.target.value); setErr(""); }}
                  placeholder="กรอกรหัสผ่าน" style={{ paddingRight:44 }}
                  autoComplete="current-password" />
                <button type="button" className="icon-btn"
                  style={{ position:"absolute", right:4, top:3, width:36, height:36 }}
                  onClick={() => setShow(s => !s)}>
                  <IcoEye size={18} />
                </button>
              </div>
            </div>

            {err && (
              <div className="chip" style={{ background:"var(--red-50)", color:"var(--red)", alignSelf:"flex-start" }}>
                <IcoX size={14} /> {err}
              </div>
            )}

            <button className="btn btn-primary btn-lg btn-block" type="submit"
              disabled={busy} style={{ marginTop:4 }}>
              {busy
                ? "กำลังตรวจสอบ…"
                : <><span>เข้าสู่ระบบ</span> <IcoArrowR size={18} stroke="#fff" /></>}
            </button>
          </form>


          <button className="btn btn-soft btn-sm btn-block" style={{ marginTop:14 }} onClick={onBack}>
            <IcoChevL size={16} /> กลับสู่หน้าวาระการประชุม
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== DASHBOARD (manage) ===================== */
function Dashboard({ meetings, auth, onOpen, onNew, onEdit, onDelete }) {
  const now = useNow(1000);
  const [q,      setQ]      = useS("");
  const [filter, setFilter] = useS("today");

  const filtered = useM(() => {
    let list = [...meetings].sort((a, b) => new Date(a.start) - new Date(b.start));
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(m =>
        (m.title + m.organizer + m.invitees + deptById(m.dept).name).toLowerCase().includes(t)
      );
    }
    if      (filter === "today")    list = list.filter(m => isToday(new Date(m.start)));
    else if (filter === "live")     list = list.filter(m => meetingStatus(m, now) === "live");
    else if (filter === "upcoming") list = list.filter(m => meetingStatus(m, now) === "upcoming");
    else if (filter === "past")     list = list.filter(m => ["ended","expired"].includes(meetingStatus(m, now)));
    return list;
  }, [meetings, q, filter, now]);

  const counts = useM(() => ({
    all:      meetings.length,
    today:    meetings.filter(m => isToday(new Date(m.start))).length,
    live:     meetings.filter(m => meetingStatus(m, now) === "live").length,
    upcoming: meetings.filter(m => meetingStatus(m, now) === "upcoming").length,
  }), [meetings, now]);

  const tabs = [
    ["all","ทั้งหมด"],["today","วันนี้"],["live","กำลังประชุม"],
    ["upcoming","กำลังจะเริ่ม"],["past","ที่ผ่านมา"],
  ];

  return (
    <div className="page page-wide">
      <div className="page-head wrap" style={{ justifyContent:"space-between" }}>
        <div>
          <div className="h-title">จัดการการประชุม</div>
          <div className="h-sub">
            รายการประชุมทั้งหมด {counts.all} รายการ · กำลังประชุมอยู่ {counts.live} · กำลังจะเริ่ม {counts.upcoming}
          </div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={onNew}>
          <IcoPlus size={19} stroke="#fff" /> สร้างการประชุม
        </button>
      </div>

      <div className="row between wrap" style={{ marginBottom:18, gap:14 }}>
        <div className="ftabs">
          {tabs.map(([k, l]) => (
            <button key={k} className={`ftab ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="search">
          <IcoSearch />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="ค้นหาหัวข้อ ผู้จัด หรือฝ่ายงาน…" />
          {q && (
            <button className="icon-btn" style={{ width:28, height:28 }} onClick={() => setQ("")}>
              <IcoX size={15} />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={IcoSearch} title="ไม่พบการประชุม"
            text="ลองปรับคำค้นหาหรือตัวกรอง หรือสร้างการประชุมใหม่"
            action={<button className="btn btn-primary" onClick={onNew}><IcoPlus size={18} stroke="#fff" /> สร้างการประชุม</button>} />
        : (
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            {filtered.map(m => (
              <MeetingCard key={m.id} meeting={m} now={now} onOpen={onOpen}
                showDate admin onEdit={onEdit} onDelete={onDelete} auth={auth} />
            ))}
          </div>
        )}
    </div>
  );
}

/* ===================== FORM (create/edit) ===================== */
function MeetingForm({ initial, onSave, onCancel }) {
  const def = initial || {
    title:"", description:"", organizer:"", dept:"director", invitees:"",
    start: toInputLocal(roundToNext()),
    end:   toInputLocal(new Date(roundToNext().getTime() + 90 * 60000)),
    platform:"meet", link:"", location:"", attachments:[],
  };
  /* แยก dept กับ ชื่อแผนก ออกจากกัน เมื่อโหลดจาก initial */
  const initDept = initial?.dept?.startsWith("section:") ? "section" : (initial?.dept ?? "director");
  const initSect = initial?.dept?.startsWith("section:") ? initial.dept.slice(8) : "";

  const [f,    setF]    = useS({
    ...def,
    dept:  initDept,
    start: initial ? toInputLocal(new Date(initial.start)) : def.start,
    end:   initial ? toInputLocal(new Date(initial.end))   : def.end,
  });
  const [sectName, setSectName] = useS(initSect);
  const [errs, setErrs] = useS({});
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const validate = () => {
    const e = {};
    if (!f.title.trim())    e.title    = "กรุณาระบุหัวข้อการประชุม";
    if (!f.organizer.trim()) e.organizer = "กรุณาระบุผู้จัด/ประธาน";
    if (!f.link.trim())     e.link     = "กรุณาแนบลิงก์การประชุม";
    if (!f.start)           e.start    = "ระบุเวลาเริ่ม";
    if (!f.end)             e.end      = "ระบุเวลาสิ้นสุด";
    if (f.start && f.end && new Date(f.end) <= new Date(f.start))
      e.end = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const finalDept = f.dept === "section"
      ? "section:" + sectName.trim()
      : f.dept;
    onSave({
      ...f,
      dept:      finalDept,
      title:     f.title.trim(),
      organizer: f.organizer.trim(),
      start:     new Date(f.start).toISOString(),
      end:       new Date(f.end).toISOString(),
      id:        initial ? initial.id : uid(),
    });
  };

  const [uploading, setUploading] = useS(false);
  const [uploadErr, setUploadErr] = useS("");
  const fileInputRef = useR(null);

  const pickFile = () => { setUploadErr(""); fileInputRef.current?.click(); };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) { setUploadErr("ขนาดไฟล์เกิน 1 MB"); return; }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf","docx"].includes(ext)) { setUploadErr("อนุญาตเฉพาะ PDF และ DOCX"); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("api/upload.php", { method:"POST", credentials:"same-origin", body: fd });
      const data = await res.json();
      if (data.success) {
        set("attachments", [...f.attachments, {
          name: data.data.filename, size: data.data.filesize,
          stored_name: data.data.stored_name, url: data.data.url,
        }]);
      } else {
        setUploadErr(data.error || "อัพโหลดไม่สำเร็จ");
      }
    } catch { setUploadErr("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
    finally { setUploading(false); }
  };

  const rmFile = (i) => set("attachments", f.attachments.filter((_, idx) => idx !== i));

  return (
    <div className="page" style={{ maxWidth:860 }}>
      <button className="btn btn-soft btn-sm" onClick={onCancel} style={{ marginBottom:18 }}>
        <IcoChevL size={16} /> ยกเลิก
      </button>
      <div className="page-head">
        <div>
          <div className="h-title">{initial ? "แก้ไขการประชุม" : "สร้างการประชุมใหม่"}</div>
          <div className="h-sub">กำหนดรายละเอียดวาระ เวลา และลิงก์เข้าร่วมการประชุม</div>
        </div>
      </div>

      <div className="card" style={{ padding:28 }}>
        <div className="form-grid">

          <div className="field col-2">
            <label>หัวข้อการประชุม <span className="req">*</span></label>
            <input className="input" value={f.title}
              onChange={e => set("title", e.target.value)}
              placeholder="เช่น ประชุมคณะกรรมการบริหารสถานศึกษา ครั้งที่ .../..." />
            {errs.title && <span className="hint" style={{ color:"var(--red)" }}>{errs.title}</span>}
          </div>

          <div className="field col-2">
            <label>แพลตฟอร์มการประชุม <span className="req">*</span></label>
            <div className="pf-picker">
              {PLATFORMS_ORDER.map(k => {
                const pf = PLATFORMS[k];
                return (
                  <button type="button" key={k}
                    className={`pf-opt ${f.platform === k ? "sel" : ""}`}
                    onClick={() => set("platform", k)}>
                    <span className="pf-ic" style={{ background:pf.color }}>
                      <pf.Icon stroke="#fff" />
                    </span>
                    {pf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field col-2">
            <label>ลิงก์เข้าร่วมประชุม <span className="req">*</span></label>
            <input className="input" value={f.link}
              onChange={e => set("link", e.target.value)}
              placeholder="https://meet.google.com/... หรือ https://zoom.us/j/..." />
            {errs.link && <span className="hint" style={{ color:"var(--red)" }}>{errs.link}</span>}
            <span className="hint">ลิงก์จะแสดงเป็นสีเทาจนกว่าจะถึงเวลาประชุม และถูกซ่อนภายใน 1 ชั่วโมงหลังการประชุมสิ้นสุด</span>
          </div>

          <div className="field">
            <label>วันและเวลาเริ่ม <span className="req">*</span></label>
            <input className="input" type="datetime-local" value={f.start}
              onChange={e => set("start", e.target.value)} />
            {errs.start && <span className="hint" style={{ color:"var(--red)" }}>{errs.start}</span>}
          </div>
          <div className="field">
            <label>วันและเวลาสิ้นสุด <span className="req">*</span></label>
            <input className="input" type="datetime-local" value={f.end}
              onChange={e => set("end", e.target.value)} />
            {errs.end && <span className="hint" style={{ color:"var(--red)" }}>{errs.end}</span>}
          </div>

          <div className="field">
            <label>ฝ่ายงาน/หน่วยงานที่เกี่ยวข้อง</label>
            <select className="select" value={f.dept} onChange={e => { set("dept", e.target.value); if (e.target.value !== "section") setSectName(""); }}>
              {(() => {
                const groups = [];
                const seen = {};
                DEPARTMENTS.forEach(d => {
                  if (!seen[d.group]) { seen[d.group] = []; groups.push(d.group); }
                  seen[d.group].push(d);
                });
                return groups.map(g => (
                  <optgroup key={g} label={g}>
                    {seen[g].map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                ));
              })()}
            </select>
            {f.dept === "section" && (
              <input
                className="input"
                style={{ marginTop: 8 }}
                placeholder="ระบุชื่อแผนกวิชา เช่น ช่างยนต์, การบัญชี, คอมพิวเตอร์ธุรกิจ"
                value={sectName}
                autoFocus
                onChange={e => setSectName(e.target.value)}
              />
            )}
          </div>
          <div className="field">
            <label>ผู้จัด/ประธาน <span className="req">*</span></label>
            <input className="input" value={f.organizer}
              onChange={e => set("organizer", e.target.value)}
              placeholder="เช่น ผู้อำนวยการสถานศึกษา" />
            {errs.organizer && <span className="hint" style={{ color:"var(--red)" }}>{errs.organizer}</span>}
          </div>

          <div className="field col-2">
            <label>หน่วยงาน/บุคคลที่เชิญประชุม</label>
            <input className="input" value={f.invitees}
              onChange={e => set("invitees", e.target.value)}
              placeholder="เช่น รองผู้อำนวยการทุกฝ่าย, หัวหน้าแผนกวิชา" />
          </div>

          <div className="field col-2">
            <label>สถานที่/ห้องประชุม <span className="hint" style={{ fontWeight:400 }}>(กรณีประชุมแบบผสม)</span></label>
            <input className="input" value={f.location}
              onChange={e => set("location", e.target.value)}
              placeholder="เช่น ห้องประชุมเกียรติยศ อาคารอำนวยการ" />
          </div>

          <div className="field col-2">
            <label>รายละเอียด/วาระโดยสังเขป</label>
            <textarea className="textarea" value={f.description}
              onChange={e => set("description", e.target.value)}
              placeholder="ระบุวัตถุประสงค์หรือวาระสำคัญของการประชุม" />
          </div>

          <div className="field col-2">
            <label>ไฟล์วาระการประชุม <span className="hint" style={{ fontWeight:400 }}>(ไม่บังคับ)</span></label>
            {f.attachments.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
                {f.attachments.map((file, i) => (
                  <div className="file-row" key={i}>
                    <span className="f-ic"><IcoFile size={18} /></span>
                    <div className="grow">
                      <div className="f-name">{file.name}</div>
                      <div className="f-size">{file.size}</div>
                    </div>
                    <button className="icon-btn" title="ลบ" onClick={() => rmFile(i)}><IcoTrash size={18} /></button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" style={{ display:"none" }} onChange={onFileChange} />
            <button type="button" className="filedrop" onClick={pickFile} disabled={uploading} style={{ cursor:"pointer", width:"100%" }}>
              <IcoFile size={22} />
              <span style={{ marginLeft:8 }}>
                {uploading ? "กำลังอัพโหลด…" : "คลิกเพื่อแนบไฟล์วาระการประชุม (PDF, DOCX)"}
              </span>
            </button>
            {uploadErr && <span className="hint" style={{ color:"var(--red)", marginTop:6 }}>{uploadErr}</span>}
            <span className="hint" style={{ marginTop:4 }}>ขนาดไฟล์สูงสุด 1 MB ต่อไฟล์</span>
          </div>
        </div>

        <div className="row" style={{ justifyContent:"flex-end", marginTop:26, gap:10 }}>
          <button className="btn btn-soft" onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary btn-lg" onClick={submit}>
            <IcoCheck size={18} stroke="#fff" /> {initial ? "บันทึกการแก้ไข" : "บันทึกการประชุม"}
          </button>
        </div>
      </div>
    </div>
  );
}
function roundToNext() { const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return d; }

/* ===================== CALENDAR ===================== */
function Calendar({ meetings, onOpen }) {
  const now       = useNow(30000);
  const [view,      setView]      = useS("month");
  const [cursor,    setCursor]    = useS(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [weekStart, setWeekStart] = useS(() => startOfWeek(new Date()));

  const byDay = useM(() => {
    const map = {};
    meetings.forEach(m => { const k = dayKey(new Date(m.start)); (map[k] = map[k] || []).push(m); });
    Object.values(map).forEach(arr => arr.sort((a, b) => new Date(a.start) - new Date(b.start)));
    return map;
  }, [meetings]);

  if (view === "week") return <WeekView {...{ weekStart, setWeekStart, byDay, now, onOpen, view, setView }} />;

  const gridStart = startOfWeek(new Date(cursor));
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; });

  return (
    <div className="page page-wide">
      <div className="page-head wrap" style={{ justifyContent:"space-between" }}>
        <div>
          <div className="h-title">ปฏิทินการประชุม</div>
          <div className="h-sub">{TH_MON_FULL[cursor.getMonth()]} {cursor.getFullYear()+543}</div>
        </div>
        <div className="row" style={{ gap:12 }}>
          <div className="seg">
            <button className={view==="month"?"on":""} onClick={() => setView("month")}>เดือน</button>
            <button className={view==="week" ?"on":""} onClick={() => setView("week")}>สัปดาห์</button>
          </div>
          <div className="row" style={{ gap:4 }}>
            <button className="icon-btn" onClick={() => setCursor(c => addMonths(c, -1))}><IcoChevL size={20} /></button>
            <button className="btn btn-soft btn-sm"
              onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setCursor(d); }}>วันนี้</button>
            <button className="icon-btn" onClick={() => setCursor(c => addMonths(c,  1))}><IcoChevR size={20} /></button>
          </div>
        </div>
      </div>

      <div className="cal-grid">
        {["อา","จ","อ","พ","พฤ","ศ","ส"].map(d => <div className="cal-dow" key={d}>{d}</div>)}
        {cells.map((d, i) => {
          const out = d.getMonth() !== cursor.getMonth();
          const evs = byDay[dayKey(d)] || [];
          return (
            <div className={`cal-cell ${out?"out":""} ${isToday(d)?"today":""}`} key={i}>
              <span className="cdate">{d.getDate()}</span>
              {evs.slice(0, 3).map(m => {
                const st   = meetingStatus(m, now);
                const dept = deptById(m.dept);
                return (
                  <div key={m.id} className="cal-ev" onClick={() => onOpen(m)}
                    style={{ background: st==="live" ? "var(--green)" : (st==="upcoming" ? dept.color : "var(--faint)"), opacity: out ? .55 : 1 }}
                    title={m.title}>{fmtTime(new Date(m.start))} {m.title}</div>
                );
              })}
              {evs.length > 3 && <span className="cal-more">+{evs.length-3} รายการ</span>}
            </div>
          );
        })}
      </div>
      <CalLegend />
    </div>
  );
}

function WeekView({ weekStart, setWeekStart, byDay, now, onOpen, view, setView }) {
  const days = Array.from({ length:7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d; });
  const end  = days[6];
  return (
    <div className="page page-wide">
      <div className="page-head wrap" style={{ justifyContent:"space-between" }}>
        <div>
          <div className="h-title">ปฏิทินการประชุม</div>
          <div className="h-sub">{fmtDateNum(weekStart)} – {fmtDateNum(end)}</div>
        </div>
        <div className="row" style={{ gap:12 }}>
          <div className="seg">
            <button className={view==="month"?"on":""} onClick={() => setView("month")}>เดือน</button>
            <button className={view==="week" ?"on":""} onClick={() => setView("week")}>สัปดาห์</button>
          </div>
          <div className="row" style={{ gap:4 }}>
            <button className="icon-btn" onClick={() => setWeekStart(w => addDays(w, -7))}><IcoChevL size={20} /></button>
            <button className="btn btn-soft btn-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>สัปดาห์นี้</button>
            <button className="icon-btn" onClick={() => setWeekStart(w => addDays(w,  7))}><IcoChevR size={20} /></button>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:12 }}>
        {days.map((d, i) => {
          const evs = byDay[dayKey(d)] || [];
          return (
            <div key={i} className="card" style={{ padding:0, minHeight:220, display:"flex",
              flexDirection:"column", borderColor: isToday(d) ? "var(--blue)" : "var(--line)" }}>
              <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--line)", textAlign:"center",
                background: isToday(d) ? "var(--blue-50)" : "transparent", borderRadius:"16px 16px 0 0" }}>
                <div style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>{TH_DOW_S[d.getDay()]}</div>
                <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:18,
                  color: isToday(d) ? "var(--blue)" : "var(--ink)" }}>{d.getDate()}</div>
              </div>
              <div style={{ padding:8, display:"flex", flexDirection:"column", gap:6, flex:1 }}>
                {evs.length === 0 && (
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
                    color:"var(--faint)", fontSize:12 }}>—</div>
                )}
                {evs.map(m => {
                  const st = meetingStatus(m, now); const dept = deptById(m.dept);
                  return (
                    <button key={m.id} onClick={() => onOpen(m)}
                      style={{ textAlign:"left", border:"none", background:"var(--bg)",
                        borderLeft:`3px solid ${st==="live"?"var(--green)":dept.color}`,
                        borderRadius:8, padding:"7px 9px", cursor:"pointer" }}>
                      <div style={{ fontSize:11.5, color:"var(--muted)", fontWeight:600 }}>{fmtTime(new Date(m.start))} น.</div>
                      <div style={{ fontSize:12.5, fontWeight:600, lineHeight:1.3, marginTop:2,
                        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                        {m.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <CalLegend />
    </div>
  );
}

function CalLegend() {
  return (
    <div className="row wrap" style={{ gap:18, marginTop:18, fontSize:13 }}>
      <span className="row" style={{ gap:7 }}><span className="dot dot-live"></span> กำลังประชุม</span>
      {DEPARTMENTS.map(d => (
        <span className="row" key={d.id} style={{ gap:7 }}>
          <span className="dot" style={{ background:d.color }}></span>{d.name}
        </span>
      ))}
    </div>
  );
}

function startOfWeek(d)  { const x = new Date(d); x.setDate(x.getDate()-x.getDay()); x.setHours(0,0,0,0); return x; }
function addDays(d, n)   { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth()+n); return x; }

/* ===================== USER MANAGEMENT ===================== */
function UserManagement({ currentUser }) {
  const [users,      setUsers]      = useS([]);
  const [loading,    setLoading]    = useS(true);
  const [modal,      setModal]      = useS(null);   // null | {mode:'create'} | {mode:'edit',user:{}}
  const [delUser,    setDelUser]    = useS(null);
  const [toast,      setToast]      = useS("");
  const [q,          setQ]          = useS("");
  const [rmsStatus,  setRmsStatus]  = useS(null);
  const [rmsSyncing, setRmsSyncing] = useS(false);
  const [rmsError,   setRmsError]   = useS("");

  const reloadUsers = () =>
    fetch("api/users.php", { credentials:"same-origin" })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data); });

  useE(() => {
    fetch("api/users.php", { credentials:"same-origin" })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data); })
      .finally(() => setLoading(false));

    /* โหลดสถานะ RMS sync ล่าสุด */
    fetch("api/rms_sync.php", { credentials:"same-origin" })
      .then(r => r.json())
      .then(d => { if (d.success) setRmsStatus(d.data); })
      .catch(() => {});
  }, []);

  /* Auto-sync ทุกชั่วโมง */
  useE(() => {
    const check = () => {
      if (!rmsStatus) return;
      const lastMs  = rmsStatus.last_synced_at ? new Date(rmsStatus.last_synced_at + 'Z').getTime() : 0;
      const interval = (rmsStatus.interval_sec ?? 3600) * 1000;
      if (Date.now() - lastMs >= interval) {
        doRmsSync(false);
      }
    };
    const t = setInterval(check, 60 * 1000); // ตรวจทุกนาที
    return () => clearInterval(t);
  }, [rmsStatus]);

  const doRmsSync = async (force = true) => {
    setRmsSyncing(true);
    setRmsError("");
    try {
      const res  = await fetch("api/rms_sync.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        setRmsStatus(prev => ({ ...prev, ...data.data, last_synced_at: data.data.synced_at ?? prev?.last_synced_at }));
        if (data.data.synced) {
          const { added, updated, deleted } = data.data;
          setToast(`โอนข้อมูล RMS สำเร็จ: เพิ่ม ${added} อัพเดต ${updated} ลบ ${deleted}`);
          await reloadUsers();
        } else {
          setToast("RMS: " + (data.data.reason ?? "ไม่มีการเปลี่ยนแปลง"));
        }
      } else {
        setRmsError(data.error ?? "เกิดข้อผิดพลาด");
      }
    } catch (e) {
      setRmsError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setRmsSyncing(false);
    }
  };

  const filtered = users.filter(u =>
    q === "" || (u.name + u.username + u.role + PERM_LABEL[u.permission])
      .toLowerCase().includes(q.toLowerCase())
  );

  const saveUser = async (payload, userId) => {
    const isEdit = !!userId;
    const res  = await fetch(
      isEdit ? `api/users.php?id=${userId}` : "api/users.php",
      { method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type":"application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload) }
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
    setUsers(prev =>
      isEdit ? prev.map(u => u.id === userId ? data.data : u) : [...prev, data.data]
    );
    setModal(null);
    setToast(isEdit ? "แก้ไขข้อมูลผู้ใช้แล้ว" : "เพิ่มผู้ใช้ใหม่แล้ว");
  };

  const confirmDelete = async () => {
    const target = delUser;
    setDelUser(null);
    const res  = await fetch(`api/users.php?id=${target.id}`, {
      method: "DELETE", credentials: "same-origin"
    });
    const data = await res.json();
    if (data.success) {
      setUsers(prev => prev.filter(u => u.id !== target.id));
      setToast("ลบผู้ใช้แล้ว");
    } else {
      setToast("เกิดข้อผิดพลาด: " + (data.error ?? ""));
    }
  };

  return (
    <div className="page page-wide">
      {/* Header */}
      <div className="page-head wrap" style={{ justifyContent:"space-between" }}>
        <div>
          <div className="h-title">จัดการผู้ใช้</div>
          <div className="h-sub">บัญชีผู้ใช้ทั้งหมด {users.length} บัญชี</div>
        </div>
        <div className="row" style={{ gap:10, flexWrap:"wrap" }}>
          <button className="btn btn-soft" onClick={() => doRmsSync(true)} disabled={rmsSyncing}
            title="ดึงข้อมูลบุคลากรจากระบบ RMS และโอนเข้าระบบ">
            <IcoUsers size={17} stroke={rmsSyncing ? "var(--muted)" : undefined} />
            {rmsSyncing ? "กำลังโอนข้อมูล…" : "โอนข้อมูลผู้ใช้จากระบบ RMS"}
          </button>
          <button className="btn btn-primary btn-lg"
            onClick={() => setModal({ mode:"create" })}>
            <IcoPlus size={19} stroke="#fff" /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {/* RMS sync status */}
      {(rmsStatus?.last_synced_at || rmsError) && (
        <div className="card" style={{ padding:"10px 16px", marginBottom:16, fontSize:13, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          {rmsError
            ? <><IcoX size={14} stroke="var(--red)" /><span style={{ color:"var(--red)" }}>{rmsError}</span></>
            : <>
                <IcoCheckCircle size={14} stroke="var(--green)" />
                <span className="muted">อัพเดตล่าสุด:</span>
                <span>{rmsStatus.last_synced_at ? fmtDateTime(rmsStatus.last_synced_at) : "—"}</span>
                <span className="muted" style={{ marginLeft:8 }}>
                  เพิ่ม {rmsStatus.added ?? 0} · อัพเดต {rmsStatus.updated ?? 0} · ลบ {rmsStatus.deleted ?? 0}
                </span>
              </>
          }
        </div>
      )}

      {/* Role legend */}
      <div className="row wrap" style={{ gap:10, marginBottom:20 }}>
        {Object.entries(PERM_META).map(([k, v]) => (
          <span key={k} className="chip" style={{ background:v.bg, color:v.color }}>
            {v.label}
            <span style={{ fontWeight:400, opacity:.75, marginLeft:4, fontSize:11.5 }}>
              {k==="admin"?"จัดการผู้ใช้+ประชุม":k==="organizer"?"จัดการประชุม":"เข้าร่วมเท่านั้น"}
            </span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom:16 }}>
        <div className="search" style={{ maxWidth:340 }}>
          <IcoSearch />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ ชื่อผู้ใช้ หรือตำแหน่ง…" />
          {q && <button className="icon-btn" style={{ width:28, height:28 }} onClick={() => setQ("")}><IcoX size={15} /></button>}
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="empty"><div>กำลังโหลด…</div></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={IcoUsers} title="ไม่พบผู้ใช้" text="ลองปรับคำค้นหา หรือเพิ่มผู้ใช้ใหม่" />
      ) : (
        <div className="card" style={{ overflow:"hidden" }}>
          {filtered.map((u, i) => {
            const pm    = PERM_META[u.permission] || PERM_META.staff;
            const isSelf = u.id === currentUser.id;
            return (
              <div key={u.id} style={{
                display:"flex", alignItems:"center", gap:14,
                padding:"14px 20px",
                borderBottom: i < filtered.length-1 ? "1px solid var(--line)" : "none",
              }}>
                <Avatar name={u.name} />
                <div className="grow">
                  <div style={{ fontWeight:600, fontSize:15.5 }}>
                    {u.name}
                    {isSelf && <span style={{ fontSize:11.5, color:"var(--muted)", marginLeft:8 }}>(คุณ)</span>}
                  </div>
                  <div style={{ fontSize:13, color:"var(--muted)", marginTop:2 }}>
                    @{u.username}{u.role ? ` · ${u.role}` : ""}
                  </div>
                </div>
                <span className="chip" style={{ background:pm.bg, color:pm.color }}>
                  {pm.label}
                </span>
                <button className="icon-btn" title="แก้ไข"
                  onClick={() => setModal({ mode:"edit", user:u })}>
                  <IcoEdit size={18} />
                </button>
                <button className="icon-btn" title={isSelf ? "ไม่สามารถลบตัวเองได้" : "ลบ"}
                  style={{ opacity: isSelf ? .3 : 1, cursor: isSelf ? "not-allowed":"pointer" }}
                  onClick={() => !isSelf && setDelUser(u)}>
                  <IcoTrash size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <UserModal
          mode={modal.mode} user={modal.user}
          currentUser={currentUser}
          onSave={saveUser}
          onClose={() => setModal(null)}
        />
      )}

      {delUser && (
        <ConfirmModal
          title="ยืนยันการลบผู้ใช้"
          body={`ต้องการลบบัญชี "${delUser.name}" (@${delUser.username}) ออกจากระบบหรือไม่?`}
          confirmLabel="ลบผู้ใช้" danger
          onConfirm={confirmDelete}
          onCancel={() => setDelUser(null)}
        />
      )}

      <Toast msg={toast} onDone={() => setToast("")} />
    </div>
  );
}

/* ── User create/edit modal ─────────────────────────────── */
function UserModal({ mode, user, currentUser, onSave, onClose }) {
  const isEdit = mode === "edit";
  const isSelf = isEdit && user?.id === currentUser.id;

  const [f,    setF]    = useS({
    name:       user?.name       ?? "",
    username:   user?.username   ?? "",
    password:   "",
    role:       user?.role       ?? "",
    permission: user?.permission ?? "staff",
  });
  const [err,  setErr]  = useS("");
  const [busy, setBusy] = useS(false);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!f.name.trim())                  { setErr("กรุณาระบุชื่อแสดง"); return; }
    if (!isEdit && !f.username.trim())   { setErr("กรุณาระบุชื่อผู้ใช้"); return; }
    if (!isEdit && !f.password)          { setErr("กรุณาระบุรหัสผ่าน"); return; }
    setBusy(true); setErr("");
    try {
      const payload = {
        name:       f.name.trim(),
        username:   f.username.trim(),
        role:       f.role.trim(),
        permission: f.permission,
        ...(f.password ? { password: f.password } : {}),
      };
      await onSave(payload, isEdit ? user.id : null);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:"0 0 20px", fontSize:21 }}>
          {isEdit ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
        </h3>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="field">
            <label>ชื่อแสดง <span className="req">*</span></label>
            <input className="input" value={f.name}
              onChange={e => set("name", e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>

          <div className="field">
            <label>ชื่อผู้ใช้ (Username) {!isEdit && <span className="req">*</span>}</label>
            <input className="input" value={f.username} disabled={isEdit}
              onChange={e => set("username", e.target.value)}
              placeholder="ชื่อผู้ใช้สำหรับ login" autoComplete="off" />
            {isEdit && <span className="hint">ไม่สามารถเปลี่ยนชื่อผู้ใช้ได้</span>}
          </div>

          <div className="field">
            <label>
              {isEdit ? "รหัสผ่านใหม่" : <>รหัสผ่าน <span className="req">*</span></>}
            </label>
            <input className="input" type="password" value={f.password}
              onChange={e => set("password", e.target.value)}
              placeholder={isEdit ? "เว้นว่างถ้าไม่ต้องการเปลี่ยน" : "รหัสผ่าน"}
              autoComplete="new-password" />
          </div>

          <div className="field">
            <label>ตำแหน่ง / ฝ่ายงาน</label>
            <input className="input" value={f.role}
              onChange={e => set("role", e.target.value)}
              placeholder="เช่น หัวหน้างานสารสนเทศ" />
          </div>

          <div className="field">
            <label>ประเภทผู้ใช้ <span className="req">*</span></label>
            <select className="select" value={f.permission} disabled={isSelf}
              onChange={e => set("permission", e.target.value)}>
              {Object.entries(PERM_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {isSelf
              ? <span className="hint">ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้</span>
              : <span className="hint">
                  ผู้ดูแลระบบ: ทุกสิทธิ์ · ผู้กำหนดการประชุม: จัดการประชุม · บุคลากรทั่วไป: เข้าร่วมเท่านั้น
                </span>
            }
          </div>

          {err && (
            <div className="chip" style={{ background:"var(--red-50)", color:"var(--red)", alignSelf:"flex-start" }}>
              <IcoX size={14} /> {err}
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent:"flex-end", marginTop:22, gap:10 }}>
          <button className="btn btn-soft" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "กำลังบันทึก…" : (isEdit ? "บันทึกการแก้ไข" : <><IcoPlus size={17} stroke="#fff" /> สร้างผู้ใช้</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Login, Dashboard, MeetingForm, Calendar, UserManagement, PERM_LABEL });
