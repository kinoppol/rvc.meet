/* views_public.jsx — public agenda + meeting detail. Exports to window. */
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

const PRESENCE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in ms
const HEARTBEAT_MS     = 30 * 1000;     // ping every 30 s
const POLL_MS          = 30 * 1000;     // refresh attendance list every 30 s

/* ============ PUBLIC: today's agenda (no login required) ============ */
function PublicAgenda({ meetings, auth, onOpen, onGoLogin }) {
  const now = useNow(1000);
  const today = meetings
    .filter(m => isToday(new Date(m.start)))
    .filter(m => meetingStatus(m, now) !== "expired")
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const live     = today.filter(m => meetingStatus(m, now) === "live");
  const upcoming = today.filter(m => meetingStatus(m, now) === "upcoming");
  const ended    = today.filter(m => meetingStatus(m, now) === "ended");
  const td = new Date();

  const card = (m) => (
    <MeetingCard key={m.id} meeting={m} now={now} onOpen={onOpen}
      auth={auth} onLoginRequired={onGoLogin} />
  );

  return (
    <div>
      <div className="hero">
        <div className="hero-inner">
          <span className="eyebrow"><IcoSparkle size={15} /> เข้าถึงได้โดยไม่ต้องเข้าสู่ระบบ</span>
          <h1>วาระการประชุมวันนี้</h1>
          <div className="sub">{fmtDateLong(td)}</div>
          <div className="stats">
            <div className="stat"><span className="n blue">{today.length}</span><span className="l">การประชุมวันนี้</span></div>
            <div className="stat"><span className="n green">{live.length}</span><span className="l">กำลังประชุมอยู่</span></div>
            <div className="stat"><span className="n amber">{upcoming.length}</span><span className="l">กำลังจะเริ่ม</span></div>
          </div>
        </div>
      </div>

      <div className="page">
        {today.length === 0 && (
          <EmptyState icon={IcoCalendar} title="ยังไม่มีการประชุมในวันนี้"
            text="เมื่อมีการกำหนดวาระการประชุมประจำวัน รายการจะปรากฏที่นี่โดยอัตโนมัติ" />
        )}
        {live.length > 0 && (
          <>
            <div className="day-rail">
              <span className="dot dot-live"></span>
              <span className="lbl" style={{ color:"var(--green)" }}>กำลังประชุมอยู่ในขณะนี้</span>
              <span className="ln"></span><span className="cnt">{live.length} รายการ</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>{live.map(card)}</div>
          </>
        )}
        {upcoming.length > 0 && (
          <>
            <div className="day-rail">
              <span className="lbl">กำลังจะเริ่ม</span>
              <span className="ln"></span><span className="cnt">{upcoming.length} รายการ</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>{upcoming.map(card)}</div>
          </>
        )}
        {ended.length > 0 && (
          <>
            <div className="day-rail">
              <span className="lbl" style={{ color:"var(--muted)" }}>สิ้นสุดแล้ว</span>
              <span className="ln"></span><span className="cnt">{ended.length} รายการ</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14, opacity:.82 }}>{ended.map(card)}</div>
          </>
        )}
        {!auth && (
          <div className="card" style={{ marginTop:34, padding:"20px 24px", display:"flex",
            alignItems:"center", gap:16, flexWrap:"wrap",
            background:"var(--blue-50)", borderColor:"var(--blue-100)" }}>
            <span style={{ width:42, height:42, borderRadius:12, background:"var(--blue)",
              display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <IcoShield size={22} stroke="#fff" />
            </span>
            <div className="grow">
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:16 }}>เป็นเจ้าหน้าที่ผู้จัดการประชุม?</div>
              <div className="muted" style={{ fontSize:14 }}>เข้าสู่ระบบเพื่อสร้าง แก้ไข และจัดการวาระการประชุมทั้งหมด</div>
            </div>
            <button className="btn btn-primary" onClick={onGoLogin}><IcoLock size={17} stroke="#fff" /> เข้าสู่ระบบ</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Helper: presence status from last_seen_at ============ */
function presenceOf(r, nowMs) {
  if (r.added_by || !r.user_id || !r.last_seen_at) return null;
  /* PHP returns "YYYY-MM-DD HH:MM:SS" without timezone — must parse as UTC */
  const ts  = new Date(r.last_seen_at.replace(' ', 'T') + 'Z');
  const age = nowMs - ts.getTime();
  return age < PRESENCE_TIMEOUT ? "online" : "away";
}

/* ============ Admin: Add attendee / absent modal ============ */
function AddAttendeeModal({ meeting, defaultAbsent = false, defaultLocation = "", onDone, onCancel }) {
  const [name,        setName]        = useStateP("");
  const [mode,        setMode]        = useStateP(defaultAbsent ? "absent" : "attend");
  const [location,    setLocation]    = useStateP(defaultLocation);
  const [notes,       setNotes]       = useStateP("");
  const [saving,      setSaving]      = useStateP(false);
  const [error,       setError]       = useStateP("");
  const [suggestions, setSuggestions] = useStateP([]);

  useEffectP(() => {
    fetch(`api/suggestions.php?meeting_id=${encodeURIComponent(meeting.id)}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => { if (d.success) setSuggestions(d.data); })
      .catch(() => {});
  }, [meeting.id]);

  const submit = async () => {
    if (!name.trim())     { setError("กรุณาระบุชื่อ"); return; }
    if (!location.trim()) { setError(mode === "attend" ? "กรุณาระบุสถานที่เข้าประชุม" : "กรุณาระบุสาเหตุ"); return; }
    setSaving(true);
    try {
      const res  = await fetch("api/attendance.php", {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
        body: JSON.stringify({ meeting_id:meeting.id, is_manual:true, name:name.trim(),
          location:location.trim(), is_absent:mode==="absent", notes:notes.trim() }),
      });
      const data = await res.json();
      if (data.success) onDone(data.data); else setError(data.error || "เกิดข้อผิดพลาด");
    } catch { setError("ไม่สามารถเชื่อมต่อได้"); }
    finally  { setSaving(false); }
  };

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
        <h3 style={{ margin:"0 0 4px", fontSize:20 }}>
          {defaultAbsent ? "ระบุผู้ขาดการประชุม" : "เพิ่มผู้เข้าร่วมประชุม"}
        </h3>
        <div className="muted" style={{ fontSize:13.5, marginBottom:20 }}>{meeting.title}</div>

        <div className="field">
          <label>ชื่อ-สกุล <span className="req">*</span></label>
          <input className="input" list="add-att-names"
            placeholder="ชื่อผู้เข้าร่วม / ผู้ขาดประชุม"
            value={name} autoFocus onChange={e => { setName(e.target.value); setError(""); }} />
          <datalist id="add-att-names">
            {suggestions.map((s, i) => <option key={i} value={s} />)}
          </datalist>
          {suggestions.length > 0 && (
            <span className="hint">พิมพ์เพื่อค้นหาจาก {suggestions.length} รายชื่อ</span>
          )}
        </div>

        {!defaultAbsent && (
          <div className="field" style={{ marginTop:16 }}>
            <label>สถานะการเข้าร่วม</label>
            <div className="row" style={{ gap:10, marginTop:8 }}>
              <button type="button" className={`btn btn-sm ${mode==="attend"?"btn-success":"btn-soft"}`} style={{ flex:1 }}
                onClick={() => { setMode("attend"); setLocation(""); setError(""); }}>
                <IcoUserCheck size={15} stroke={mode==="attend"?"#fff":"currentColor"} /> เข้าประชุม
              </button>
              <button type="button" className={`btn btn-sm ${mode==="absent"?"btn-danger":"btn-soft"}`} style={{ flex:1 }}
                onClick={() => { setMode("absent"); setLocation(""); setError(""); }}>
                <IcoX size={15} stroke="currentColor" /> ขาดประชุม
              </button>
            </div>
          </div>
        )}

        <div className="field" style={{ marginTop:16 }}>
          <label>
            {mode==="attend" ? "สถานที่เข้าประชุม" : "สาเหตุที่ขาดประชุม"}
            <span className="req"> *</span>
          </label>
          <input className="input"
            placeholder={mode==="attend" ? "เช่น ห้องประชุมใหญ่ อาคาร A, ทางไกล" : "เช่น ติดภารกิจ, ลาป่วย"}
            value={location} onChange={e => { setLocation(e.target.value); setError(""); }} />
        </div>

        <div className="field" style={{ marginTop:14 }}>
          <label>หมายเหตุ <span className="muted" style={{ fontWeight:400 }}>(ถ้ามี)</span></label>
          <input className="input" placeholder="รายละเอียดเพิ่มเติม..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <div style={{ color:"var(--red)", fontSize:13.5, marginTop:10 }}><IcoX size={14} stroke="var(--red)" /> {error}</div>}
        <div className="row" style={{ justifyContent:"flex-end", marginTop:22, gap:10 }}>
          <button className="btn btn-soft" onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "กำลังบันทึก…" : <><IcoCheck size={16} stroke="#fff" /> บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Print attendance report ============ */
function printAttendanceReport(meeting, records) {
  const THAI_DIG = '๐๑๒๓๔๕๖๗๘๙';
  const toThai   = (n) => String(n).replace(/\d/g, d => THAI_DIG[+d]);
  const esc      = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const s   = new Date(meeting.start);
  const DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const MON = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
               'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const dateTh = `วัน${DOW[s.getDay()]}ที่ ${toThai(s.getDate())} ${MON[s.getMonth()]} ${toThai(s.getFullYear()+543)}`;
  const timeTh = `${toThai(String(s.getHours()).padStart(2,'0'))}.${toThai(String(s.getMinutes()).padStart(2,'0'))} น.`;

  const attended = records.filter(r => !r.is_absent);
  const absent   = records.filter(r =>  r.is_absent);

  const makeRows = (list) => list.map((r, i) => `
    <tr>
      <td class="cn">${toThai(i+1)}.</td>
      <td class="cname">${esc(r.name)}</td>
      <td class="cloc">${esc(r.location || '')}</td>
      <td class="cnote">${esc(r.notes || '')}</td>
    </tr>`).join('');

  const section = (title, list) => list.length === 0 ? '' : `
    <p class="sec-title">${title}</p>
    <table><tbody>${makeRows(list)}</tbody></table>`;

  const html = `<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8">
<title>รายงานการประชุม — ${esc(meeting.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'TH Sarabun New','Sarabun','Angsana New',serif;font-size:16pt;color:#000;background:#fff}
.page{width:21cm;min-height:29.7cm;margin:0 auto;padding:2.5cm 2.5cm 2cm}
.hd{text-align:center;line-height:1.75;margin-bottom:18pt}
.hd h1{font-size:18pt;font-weight:bold}
.hd p{font-size:16pt}
hr{border:none;border-top:1px dotted #000;margin:14pt 0}
.sec-title{font-size:16pt;font-weight:bold;margin:14pt 0 4pt}
table{width:100%;border-collapse:collapse}
td{font-size:16pt;padding:1pt 6pt 1pt 0;vertical-align:top;line-height:1.6}
.cn{width:2.8em;text-align:right;padding-right:10pt;white-space:nowrap}
.cname{width:32%}
.cloc{width:38%}
.cnote{}
.footer{margin-top:16pt;font-size:16pt}
@media print{
  @page{size:A4;margin:2cm 2.5cm}
  .page{padding:0;width:100%}
}
</style></head>
<body><div class="page">
  <div class="hd">
    <h1>รายงานการประชุม${meeting.title ? '<br>'+esc(meeting.title) : ''}</h1>
    <p>${dateTh} เวลา ${timeTh}</p>
    ${meeting.location ? `<p>ณ ${esc(meeting.location)}</p>` : ''}
  </div>
  <hr>
  ${section('ผู้มาประชุม', attended)}
  ${section('ผู้ไม่มาประชุม', absent)}
  <p class="footer">เริ่มประชุมเวลา ${timeTh}</p>
</div>
<script>document.fonts.ready.then(()=>window.print())</script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=720');
  if (win) { win.document.write(html); win.document.close(); }
}

/* ============ Admin: Edit manual attendance record ============ */
function EditAttendeeModal({ record, onDone, onCancel }) {
  const [name,        setName]        = useStateP(record.name);
  const [mode,        setMode]        = useStateP(record.is_absent ? "absent" : "attend");
  const [location,    setLocation]    = useStateP(record.location);
  const [notes,       setNotes]       = useStateP(record.notes || "");
  const [saving,      setSaving]      = useStateP(false);
  const [error,       setError]       = useStateP("");
  const [suggestions, setSuggestions] = useStateP([]);

  useEffectP(() => {
    const url = `api/suggestions.php?meeting_id=${encodeURIComponent(record.meeting_id)}&exclude_id=${record.id}`;
    fetch(url, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => { if (d.success) setSuggestions(d.data); })
      .catch(() => {});
  }, [record.id]);

  const submit = async () => {
    if (!name.trim())     { setError("กรุณาระบุชื่อ"); return; }
    if (!location.trim()) { setError(mode === "attend" ? "กรุณาระบุสถานที่เข้าประชุม" : "กรุณาระบุสาเหตุ"); return; }
    setSaving(true);
    try {
      const res  = await fetch(`api/attendance.php?id=${record.id}`, {
        method:"PUT", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
        body: JSON.stringify({ name:name.trim(), location:location.trim(),
          is_absent:mode==="absent", notes:notes.trim() }),
      });
      const data = await res.json();
      if (data.success) onDone(data.data); else setError(data.error || "เกิดข้อผิดพลาด");
    } catch { setError("ไม่สามารถเชื่อมต่อได้"); }
    finally  { setSaving(false); }
  };

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
        <h3 style={{ margin:"0 0 18px", fontSize:20 }}>แก้ไขข้อมูลผู้เข้าร่วม</h3>

        <div className="field">
          <label>ชื่อ-สกุล <span className="req">*</span></label>
          <input className="input" list="edit-att-names" value={name} autoFocus
            onChange={e => { setName(e.target.value); setError(""); }} />
          <datalist id="edit-att-names">
            {suggestions.map((s, i) => <option key={i} value={s} />)}
          </datalist>
        </div>

        <div className="field" style={{ marginTop:16 }}>
          <label>สถานะการเข้าร่วม</label>
          <div className="row" style={{ gap:10, marginTop:8 }}>
            <button type="button" className={`btn ${mode==="attend"?"btn-primary":"btn-soft"}`} style={{ flex:1 }}
              onClick={() => { setMode("attend"); setError(""); }}>
              <IcoUserCheck size={16} stroke="currentColor" /> เข้าประชุม
            </button>
            <button type="button" className={`btn ${mode==="absent"?"btn-danger":"btn-soft"}`} style={{ flex:1 }}
              onClick={() => { setMode("absent"); setError(""); }}>
              <IcoX size={16} stroke="currentColor" /> ขาดประชุม
            </button>
          </div>
        </div>

        <div className="field" style={{ marginTop:16 }}>
          <label>
            {mode==="attend" ? "สถานที่เข้าประชุม" : "สาเหตุที่ขาดประชุม"}
            <span className="req"> *</span>
          </label>
          <input className="input"
            placeholder={mode==="attend" ? "เช่น ห้องประชุมใหญ่ อาคาร A" : "เช่น ติดภารกิจ, ลาป่วย"}
            value={location} onChange={e => { setLocation(e.target.value); setError(""); }} />
        </div>

        <div className="field" style={{ marginTop:14 }}>
          <label>หมายเหตุ <span className="muted" style={{ fontWeight:400 }}>(ถ้ามี)</span></label>
          <input className="input" placeholder="รายละเอียดเพิ่มเติม..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <div style={{ color:"var(--red)", fontSize:13.5, marginTop:10 }}><IcoX size={14} stroke="var(--red)" /> {error}</div>}
        <div className="row" style={{ justifyContent:"flex-end", marginTop:22, gap:10 }}>
          <button className="btn btn-soft" onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "กำลังบันทึก…" : <><IcoCheck size={16} stroke="#fff" /> บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Attendance Report Panel ============ */
function AttendancePanel({ meeting, auth, canManage, isLive }) {
  const now                         = useNow(10000); // update every 10s for presence accuracy
  const [records, setRecords]       = useStateP(null);
  const [loading, setLoading]       = useStateP(false);
  const [showTime, setShowTime]     = useStateP(false);
  const [addModal, setAddModal]     = useStateP(null); // null | "attend" | "absent"
  const [editRow,  setEditRow]      = useStateP(null); // record being edited
  const [deleting, setDeleting]     = useStateP(null);

  const load = async () => {
    try {
      const res  = await fetch(`api/attendance.php?meeting_id=${encodeURIComponent(meeting.id)}`,
        { credentials:"same-origin" });
      const data = await res.json();
      if (data.success) setRecords(data.data);
    } catch {}
  };

  useEffectP(() => {
    if (!auth) return;
    setLoading(true);
    load().finally(() => setLoading(false));
    /* Poll for presence updates when meeting is live */
    if (isLive) {
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }
  }, [meeting.id, isLive]);

  const handleAdded   = (row) => { setRecords(prev => [...(prev || []), row]); setAddModal(null); };
  const handleEdited  = (row) => { setRecords(prev => prev.map(r => r.id === row.id ? row : r)); setEditRow(null); };
  const handleDelete  = async (id) => {
    setDeleting(id);
    try {
      await fetch(`api/attendance.php?id=${id}`, { method:"DELETE", credentials:"same-origin" });
      setRecords(prev => prev.filter(r => r.id !== id));
    } finally { setDeleting(null); }
  };

  const nowMs    = now.getTime();
  const attended = (records || []).filter(r => !r.is_absent);
  const absent   = (records || []).filter(r =>  r.is_absent);

  /* Google Maps URL */
  const mapsUrl = (r) => r.lat && r.lng
    ? `https://www.google.com/maps?q=${r.lat},${r.lng}`
    : null;

  /* Presence dot */
  const PresenceDot = ({ r }) => {
    const p = presenceOf(r, nowMs);
    if (!p) return null;
    if (p === "online") {
      return <span className="presence-dot presence-online" title="ออนไลน์อยู่ในขณะนี้" />;
    }
    return (
      <span className="presence-away" title="ออฟไลน์เกิน 5 นาที">
        <span className="presence-dot presence-yellow" />
        <IcoWalk size={13} stroke="var(--amber)" />
      </span>
    );
  };

  const AttRow = ({ r }) => {
    const mapUrl = mapsUrl(r);
    return (
      <div className="att-row">
        <Avatar name={r.name} />
        <div className="att-info">
          <div className="att-name">
            {r.name}
            <PresenceDot r={r} />
            {r.added_by && <span className="att-manual-badge">เพิ่มโดยผู้จัด</span>}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noreferrer"
                className="att-maps-btn" title={`พิกัด: ${r.lat}, ${r.lng}`}>
                <IcoPin size={12} /> Maps
              </a>
            )}
          </div>
          <div className="att-loc"><IcoPin size={13} /><span>{r.location || "—"}</span></div>
          {r.notes && <div className="att-notes"><IcoList size={13} /> {r.notes}</div>}
          {showTime && (
            <div className="att-time"><IcoClock size={12} /> ลงชื่อ {fmtDateTime(r.signed_at)}</div>
          )}
        </div>
        {canManage && r.added_by && (
          <button className="icon-btn" title="แก้ไข" style={{ flexShrink:0 }}
            onClick={() => setEditRow(r)}>
            <IcoEdit size={16} />
          </button>
        )}
        {canManage && (
          <button className="icon-btn" title="ลบ" style={{ opacity:.6, flexShrink:0 }}
            disabled={deleting === r.id} onClick={() => handleDelete(r.id)}>
            <IcoTrash size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="att-panel">
      <div className="att-panel-header">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <IcoClipboard size={18} />
          <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:17 }}>
            รายงานการประชุม
          </span>
          {records !== null && (
            <span className="chip" style={{ fontSize:12.5, padding:"2px 10px" }}>
              {attended.length} คนเข้าร่วม{absent.length > 0 && ` · ${absent.length} คนขาด`}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <label className="att-toggle">
            <input type="checkbox" checked={showTime} onChange={e => setShowTime(e.target.checked)} />
            <span>แสดงเวลาลงชื่อ</span>
          </label>
          {records && records.length > 0 && (
            <button className="btn btn-soft btn-sm"
              onClick={() => printAttendanceReport(meeting, records)}>
              <IcoFile size={15} /> พิมพ์รายงาน
            </button>
          )}
        </div>
      </div>

      {loading && <div className="muted" style={{ padding:"20px 0", textAlign:"center", fontSize:14 }}>กำลังโหลด…</div>}

      {!loading && records !== null && (
        <>
          {/* Attendees */}
          <div className="att-section">
            <div className="att-section-title">
              <IcoUserCheck size={15} stroke="var(--green)" />
              <span style={{ color:"var(--green)" }}>ผู้เข้าร่วมประชุม</span>
              <span className="att-cnt">{attended.length} คน</span>
            </div>
            {attended.length === 0
              ? <div className="muted" style={{ fontSize:13.5, padding:"10px 0" }}>ยังไม่มีผู้ลงชื่อเข้าร่วม</div>
              : attended.map(r => <AttRow key={r.id} r={r} />)
            }
            {canManage && (
              <button className="btn btn-soft btn-sm" style={{ marginTop:10 }} onClick={() => setAddModal("attend")}>
                <IcoPlus size={15} /> เพิ่มผู้เข้าร่วม (จากห้องประชุมจริง)
              </button>
            )}
          </div>

          {/* Absent */}
          {(absent.length > 0 || canManage) && (
            <div className="att-section" style={{ marginTop:18 }}>
              <div className="att-section-title">
                <IcoX size={15} stroke="var(--red)" />
                <span style={{ color:"var(--red)" }}>ผู้ขาดการประชุม</span>
                <span className="att-cnt">{absent.length} คน</span>
              </div>
              {absent.length === 0
                ? <div className="muted" style={{ fontSize:13.5, padding:"10px 0" }}>ไม่มีผู้ขาดประชุม</div>
                : absent.map(r => <AttRow key={r.id} r={r} />)
              }
              {canManage && (
                <button className="btn btn-soft btn-sm" style={{ marginTop:10 }} onClick={() => setAddModal("absent")}>
                  <IcoPlus size={15} /> ระบุผู้ขาดประชุม
                </button>
              )}
            </div>
          )}

          {/* Presence legend — only during live */}
          {isLive && (
            <div style={{ marginTop:16, padding:"10px 0", borderTop:"1px solid var(--line)",
              display:"flex", gap:18, flexWrap:"wrap", fontSize:12.5, color:"var(--muted)" }}>
              <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span className="presence-dot presence-online" /> กำลังอยู่ในการประชุม
              </span>
              <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span className="presence-dot presence-yellow" />
                <IcoWalk size={13} stroke="var(--amber)" /> ออกจากหน้าต่างเกิน 5 นาที
              </span>
            </div>
          )}
        </>
      )}

      {addModal && (
        <AddAttendeeModal
          meeting={meeting}
          defaultAbsent={addModal === "absent"}
          defaultLocation={addModal === "attend" ? (meeting.location || "") : ""}
          onDone={handleAdded}
          onCancel={() => setAddModal(null)}
        />
      )}
      {editRow && (
        <EditAttendeeModal
          record={editRow}
          onDone={handleEdited}
          onCancel={() => setEditRow(null)}
        />
      )}
    </div>
  );
}

/* ============ Virtual Meeting Room ============ */
function VirtualRoom({ meeting, auth, onClose }) {
  const now  = useNow(10000);
  const nowMs = now.getTime();

  const [records,      setRecords]      = useStateP([]);
  const [showPhysical, setShowPhysical] = useStateP(true);
  const [isFs,         setIsFs]         = useStateP(false);
  const roomRef = useRefP(null);

  /* Load attendance + poll every 30 s */
  useEffectP(() => {
    const load = async () => {
      try {
        const res  = await fetch(`api/attendance.php?meeting_id=${encodeURIComponent(meeting.id)}`,
          { credentials: "same-origin" });
        const data = await res.json();
        if (data.success) setRecords(data.data);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [meeting.id]);

  /* Fullscreen tracking */
  useEffectP(() => {
    const fn = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  const toggleFs = async () => {
    if (!document.fullscreenElement) await roomRef.current?.requestFullscreen?.();
    else                              await document.exitFullscreen?.();
  };

  /* Escape key to close */
  useEffectP(() => {
    const fn = (e) => { if (e.key === "Escape" && !document.fullscreenElement) onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const attended = records.filter(r => !r.is_absent);
  const remote   = attended.filter(r => !r.added_by); // self sign-in
  const physical = attended.filter(r =>  r.added_by); // manually added

  /* Split remote attendees top/bottom around table */
  const half   = Math.ceil(remote.length / 2);
  const topRow = remote.slice(0, half);
  const botRow = remote.slice(half);

  const onlineCount = remote.filter(r => presenceOf(r, nowMs) === "online").length;

  /* Avatar with presence ring */
  const VRAvatar = ({ r, size = 56 }) => {
    const ch      = r.name.trim()[0] || "?";
    const palette = ["#1a73e8","#1e8e3e","#6c5ce7","#e91e8c","#f9ab00","#00a3a3","#ea4335"];
    const bg      = palette[(r.name.charCodeAt(0) || 0) % palette.length];
    const p       = presenceOf(r, nowMs);
    const ring    = p === "online" ? "0 0 0 3px #34d399" : p === "away" ? "0 0 0 3px #fbbf24" : "none";
    return (
      <div style={{ position: "relative", display: "inline-flex" }}>
        <div style={{ width: size, height: size, borderRadius: "50%", background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.38, fontWeight: 700, color: "#fff",
          fontFamily: "var(--font-display)", boxShadow: ring,
          transition: "box-shadow .4s" }}>
          {ch}
        </div>
        {p === "online" && <span className="vroom-dot vrd-online" />}
        {p === "away"   && <span className="vroom-dot vrd-away"   />}
      </div>
    );
  };

  /* Remote attendee seat */
  const Seat = ({ r }) => (
    <div className="vroom-seat">
      <VRAvatar r={r} size={56} />
      <div className="vroom-sname">{r.name}</div>
      <div className="vroom-sloc">{r.location}</div>
    </div>
  );

  /* Physical-room attendee (on the table) — blue dot */
  const PhysChip = ({ r }) => {
    const ch  = r.name.trim()[0] || "?";
    const pal = ["#1a73e8","#1e8e3e","#6c5ce7","#e91e8c","#f9ab00","#00a3a3","#ea4335"];
    const bg  = pal[(r.name.charCodeAt(0) || 0) % pal.length];
    return (
      <div className="vroom-phys-chip">
        <div style={{ position:"relative", display:"inline-flex", flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
            boxShadow: "0 0 0 3px #1a73e8" }}>
            {ch}
          </div>
          <span className="vroom-dot vrd-physical" />
        </div>
        <span>{r.name}</span>
      </div>
    );
  };

  const roomLabel = meeting.location || "ห้องประชุม";

  return (
    <div className="vroom-overlay" ref={roomRef}>

      {/* ── Header ── */}
      <div className="vroom-header">
        <div style={{ minWidth: 0 }}>
          <div className="vroom-title">{meeting.title}</div>
          <div className="vroom-sub">
            <span className="presence-dot presence-online" style={{ display:"inline-block" }} />
            {onlineCount} คนออนไลน์ &nbsp;·&nbsp; {remote.length} คนลงชื่อ
            {physical.length > 0 && <> &nbsp;·&nbsp; {physical.length} คนจาก{roomLabel}</>}
          </div>
        </div>
        <div className="vroom-controls">
          {physical.length > 0 && (
            <label className="vroom-toggle">
              <input type="checkbox" checked={showPhysical}
                onChange={e => setShowPhysical(e.target.checked)} />
              <IcoBuilding size={14} />
              {roomLabel} ({physical.length})
            </label>
          )}
          <button className="vroom-btn" onClick={toggleFs} title={isFs ? "ออกจากเต็มจอ" : "เต็มจอ"}>
            {isFs ? <IcoMinimize size={17} stroke="#fff" /> : <IcoMaximize size={17} stroke="#fff" />}
            <span>{isFs ? "ออกจากเต็มจอ" : "เต็มจอ"}</span>
          </button>
          <button className="vroom-btn vroom-close-btn" onClick={onClose} title="ปิด">
            <IcoX size={18} stroke="#fff" />
          </button>
        </div>
      </div>

      {/* ── Room ── */}
      <div className="vroom-room">

        {/* Top row seats */}
        {topRow.length > 0 && (
          <div className="vroom-row">{topRow.map(r => <Seat key={r.id} r={r} />)}</div>
        )}

        {/* Conference table */}
        <div className="vroom-table">
          <div className="vroom-tbl-title">
            <IcoVideo size={16} stroke="rgba(255,220,150,.9)" /> {meeting.title}
          </div>
          {meeting.organizer && (
            <div className="vroom-tbl-org">{meeting.organizer}</div>
          )}

          {/* Physical-room attendees ON the table */}
          {showPhysical && physical.length > 0 && (
            <div className="vroom-phys-zone">
              <div className="vroom-phys-label">
                <IcoBuilding size={12} /> ผู้เข้าร่วมจาก{roomLabel}
              </div>
              <div className="vroom-phys-chips">
                {physical.map(r => <PhysChip key={r.id} r={r} />)}
              </div>
            </div>
          )}
        </div>

        {/* Bottom row seats */}
        {botRow.length > 0 && (
          <div className="vroom-row">{botRow.map(r => <Seat key={r.id} r={r} />)}</div>
        )}

        {/* Empty state */}
        {attended.length === 0 && (
          <div style={{ color:"rgba(255,255,255,.4)", fontSize:15, marginTop:24 }}>
            ยังไม่มีผู้ลงชื่อเข้าร่วมประชุม
          </div>
        )}

        {/* Legend */}
        <div className="vroom-legend">
          <span><span className="vroom-dot vrd-online"   style={{ position:"static", border:"none" }} /> กำลังออนไลน์</span>
          <span><span className="vroom-dot vrd-away"     style={{ position:"static", border:"none" }} /> ออฟไลน์เกิน 5 นาที</span>
          {physical.length > 0 && (
            <span><span className="vroom-dot vrd-physical" style={{ position:"static", border:"none" }} /> อยู่ใน{roomLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Drink orders panel (admin collapsible) ============ */
function DrinkOrdersPanel({ meeting }) {
  const [orders,  setOrders]  = useStateP([]);
  const [loading, setLoading] = useStateP(true);
  const [open,    setOpen]    = useStateP(false);

  useEffectP(() => {
    if (!open) return;
    setLoading(true);
    fetch(`api/drink_orders.php?meeting_id=${encodeURIComponent(meeting.id)}`, { credentials:"same-origin" })
      .then(r => r.json())
      .then(d => { if (d.success) setOrders(d.data); })
      .finally(() => setLoading(false));
  }, [open, meeting.id]);

  const fmtItems = (items) => items.map(it => `${it.name} x${it.qty}`).join(", ");
  const fmtTs    = (ts) => {
    const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
    return d.toLocaleString("th-TH", { timeZone:"Asia/Bangkok", hour:"2-digit", minute:"2-digit", day:"numeric", month:"short" });
  };

  return (
    <div>
      <button className="btn btn-soft btn-sm" onClick={() => setOpen(o => !o)} style={{ marginBottom: open ? 12 : 0 }}>
        <IcoCoffee size={16} /> รายการสั่งเครื่องดื่ม
        <IcoChevDown size={14} style={{ transition:"transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          {loading ? (
            <div style={{ padding:24, textAlign:"center", color:"var(--muted)" }}>กำลังโหลด…</div>
          ) : orders.length === 0 ? (
            <div style={{ padding:24, textAlign:"center", color:"var(--muted)" }}>ยังไม่มีการสั่งเครื่องดื่ม</div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border)", background:"var(--bg-2)" }}>
                  <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:600 }}>ชื่อ</th>
                  <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:600 }}>รายการ</th>
                  <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:600 }}>หมายเหตุ</th>
                  <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:600 }}>เวลา</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding:"10px 16px", fontWeight:500 }}>{o.name}</td>
                    <td style={{ padding:"10px 16px" }}>{fmtItems(o.items)}</td>
                    <td style={{ padding:"10px 16px", color:"var(--muted)" }}>{o.notes || "—"}</td>
                    <td style={{ padding:"10px 16px", color:"var(--muted)", whiteSpace:"nowrap" }}>{fmtTs(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ Drink order section ============ */
function DrinkOrderSection({ meeting, auth, drinks, onGoLogin, admin }) {
  const now      = useNow(10000);
  const startTs  = new Date(meeting.start).getTime();
  const inWindow = now.getTime() < startTs;
  const tooEarly = false;
  const tooLate  = now.getTime() >= startTs;

  const [myOrder,     setMyOrder]     = useStateP(null);
  const [editing,     setEditing]     = useStateP(true);
  const [selectedId,  setSelectedId]  = useStateP(null);   // drink_id ที่เลือก
  const [drinkDetail, setDrinkDetail] = useStateP("");      // รายละเอียดเพิ่มเติม
  const [name,        setName]        = useStateP(auth?.name ?? "");
  const [notes,       setNotes]       = useStateP("");
  const [busy,     setBusy]     = useStateP(false);
  const [err,      setErr]      = useStateP("");
  const [toast,    setToast]    = useStateP("");
  const [loaded,   setLoaded]   = useStateP(false);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  // Load existing order for this user
  useEffectP(() => {
    if (!auth || !inWindow) return;
    fetch(`api/drink_orders.php?meeting_id=${encodeURIComponent(meeting.id)}&mine=1`, { credentials:"same-origin" })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.length > 0) {
          const o = d.data[0];
          setMyOrder(o);
          setName(o.name);
          setNotes(o.notes || "");
          if (o.items.length > 0) {
            setSelectedId(o.items[0].drink_id);
            setDrinkDetail(o.items[0].detail || "");
          }
          setEditing(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [auth, meeting.id, inWindow]);

  const submit = async () => {
    if (!auth) { onGoLogin && onGoLogin(); return; }
    const nm = name.trim();
    if (!nm) { setErr("กรุณาระบุชื่อ"); return; }
    if (!selectedId) { setErr("กรุณาเลือกเครื่องดื่ม 1 รายการ"); return; }
    const chosen = drinks.find(d => d.id === selectedId);
    if (!chosen) { setErr("รายการเครื่องดื่มไม่ถูกต้อง"); return; }
    const items = [{ drink_id: chosen.id, name: chosen.name, qty: 1, detail: drinkDetail.trim() }];
    setErr(""); setBusy(true);
    try {
      const res  = await fetch("api/drink_orders.php", {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
        body: JSON.stringify({ meeting_id: meeting.id, name: nm, items, notes: notes.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMyOrder(data.data);
        setEditing(false);
        showToast("บันทึกออเดอร์แล้ว");
      } else {
        setErr(data.error ?? "เกิดข้อผิดพลาด");
      }
    } catch { setErr("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
    finally { setBusy(false); }
  };

  const cancelOrder = async () => {
    if (!myOrder) return;
    setBusy(true);
    try {
      const res  = await fetch(`api/drink_orders.php?id=${myOrder.id}`, { method:"DELETE", credentials:"same-origin" });
      const data = await res.json();
      if (data.success) {
        setMyOrder(null); setEditing(true); setSelectedId(null); setDrinkDetail(""); setNotes(""); setName(auth?.name ?? "");
        showToast("ยกเลิกออเดอร์แล้ว");
      }
    } catch {}
    finally { setBusy(false); }
  };

  const avail = drinks.filter(d => d.is_available);

  const sectionStyle = { marginTop:28 };
  const headerStyle  = { fontFamily:"var(--font-display)", fontWeight:700, fontSize:16, marginBottom:12, display:"flex", alignItems:"center", gap:8 };

  /* ── เงื่อนไขการสั่ง ── */
  const condItems = [];
  if (meeting.drink_shop)     condItems.push({ label:"ร้าน", value: meeting.drink_shop });
  if (meeting.drink_budget)   condItems.push({ label:"งบต่อแก้ว", value: `${meeting.drink_budget} บาท` });
  if (meeting.drink_max_cups) condItems.push({ label:"สูงสุดต่อคน", value: `${meeting.drink_max_cups} แก้ว` });

  const maxCups = meeting.drink_max_cups || 99;

  return (
    <div style={sectionStyle}>
      <div style={headerStyle}>
        <IcoCoffee size={20} stroke="var(--blue)" /> สั่งเครื่องดื่ม
      </div>

      {/* เงื่อนไขการสั่ง */}
      {condItems.length > 0 && (
        <div className="card" style={{ padding:"12px 16px", marginBottom:14, display:"flex", flexWrap:"wrap", gap:"10px 24px" }}>
          {condItems.map(c => (
            <span key={c.label} style={{ fontSize:13.5 }}>
              <span className="muted">{c.label}: </span>
              <span style={{ fontWeight:600 }}>{c.value}</span>
            </span>
          ))}
        </div>
      )}

      {toast && (
        <div className="chip" style={{ background:"var(--green-50)", color:"var(--green)", marginBottom:12 }}>
          <IcoCheck size={14} /> {toast}
        </div>
      )}

      {/* หมดเวลา */}
      {tooLate && (
        <div className="card" style={{ padding:"14px 18px", background:"var(--bg-2)", marginBottom:14 }}>
          <span className="muted">หมดเวลาสั่งเครื่องดื่มแล้ว</span>
        </div>
      )}

      {/* ต้อง login */}
      {inWindow && !auth && (
        <div className="card" style={{ padding:"14px 18px", marginBottom:14 }}>
          <span className="muted">กรุณา </span>
          <button className="btn btn-soft btn-sm" onClick={onGoLogin}>เข้าสู่ระบบ</button>
          <span className="muted"> เพื่อสั่งเครื่องดื่ม</span>
        </div>
      )}

      {/* เมนูว่าง — แสดงเสมอเมื่อไม่มีเมนู (ไม่ขึ้นกับ window) */}
      {avail.length === 0 && (
        <div className="card" style={{ padding:"14px 18px", background:"var(--bg-2)", marginBottom:14 }}>
          <span className="muted">
            ยังไม่มีเมนูเครื่องดื่ม
            {admin && <> — ไปที่ <strong>จัดการเมนูเครื่องดื่ม</strong> เพื่อเพิ่มรายการ</>}
          </span>
        </div>
      )}

      {/* ออเดอร์ของฉัน (สรุป) */}
      {(inWindow || admin) && auth && avail.length > 0 && !editing && myOrder && (
        <div className="card" style={{ padding:18, marginBottom:14 }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>ออเดอร์ของคุณ</div>
          <div className="muted" style={{ fontSize:14, marginBottom:4 }}>
            {myOrder.items.map(it => it.detail ? `${it.name} (${it.detail})` : it.name).join(", ")}
          </div>
          {myOrder.notes && <div className="muted" style={{ fontSize:13, marginBottom:8 }}>หมายเหตุ: {myOrder.notes}</div>}
          <div className="row" style={{ gap:8, marginTop:10 }}>
            <button className="btn btn-soft btn-sm" onClick={() => setEditing(true)} disabled={busy}>
              <IcoPencil size={15} /> แก้ไข
            </button>
            <button className="btn btn-sm" style={{ color:"var(--red)", background:"var(--red-50)", border:"none" }}
              onClick={cancelOrder} disabled={busy}>
              <IcoTrash size={15} /> ยกเลิกออเดอร์
            </button>
          </div>
        </div>
      )}

      {/* ฟอร์มสั่ง */}
      {(inWindow || admin) && auth && avail.length > 0 && editing && (
        <div className="card" style={{ padding:20, marginBottom:14 }}>
          <div className="field" style={{ marginBottom:14 }}>
            <label style={{ fontWeight:500, fontSize:14, marginBottom:6, display:"block" }}>ชื่อ</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="ชื่อของคุณ" />
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontWeight:500, fontSize:14, marginBottom:10 }}>เลือกเครื่องดื่ม <span className="muted" style={{ fontWeight:400 }}>(1 รายการ)</span></div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {avail.map(d => (
                <label key={d.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                  borderRadius:"var(--radius)", border:`1.5px solid ${selectedId===d.id?"var(--blue)":"var(--line)"}`,
                  background: selectedId===d.id ? "var(--blue-50)" : "var(--bg-2)",
                  cursor:"pointer", transition:"all .15s" }}>
                  <input type="radio" name="drink" value={d.id}
                    checked={selectedId === d.id}
                    onChange={() => setSelectedId(d.id)}
                    style={{ accentColor:"var(--blue)", width:16, height:16 }} />
                  <span style={{ fontSize:14, fontWeight: selectedId===d.id ? 600 : 400 }}>{d.name}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedId && (
            <div className="field" style={{ marginBottom:14 }}>
              <label style={{ fontWeight:500, fontSize:14, marginBottom:6, display:"block" }}>
                รายละเอียดเพิ่มเติม <span className="muted" style={{ fontWeight:400 }}>(ไม่บังคับ)</span>
              </label>
              <input className="input" value={drinkDetail} onChange={e => setDrinkDetail(e.target.value)}
                placeholder="เช่น หวานน้อย, ไม่ใส่น้ำแข็ง, ร้อน" />
            </div>
          )}

          <div className="field" style={{ marginBottom:16 }}>
            <label style={{ fontWeight:500, fontSize:14, marginBottom:6, display:"block" }}>หมายเหตุเพิ่มเติม <span className="muted" style={{ fontWeight:400 }}>(ไม่บังคับ)</span></label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="เช่น แพ้นม, ต้องการถุง" />
          </div>

          {err && <div className="hint" style={{ color:"var(--red)", marginBottom:10 }}>{err}</div>}

          <div className="row" style={{ gap:10 }}>
            {myOrder && (
              <button className="btn btn-soft btn-sm" onClick={() => setEditing(false)} disabled={busy}>ยกเลิก</button>
            )}
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              <IcoCheck size={16} stroke="#fff" /> {busy ? "กำลังบันทึก…" : "ยืนยันออเดอร์"}
            </button>
          </div>
        </div>
      )}

      {/* รายการออเดอร์ทั้งหมด (admin เท่านั้น) */}
      {admin && (
        <div style={{ marginTop:8 }}>
          <DrinkOrdersPanel meeting={meeting} />
        </div>
      )}
    </div>
  );
}

/* ============ Meeting detail ============ */
function MeetingDetail({ meeting, auth, onBack, admin, onEdit, onDelete, onGoLogin, drinks }) {
  const now    = useNow(1000);
  if (!meeting) return null;
  const s      = new Date(meeting.start), e = new Date(meeting.end);
  const status = meetingStatus(meeting, now);
  const dept   = deptById(meeting.dept);
  const pf     = PLATFORMS[meeting.platform] || PLATFORMS.other;

  const [copied,         setCopied]         = useStateP(false);
  const [checkInOpen,    setCheckInOpen]    = useStateP(false);
  const [myRecord,       setMyRecord]       = useStateP(null);
  const [showReport,     setShowReport]     = useStateP(false);
  const [showVirtualRoom, setShowVirtualRoom] = useStateP(false);

  const isLive  = status === "live";
  const isEnded = status === "ended" || status === "expired";
  const canManage = admin;

  /* ── Heartbeat — ping presence every 30s while page is open ── */
  useEffectP(() => {
    if (!auth) return;
    const ping = () => fetch("api/presence.php", {
      method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
      body: JSON.stringify({ meeting_id: meeting.id }),
    }).catch(() => {});
    ping(); // immediate first ping
    const t = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [auth, meeting.id]);

  const copyLink = () => {
    navigator.clipboard && navigator.clipboard.writeText(meeting.link);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const handleCheckInDone = (record) => { setMyRecord(record); setCheckInOpen(false); };

  return (
    <div className="page">
      <button className="btn btn-soft btn-sm" onClick={onBack} style={{ marginBottom:20 }}>
        <IcoChevL size={16} /> ย้อนกลับ
      </button>

      <div className="detail-grid">
        {/* ── Main content ── */}
        <div>
          <div className="row" style={{ gap:10, marginBottom:12 }}>
            <span className="chip" style={{ background:"#fff", border:`1px solid ${dept.color}33`, color:dept.color }}>
              <span className="dot" style={{ background:dept.color }}></span>{dept.name}
            </span>
            <StatusPill status={status} start={meeting.start} end={meeting.end} now={now} />
          </div>
          <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-.5px", lineHeight:1.2, margin:"0 0 14px" }}>
            {meeting.title}
          </h1>
          <div className="card" style={{ padding:"6px 22px", marginTop:20 }}>
            <div className="kv"><span className="k"><IcoCalendar size={16} /> วันที่</span><span className="v">{fmtDateLong(s)}</span></div>
            <div className="kv"><span className="k"><IcoClock size={16} /> เวลา</span><span className="v">{fmtTime(s)} – {fmtTime(e)} น. <span className="muted">({fmtDuration(s, e)})</span></span></div>
            <div className="kv"><span className="k"><IcoVideo size={16} /> แพลตฟอร์ม</span><span className="v"><PlatformBadge platform={meeting.platform} /></span></div>
            {meeting.location && <div className="kv"><span className="k"><IcoPin size={16} /> สถานที่/ห้อง</span><span className="v">{meeting.location}</span></div>}
            <div className="kv"><span className="k"><IcoUser size={16} /> ผู้จัด/ประธาน</span><span className="v">{meeting.organizer}</span></div>
            {meeting.invitees && <div className="kv"><span className="k"><IcoUsers size={16} /> ผู้เข้าร่วม</span><span className="v">{meeting.invitees}</span></div>}
            {meeting.description && (
              <div className="kv kv-desc"><span className="k"><IcoClipboard size={16} /> วาระโดยสังเขป</span><span className="v detail-desc" style={{ whiteSpace:"pre-wrap", lineHeight:1.65 }}>{meeting.description}</span></div>
            )}
          </div>

          {/* Attachments */}
          {meeting.attachments && meeting.attachments.length > 0 && (
            <div style={{ marginTop:22 }}>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:16, marginBottom:10 }}>
                เอกสารวาระการประชุม
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {meeting.attachments.map((f, i) => {
                  if (f.is_link) return (
                    <div className="file-row" key={i}>
                      <span className="f-ic"><IcoLink size={18} /></span>
                      <a className="grow" href={f.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none", cursor:"pointer" }}>
                        <div className="f-name" style={{ textDecoration:"underline", textUnderlineOffset:3 }}>{f.name}</div>
                        <div className="f-size" style={{ wordBreak:"break-all" }}>{f.url}</div>
                      </a>
                      <a className="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noreferrer">
                        <IcoLink size={16} /> เปิดลิงก์
                      </a>
                    </div>
                  );
                  const isPdf = f.name?.toLowerCase().endsWith(".pdf");
                  return (
                    <div className="file-row" key={i}>
                      <span className="f-ic"><IcoFile size={18} /></span>
                      {f.url
                        ? <a className="grow" href={f.url} target="_blank" rel="noreferrer" {...(!isPdf ? { download: f.name } : {})} style={{ textDecoration:"none", cursor:"pointer" }}>
                            <div className="f-name" style={{ textDecoration:"underline", textUnderlineOffset:3 }}>{f.name}</div>
                            <div className="f-size">{f.size}</div>
                          </a>
                        : <div className="grow"><div className="f-name">{f.name}</div><div className="f-size">{f.size}</div></div>
                      }
                      {f.url
                        ? isPdf
                          ? <a className="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noreferrer">
                              <IcoFile size={16} /> เปิดดู
                            </a>
                          : <a className="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noreferrer" download={f.name}>
                              <IcoDownload size={16} /> ดาวน์โหลด
                            </a>
                        : <span className="btn btn-ghost btn-sm" style={{ opacity:.4, cursor:"default" }}>
                            <IcoDownload size={16} /> ดาวน์โหลด
                          </span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attendance panel — live (admin sees full panel) or ended (everyone sees report) */}
          {auth && isLive && canManage && (
            <div style={{ marginTop:28 }}>
              <AttendancePanel meeting={meeting} auth={auth} canManage={canManage} isLive={true} />
            </div>
          )}
          {auth && isEnded && (
            <div style={{ marginTop:28 }}>
              {!showReport
                ? <button className="btn btn-soft" onClick={() => setShowReport(true)}>
                    <IcoClipboard size={17} /> รายงานการประชุม
                  </button>
                : <AttendancePanel meeting={meeting} auth={auth} canManage={canManage} isLive={false} />
              }
            </div>
          )}

          {/* ── Drinks ordering panel ── */}
          {meeting.drinks_enabled && (
            <DrinkOrderSection meeting={meeting} auth={auth} drinks={drinks || []} onGoLogin={onGoLogin} admin={admin} />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ position:"sticky", top:84, display:"flex", flexDirection:"column", gap:16 }}>
          <div className="card" style={{ padding:22, textAlign:"center" }}>
            <div style={{ width:52, height:52, borderRadius:15, background:pf.color,
              margin:"0 auto 14px", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <pf.Icon size={26} stroke="#fff" />
            </div>

            {isLive    && <div className="muted" style={{ fontSize:13.5, marginBottom:6 }}>การประชุมกำลังดำเนินอยู่</div>}
            {isEnded   && <div className="muted" style={{ fontSize:13.5, marginBottom:6 }}>การประชุมสิ้นสุดแล้ว</div>}
            {status === "upcoming" && (() => {
              const msLeft  = new Date(meeting.start) - now;
              const isReady = msLeft <= READY_MS;
              return isReady
                ? <div style={{ fontSize:13.5, marginBottom:6, color:"var(--blue)", fontWeight:600 }}>
                    เปิดลิงก์ล่วงหน้า · เริ่มในอีก <span className="countdown">{countdownTo(s, now).text}</span>
                  </div>
                : <div className="muted" style={{ fontSize:13.5, marginBottom:6 }}>
                    เริ่มในอีก <span className="countdown" style={{ color:"var(--amber)" }}>{countdownTo(s, now).text}</span>
                  </div>;
            })()}

            <div style={{ display:"flex", justifyContent:"center", marginBottom:isLive ? 0 : 14 }}>
              <JoinLink meeting={meeting} now={now} size="btn-lg" auth={auth} onLoginRequired={onGoLogin} />
            </div>

            {/* ── Check-in button: only during live, only for logged-in users ── */}
            {auth && isLive && (
              <div style={{ marginTop:12 }}>
                <button
                  className={`btn btn-lg ${myRecord && !myRecord.is_absent ? "btn-checkedin" : "btn-checkin"}`}
                  style={{ width:"100%" }}
                  onClick={() => setCheckInOpen(true)}
                >
                  {myRecord && !myRecord.is_absent
                    ? <><IcoCheckCircle size={18} stroke="#fff" /> ลงชื่อแล้ว — แก้ไข</>
                    : <><IcoUserCheck   size={18} stroke="#fff" /> ลงชื่อเข้าประชุม</>
                  }
                </button>
                {myRecord && (
                  <div className="muted" style={{ fontSize:12.5, marginTop:6 }}>
                    {myRecord.is_absent ? <>ขาดประชุม — {myRecord.location}</> : <>สถานที่: {myRecord.location}</>}
                    {myRecord.lat && myRecord.lng && (
                      <a href={`https://www.google.com/maps?q=${myRecord.lat},${myRecord.lng}`}
                        target="_blank" rel="noreferrer" style={{ marginLeft:6, color:"var(--blue)" }}>
                        <IcoPin size={12} /> พิกัด
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hint texts */}
            {isLive && !auth && (
              <div className="muted" style={{ fontSize:12.5, lineHeight:1.5, marginTop:10 }}>
                กรุณา<button className="btn btn-soft btn-sm" style={{ padding:"3px 10px", margin:"0 4px" }}
                  onClick={onGoLogin}>เข้าสู่ระบบ</button>ก่อนเข้าร่วมประชุม
              </div>
            )}
            {!isLive && (
              <div className="muted" style={{ fontSize:12.5, lineHeight:1.5 }}>
                {status === "upcoming"
                  ? "ลิงก์เข้าร่วมจะเปิดใช้งานอัตโนมัติเมื่อถึงเวลาประชุม"
                  : "ลิงก์จะถูกซ่อนภายใน 1 ชั่วโมงหลังการประชุมสิ้นสุด"}
              </div>
            )}

            {status !== "expired" && auth && (
              <button className="btn btn-soft btn-sm" style={{ marginTop:14, width:"100%" }} onClick={copyLink}>
                {copied ? <><IcoCheck size={16} /> คัดลอกแล้ว</> : <><IcoCopy size={16} /> คัดลอกลิงก์</>}
              </button>
            )}

            {auth && status !== "upcoming" && (
              <button className="btn btn-vroom btn-sm" style={{ marginTop:8, width:"100%" }}
                onClick={() => setShowVirtualRoom(true)}>
                <IcoUsers size={16} stroke="#fff" /> ห้องประชุมเสมือน
              </button>
            )}
          </div>

          {admin && (
            <div className="card" style={{ padding:16, display:"flex", gap:10 }}>
              <button className="btn btn-ghost grow" onClick={() => onEdit(meeting)}>
                <IcoEdit size={17} /> แก้ไข
              </button>
              <button className="btn btn-danger" onClick={() => onDelete(meeting)}>
                <IcoTrash size={17} />
              </button>
            </div>
          )}
        </div>
      </div>

      {checkInOpen && auth && (
        <CheckInModal meeting={meeting} auth={auth}
          onDone={handleCheckInDone} onCancel={() => setCheckInOpen(false)} />
      )}

      {showVirtualRoom && auth && (
        <VirtualRoom meeting={meeting} auth={auth} onClose={() => setShowVirtualRoom(false)} />
      )}
    </div>
  );
}

Object.assign(window, { PublicAgenda, MeetingDetail });
