/* components.jsx — shared UI components. Exports to window. */
const { useState, useEffect, useRef } = React;

/* ticking clock hook */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* avatar from name initial */
function Avatar({ name = "", color }) {
  const ch = (name.trim()[0] || "?");
  const palette = ["#1a73e8","#1e8e3e","#6c5ce7","#e91e8c","#f9ab00","#00a3a3","#ea4335"];
  const c = color || palette[(name.charCodeAt(0) || 0) % palette.length];
  return <span className="avatar" style={{ background: c }}>{ch}</span>;
}

/* platform badge */
function PlatformBadge({ platform, withLabel = true }) {
  const pf = PLATFORMS[platform] || PLATFORMS.other;
  const { Icon } = pf;
  return (
    <span className="badge-platform">
      <span className="pf-dot" style={{ background: pf.color }}><Icon stroke="#fff" /></span>
      {withLabel && <span>{pf.label}</span>}
    </span>
  );
}

/* status pill */
function StatusPill({ status, start, end, now }) {
  if (status === "live") {
    const cd = countdownTo(end, now);
    return (
      <span className="st st-live">
        <span className="dot dot-live"></span>
        <span>กำลังประชุม · เหลือ <span className="countdown">{cd.text}</span></span>
      </span>
    );
  }
  if (status === "upcoming") {
    const cd      = countdownTo(start, now);
    const msLeft  = new Date(start) - now;
    const isReady = msLeft <= READY_MS;           // ≤ 15 นาที
    const soon    = msLeft < 60 * 60000;          // < 1 ชม.
    if (isReady) {
      return (
        <span className="st" style={{ background:"var(--blue-50)", color:"var(--blue)" }}>
          <IcoVideo size={14} />
          <span>เปิดลิงก์แล้ว · เริ่มในอีก <span className="countdown">{cd.text}</span></span>
        </span>
      );
    }
    return (
      <span className="st st-upcoming">
        <IcoClock size={14} />
        {soon ? <span>เริ่มในอีก <span className="countdown">{cd.text}</span></span> : <span>ยังไม่ถึงเวลา</span>}
      </span>
    );
  }
  return <span className="st st-ended"><IcoCheckCircle size={14} /> สิ้นสุดแล้ว</span>;
}

/* state-aware join link — the heart of the spec
   auth            : user object (truthy) or null (not logged in)
   onLoginRequired : callback to redirect to login page

   สถานะลิงก์:
   • expired  → ซ่อน (หลังจบ 1 ชม.)
   • ended    → เทา "การประชุมสิ้นสุดแล้ว"
   • upcoming (> 15 นาที) → เทา "ลิงก์ยังไม่เปิด"
   • upcoming (≤ 15 นาที) → ฟ้า "เตรียมเข้าห้องประชุม"  ← ใหม่
   • live     → เขียว "เข้าร่วมประชุม"                                    */
const READY_MS = 15 * 60 * 1000; // 15 minutes in ms

function JoinLink({ meeting, now, size = "", auth, onLoginRequired }) {
  const status    = meetingStatus(meeting, now);
  if (status === "expired") return null;

  const msToStart = new Date(meeting.start) - now;
  const isReady   = status === "upcoming" && msToStart <= READY_MS;

  /* ── Active link: live หรือ ≤ 15 นาทีก่อนเริ่ม ── */
  if (status === "live" || isReady) {
    const cls   = status === "live" ? "join-live" : "join-ready";
    const label = status === "live" ? "เข้าร่วมประชุม" : "เตรียมเข้าห้องประชุม";

    if (auth) {
      return (
        <a className={`join ${cls} ${size}`} href={meeting.link} target="_blank" rel="noreferrer">
          <IcoVideo size={18} stroke="#fff" />
          {label}
        </a>
      );
    }
    /* ไม่ได้ login → พาไปหน้า login */
    return (
      <button
        className={`join ${cls} ${size}`}
        onClick={onLoginRequired}
        title="กรุณาเข้าสู่ระบบก่อนเข้าร่วมประชุม"
        style={{ opacity: .88 }}
      >
        <IcoLock size={17} stroke="#fff" />
        เข้าสู่ระบบเพื่อเข้าร่วม
      </button>
    );
  }

  /* ── ยังไม่เปิด (> 15 นาที) หรือ สิ้นสุดแล้ว ── */
  const label = status === "upcoming" ? "ลิงก์ยังไม่เปิด" : "การประชุมสิ้นสุดแล้ว";
  return (
    <span
      className={`join join-disabled ${size}`}
      title={status === "upcoming"
        ? "ลิงก์จะเปิดใช้งาน 15 นาทีก่อนเริ่มประชุม"
        : "ลิงก์จะถูกซ่อนภายใน 1 ชั่วโมงหลังจบการประชุม"}
    >
      <IcoLock size={16} />
      {label}
    </span>
  );
}

