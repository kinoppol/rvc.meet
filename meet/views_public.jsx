/* views_public.jsx — public agenda + meeting detail. Exports to window. */
const { useState: useStateP, useMemo: useMemoP } = React;

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

  /* Render a MeetingCard with auth-aware join link */
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
              <span className="lbl" style={{ color: "var(--green)" }}>กำลังประชุมอยู่ในขณะนี้</span>
              <span className="ln"></span><span className="cnt">{live.length} รายการ</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {live.map(card)}
            </div>
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="day-rail">
              <span className="lbl">กำลังจะเริ่ม</span>
              <span className="ln"></span><span className="cnt">{upcoming.length} รายการ</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {upcoming.map(card)}
            </div>
          </>
        )}

        {ended.length > 0 && (
          <>
            <div className="day-rail">
              <span className="lbl" style={{ color: "var(--muted)" }}>สิ้นสุดแล้ว</span>
              <span className="ln"></span><span className="cnt">{ended.length} รายการ</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: .82 }}>
              {ended.map(card)}
            </div>
          </>
        )}

        {/* Admin CTA — hide when already logged in */}
        {!auth && (
          <div className="card" style={{ marginTop: 34, padding: "20px 24px", display: "flex",
            alignItems: "center", gap: 16, flexWrap: "wrap",
            background: "var(--blue-50)", borderColor: "var(--blue-100)" }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--blue)",
              display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <IcoShield size={22} stroke="#fff" />
            </span>
            <div className="grow">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>
                เป็นเจ้าหน้าที่ผู้จัดการประชุม?
              </div>
              <div className="muted" style={{ fontSize: 14 }}>
                เข้าสู่ระบบเพื่อสร้าง แก้ไข และจัดการวาระการประชุมทั้งหมด
              </div>
            </div>
            <button className="btn btn-primary" onClick={onGoLogin}>
              <IcoLock size={17} stroke="#fff" /> เข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Meeting detail ============ */
function MeetingDetail({ meeting, auth, onBack, admin, onEdit, onDelete, onGoLogin }) {
  const now = useNow(1000);
  if (!meeting) return null;
  const s = new Date(meeting.start), e = new Date(meeting.end);
  const status = meetingStatus(meeting, now);
  const dept = deptById(meeting.dept);
  const pf = PLATFORMS[meeting.platform] || PLATFORMS.other;
  const [copied, setCopied] = useStateP(false);

  const copyLink = () => {
    navigator.clipboard && navigator.clipboard.writeText(meeting.link);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="page">
      <button className="btn btn-soft btn-sm" onClick={onBack} style={{ marginBottom: 20 }}>
        <IcoChevL size={16} /> ย้อนกลับ
      </button>

      <div className="detail-grid">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <span className="chip" style={{ background: "#fff", border: `1px solid ${dept.color}33`, color: dept.color }}>
              <span className="dot" style={{ background: dept.color }}></span>{dept.name}
            </span>
            <StatusPill status={status} start={meeting.start} end={meeting.end} now={now} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.5px", lineHeight: 1.2, margin: "0 0 14px" }}>
            {meeting.title}
          </h1>
          {meeting.description && (
            <p className="muted" style={{ fontSize: 15.5, lineHeight: 1.65, margin: "0 0 8px" }}>
              {meeting.description}
            </p>
          )}

          <div className="card" style={{ padding: "6px 22px", marginTop: 20 }}>
            <div className="kv"><span className="k"><IcoCalendar size={16} /> วันที่</span><span className="v">{fmtDateLong(s)}</span></div>
            <div className="kv"><span className="k"><IcoClock size={16} /> เวลา</span><span className="v">{fmtTime(s)} – {fmtTime(e)} น. <span className="muted">({fmtDuration(s, e)})</span></span></div>
            <div className="kv"><span className="k"><IcoVideo size={16} /> แพลตฟอร์ม</span><span className="v"><PlatformBadge platform={meeting.platform} /></span></div>
            {meeting.location && <div className="kv"><span className="k"><IcoPin size={16} /> สถานที่/ห้อง</span><span className="v">{meeting.location}</span></div>}
            <div className="kv"><span className="k"><IcoUser size={16} /> ผู้จัด/ประธาน</span><span className="v">{meeting.organizer}</span></div>
            {meeting.invitees && <div className="kv"><span className="k"><IcoUsers size={16} /> ผู้เข้าร่วม</span><span className="v">{meeting.invitees}</span></div>}
          </div>

          {meeting.attachments && meeting.attachments.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
                เอกสารวาระการประชุม
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {meeting.attachments.map((f, i) => (
                  <div className="file-row" key={i}>
                    <span className="f-ic"><IcoFile size={18} /></span>
                    <div className="grow"><div className="f-name">{f.name}</div><div className="f-size">{f.size}</div></div>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => alert("ตัวอย่าง: เริ่มดาวน์โหลด " + f.name)}>
                      <IcoDownload size={16} /> ดาวน์โหลด
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* sidebar */}
        <div style={{ position: "sticky", top: 84, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 22, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: pf.color,
              margin: "0 auto 14px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <pf.Icon size={26} stroke="#fff" />
            </div>

            {status === "live" && (
              <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>การประชุมกำลังดำเนินอยู่</div>
            )}
            {status === "upcoming" && (() => {
              const msLeft  = new Date(meeting.start) - now;
              const isReady = msLeft <= READY_MS;
              return isReady
                ? <div style={{ fontSize: 13.5, marginBottom: 6, color: "var(--blue)", fontWeight: 600 }}>
                    เปิดลิงก์ล่วงหน้า · เริ่มในอีก{" "}
                    <span className="countdown">{countdownTo(s, now).text}</span>
                  </div>
                : <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>
                    เริ่มในอีก <span className="countdown" style={{ color:"var(--amber)" }}>{countdownTo(s, now).text}</span>
                  </div>;
            })()}
            {status === "ended" && (
              <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>การประชุมสิ้นสุดแล้ว</div>
            )}

            <div style={{ display: "flex", justifyContent: "center", marginBottom: status !== "live" ? 14 : 0 }}>
              <JoinLink meeting={meeting} now={now} size="btn-lg"
                auth={auth} onLoginRequired={onGoLogin} />
            </div>

            {/* Hint text below the join button */}
            {status === "live" && !auth && (
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 10 }}>
                กรุณา<button className="btn btn-soft btn-sm" style={{ padding:"3px 10px", margin:"0 4px" }}
                  onClick={onGoLogin}>เข้าสู่ระบบ</button>ก่อนเข้าร่วมประชุม
              </div>
            )}
            {status !== "live" && (
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                {status === "upcoming"
                  ? "ลิงก์เข้าร่วมจะเปิดใช้งานอัตโนมัติเมื่อถึงเวลาประชุม"
                  : "ลิงก์จะถูกซ่อนภายใน 1 ชั่วโมงหลังการประชุมสิ้นสุด"}
              </div>
            )}

            {status !== "expired" && auth && (
              <button className="btn btn-soft btn-sm" style={{ marginTop: 14, width: "100%" }} onClick={copyLink}>
                {copied ? <><IcoCheck size={16} /> คัดลอกแล้ว</> : <><IcoCopy size={16} /> คัดลอกลิงก์</>}
              </button>
            )}
          </div>

          {admin && (
            <div className="card" style={{ padding: 16, display: "flex", gap: 10 }}>
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
    </div>
  );
}

Object.assign(window, { PublicAgenda, MeetingDetail });