/* meeting card (used in public agenda + lists) */
function MeetingCard({ meeting, now, onOpen, showDate = false, admin = false, onEdit, onDelete, auth, onLoginRequired }) {
  const status = meetingStatus(meeting, now);
  const s = new Date(meeting.start), e = new Date(meeting.end);
  const dept = deptById(meeting.dept);
  return (
    <div className={`mcard ${status === "live" ? "is-live" : ""}`}>
      <div className="stripe" style={{ background: dept.color }}></div>
      <div className="time-col">
        <div className="t-start">{fmtTime(s)}</div>
        <div className="t-dash"></div>
        <div className="t-end">{fmtTime(e)} น.</div>
        {showDate && <div className="t-end" style={{ marginTop: 6, fontWeight: 600 }}>{fmtDateShort(s)}</div>}
      </div>
      <div className="body" onClick={() => onOpen && onOpen(meeting)} style={{ cursor: onOpen ? "pointer" : "default" }}>
        <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
          <div className="grow">
            <div className="m-title">{meeting.title}</div>
            <div className="m-meta">
              <span className="mi"><PlatformBadge platform={meeting.platform} /></span>
              <span className="mi"><span className="dot" style={{ background: dept.color }}></span>{dept.name}</span>
              <span className="mi"><IcoUser size={15} />{meeting.organizer}</span>
              {meeting.location && <span className="mi mi-wrap"><IcoPin size={15} />{meeting.location}</span>}
              {meeting.attachments && meeting.attachments.length > 0 &&
                <span className="mi"><IcoFile size={15} />{meeting.attachments.length} ไฟล์แนบ</span>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 13 }}>
          <StatusPill status={status} start={meeting.start} end={meeting.end} now={now} />
        </div>
      </div>
      <div className="actions">
        {admin && (
          <>
            <button className="icon-btn" title="แก้ไข" onClick={(ev) => { ev.stopPropagation(); onEdit && onEdit(meeting); }}><IcoEdit size={19} /></button>
            <button className="icon-btn" title="ลบ" onClick={(ev) => { ev.stopPropagation(); onDelete && onDelete(meeting); }}><IcoTrash size={19} /></button>
          </>
        )}
        <JoinLink meeting={meeting} now={now} auth={auth} onLoginRequired={onLoginRequired} />
      </div>
    </div>
  );
}

/* modal: self sign-in for a live meeting */
function CheckInModal({ meeting, auth, onDone, onCancel }) {
  const [mode, setMode]         = useState("attend"); // "attend" | "absent"
  const [location, setLocation] = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [geoState, setGeoState] = useState("idle"); // "idle"|"loading"|"ok"|"denied"
  const coordsRef               = useRef(null); // { lat, lng }

  /* Start requesting GPS as soon as modal opens */
  useEffect(() => {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeoState("ok");
      },
      () => setGeoState("denied"),
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const submit = async () => {
    if (!location.trim()) {
      setError(mode === "attend" ? "กรุณาระบุสถานที่เข้าประชุม" : "กรุณาระบุสาเหตุที่ไม่สามารถเข้าร่วม");
      return;
    }
    setSaving(true);
    try {
      const body = {
        meeting_id: meeting.id,
        location:   location.trim(),
        is_absent:  mode === "absent",
        notes:      notes.trim(),
      };
      if (coordsRef.current) {
        body.lat = coordsRef.current.lat;
        body.lng = coordsRef.current.lng;
      }
      const res  = await fetch("api/attendance.php", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "same-origin",
        body:        JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { onDone(data.data); }
      else              { setError(data.error || "เกิดข้อผิดพลาด"); }
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 20 }}>ลงชื่อเข้าประชุม</h3>
        <div className="muted" style={{ fontSize: 13.5, marginBottom: 20 }}>{meeting.title}</div>

        <div className="field">
          <label>ชื่อ-สกุล</label>
          <input className="input" value={auth.name} disabled />
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>สถานะการเข้าร่วม</label>
          <div className="row" style={{ gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === "attend" ? "btn-success" : "btn-soft"}`}
              style={{ flex: 1 }}
              onClick={() => { setMode("attend"); setLocation(""); setError(""); }}
            >
              <IcoUserCheck size={15} stroke={mode === "attend" ? "#fff" : undefined} />
              เข้าประชุม
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === "absent" ? "btn-danger" : "btn-soft"}`}
              style={{ flex: 1 }}
              onClick={() => { setMode("absent"); setLocation(""); setError(""); }}
            >
              <IcoX size={15} stroke="currentColor" />
              ไม่สามารถเข้าร่วมได้
            </button>
          </div>
        </div>

        {/* GPS status indicator */}
        <div style={{ fontSize: 12.5, marginTop: 10, display: "flex", alignItems: "center", gap: 6,
          color: geoState === "ok" ? "var(--green)" : geoState === "denied" ? "var(--muted)" : "var(--amber)" }}>
          {geoState === "loading" && <><IcoClock size={13} /> กำลังขอตำแหน่ง GPS…</>}
          {geoState === "ok"      && <><IcoCheckCircle size={13} stroke="var(--green)" /> บันทึกพิกัดแล้ว</>}
          {geoState === "denied"  && <><IcoPin size={13} /> ไม่สามารถขอตำแหน่งได้ — จะบันทึกโดยไม่มีพิกัด</>}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>
            {mode === "attend" ? "สถานที่เข้าประชุม" : "สาเหตุที่ไม่สามารถเข้าร่วม"}
            <span className="req"> *</span>
          </label>
          <input
            className="input"
            placeholder={
              mode === "attend"
                ? "เช่น บ้าน, สำนักงาน, ห้องประชุมอาคาร A"
                : "เช่น ติดภารกิจราชการ, ป่วย, ติดการสอน"
            }
            value={location}
            autoFocus
            onChange={(e) => { setLocation(e.target.value); setError(""); }}
          />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>หมายเหตุ <span className="muted" style={{ fontWeight: 400 }}>(ถ้ามี)</span></label>
          <input
            className="input"
            placeholder="รายละเอียดเพิ่มเติม..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div style={{ color: "var(--red)", fontSize: 13.5, marginTop: 10 }}>
            <IcoX size={14} stroke="var(--red)" /> {error}
          </div>
        )}

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 22, gap: 10 }}>
          <button className="btn btn-soft" onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "กำลังบันทึก…" : <><IcoCheck size={16} stroke="#fff" /> ยืนยันการลงชื่อ</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* toast */
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [msg]);
  if (!msg) return null;
  return <div className="toast"><IcoCheckCircle size={18} stroke="#7ee29a" /> {msg}</div>;
}

/* confirm modal */
function ConfirmModal({ title, body, confirmLabel = "ยืนยัน", danger, onConfirm, onCancel }) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 8px", fontSize: 21 }}>{title}</h3>
        <p className="muted" style={{ margin: "0 0 22px", lineHeight: 1.55 }}>{body}</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-soft" onClick={onCancel}>ยกเลิก</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* empty state */
function EmptyState({ icon, title, text, action }) {
  const Icon = icon || IcoCalendar;
  return (
    <div className="empty">
      <div className="ic"><Icon size={30} /></div>
      <h3>{title}</h3>
      <div>{text}</div>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

Object.assign(window, {
  useNow, Avatar, PlatformBadge, StatusPill, JoinLink, MeetingCard,
  CheckInModal, Toast, ConfirmModal, EmptyState,
});
