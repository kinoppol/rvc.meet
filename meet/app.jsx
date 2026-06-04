/* app.jsx — shell, routing, topbar. PHP API-backed version. */
const { useState: useSt, useEffect: useEf, useRef: useRf } = React;

/* ── Theme management ─────────────────────────────── */
const THEME_CYCLE  = ['system', 'light', 'dark'];
const THEME_LABELS = { system: 'อัตโนมัติ (ระบบ)', light: 'โหมดสว่าง', dark: 'โหมดมืด' };
const THEME_ICONS  = { system: IcoMonitor, light: IcoSun, dark: IcoMoon };

function resolveTheme(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', resolveTheme(mode));
}
/* Apply saved theme immediately (before React mounts) */
applyTheme(localStorage.getItem('theme') || 'system');

/* ── Permission helpers ──────────────────────────────────── */
const isAdmin     = (auth) => auth?.permission === 'admin';
const canManage   = (auth) => auth?.permission === 'admin' || auth?.permission === 'organizer';

/* ── Session countdown helper ────────────────────────────── */
function fmtRemaining(expireAt) {
  if (!expireAt) return null;
  const secs = Math.floor(expireAt - Date.now() / 1000);
  if (secs <= 0) return "หมดอายุแล้ว";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0)  return `${d} วัน ${h} ชั่วโมง`;
  if (h > 0)  return `${h} ชั่วโมง ${m} นาที`;
  return `${m} นาที`;
}

/* ── User dropdown ───────────────────────────────────────── */
function UserDropdown({ auth, expireAt, onLogout }) {
  const [open, setOpen] = useSt(false);
  const now             = useNow(60000);  // อัพเดตทุก 1 นาที
  const ref             = useRf(null);

  /* ปิด dropdown เมื่อคลิกนอก */
  useEf(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const remaining = expireAt ? fmtRemaining(expireAt) : null;
  const permMeta  = PERM_META[auth.permission] || PERM_META.staff;

  return (
    <div className="user-dd-wrap" ref={ref}>
      {/* Trigger: avatar + chevron เท่านั้น — ไม่มีข้อความล้น */}
      <button className="user-dd-trigger" onClick={() => setOpen(o => !o)}
        title={auth.name}>
        <Avatar name={auth.name} />
        <IcoChevDown size={12} stroke="var(--muted)" style={{
          transition:"transform .2s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          flexShrink: 0,
        }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="user-dd-panel">
          {/* Header */}
          <div className="user-dd-header">
            <Avatar name={auth.name} size={40} />
            <div style={{ minWidth:0, flex:1 }}>
              <div className="user-dd-name">{auth.name}</div>
              <div className="user-dd-username">{auth.username}</div>
              <span className="user-dd-badge" style={{ color: permMeta.color }}>
                {permMeta.label}
              </span>
            </div>
          </div>

          {/* Session info */}
          <div className="user-dd-section">
            <hr className="user-dd-sep" />
            {remaining ? (
              <div className="user-dd-session-box">
                <IcoClock size={16} stroke="var(--blue)" style={{ flexShrink:0, marginTop:2 }} />
                <div>
                  <div className="s-label">ลงชื่อค้างไว้ · หมดอายุใน</div>
                  <div className="s-time">{remaining}</div>
                  <div className="s-hint">ต่ออายุอัตโนมัติเมื่อเข้าใช้งาน</div>
                </div>
              </div>
            ) : (
              <div className="user-dd-temp-box">
                <IcoClock size={16} stroke="var(--muted)" style={{ flexShrink:0 }} />
                <div>
                  <div style={{ fontWeight:500, fontSize:13 }}>เซสชันชั่วคราว</div>
                  <div style={{ fontSize:11.5, marginTop:2 }}>ออกจากระบบเมื่อปิดเบราว์เซอร์</div>
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button className="user-dd-logout" onClick={() => { setOpen(false); onLogout(); }}>
            <IcoLogout size={15} /> ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Topbar ──────────────────────────────────────────────── */
function Topbar({ auth, expireAt, view, go, onLogout, theme, onCycleTheme }) {
  const now   = useNow(1000);
  const ThIco = THEME_ICONS[theme] || IcoMonitor;

  const navItems = [
    ["agenda",    "วาระวันนี้",    IcoCalendar],
    ...(canManage(auth) ? [["dashboard", "จัดการประชุม", IcoList]] : []),
    ["calendar",  "ปฏิทิน",       IcoGrid],
    ...(isAdmin(auth)   ? [["users",     "จัดการผู้ใช้",  IcoUsers]] : []),
  ];

  return (
    <div className="topbar">
      <div className="brand" onClick={() => go(canManage(auth) ? "dashboard" : "agenda")}>
        <img src="logo.png" alt="logo" style={{ width:42, height:42, objectFit:"contain", flexShrink:0 }} />
        <div>
          <div className="brand-name">RVCMeet</div>
          <div className="brand-sub">ระบบประชุมออนไลน์สถานศึกษา</div>
        </div>
      </div>

      {auth && (
        <div className="nav">
          {navItems.map(([k, l, Ic]) => (
            <a key={k} className={view === k ? "active" : ""} onClick={() => go(k)}>
              <Ic size={18} /><span className="nlabel">{l}</span>
            </a>
          ))}
        </div>
      )}

      <div className="spacer"></div>

      <div className="clock">
        <span className="t">{fmtTime(now)} น.</span>
        <span className="d">{fmtDateShort(now)} {now.getFullYear() + 543}</span>
      </div>

      <button className="icon-btn theme-btn" onClick={onCycleTheme} title={THEME_LABELS[theme]}>
        <ThIco size={19} />
      </button>

      {auth ? (
        <UserDropdown auth={auth} expireAt={expireAt} onLogout={onLogout} />
      ) : (
        <button className="btn btn-primary" style={{ marginLeft:8 }} onClick={() => go("login")}>
          <IcoLock size={17} stroke="#fff" /> เข้าสู่ระบบ
        </button>
      )}
    </div>
  );
}

/* ── Loading screen ──────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", flexDirection:"column", gap:18, background:"var(--bg)" }}>
      <span style={{ width:52, height:52, borderRadius:14, background:"var(--blue)",
        display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
        <IcoVideo size={26} stroke="#fff" />
      </span>
      <div style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:19,
        color:"var(--ink-2)" }}>กำลังโหลด RVCMeet…</div>
      <div className="muted" style={{ fontSize:14 }}>กำลังเชื่อมต่อฐานข้อมูล</div>
    </div>
  );
}

/* ── Error screen ────────────────────────────────────────── */
function ErrorScreen({ message }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"var(--bg)", padding:24 }}>
      <div className="card" style={{ padding:36, maxWidth:500, textAlign:"center" }}>
        <div style={{ width:60, height:60, borderRadius:18, background:"var(--red-50)",
          display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
          <IcoX size={28} stroke="var(--red)" />
        </div>
        <h2 style={{ fontFamily:"var(--font-display)", margin:"0 0 10px", color:"var(--red)" }}>
          เชื่อมต่อไม่ได้
        </h2>
        <p className="muted" style={{ lineHeight:1.65, margin:"0 0 24px", fontSize:14.5 }}>
          {message}
        </p>
        <a href="install.php" className="btn btn-primary btn-lg">
          ไปที่หน้าติดตั้งระบบ →
        </a>
      </div>
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────── */
function App() {
  const [meetings,  setMeetings]  = useSt([]);
  const [auth,      setAuth]      = useSt(null);
  const [expireAt,  setExpireAt]  = useSt(null);   // Unix timestamp (วินาที) สำหรับ remember-me
  const [view,      setView]      = useSt("agenda");
  const [selected, setSelected] = useSt(null);
  const [editing,  setEditing]  = useSt(null);
  const [toast,    setToast]    = useSt("");
  const [confirm,  setConfirm]  = useSt(null);
  const [loading,  setLoading]  = useSt(true);
  const [apiError, setApiError] = useSt(null);
  const [theme,    setTheme]    = useSt(localStorage.getItem('theme') || 'system');

  /* Apply theme + listen for system preference changes */
  useEf(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
    if (theme !== 'system') return;
    const mq  = window.matchMedia('(prefers-color-scheme: dark)');
    const fn  = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  /* Load auth + meetings on mount */
  useEf(() => {
    Promise.all([
      fetch("api/auth.php",     { credentials:"same-origin" }).then(r => r.json()),
      fetch("api/meetings.php", { credentials:"same-origin" }).then(r => r.json()),
    ])
      .then(([authRes, meetRes]) => {
        if (authRes.success && authRes.data.user) {
          setAuth(authRes.data.user);
          if (authRes.data.expire_at) setExpireAt(authRes.data.expire_at);
        }
        if (meetRes.success) setMeetings(meetRes.data);
        else setApiError("โหลดข้อมูลไม่ได้: " + (meetRes.error ?? ""));
      })
      .catch(() => setApiError(
        "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ — กรุณาตรวจสอบการติดตั้งและการตั้งค่าฐานข้อมูล"
      ))
      .finally(() => setLoading(false));
  }, []);

  const go        = (v) => { window.scrollTo(0, 0); setView(v); };
  const showToast = (m) => setToast(m);

  /* ── Auth ── */
  const doLogin = (user, ea = null) => {
    setAuth(user);
    if (ea) setExpireAt(ea);
    go(user.permission === 'staff' ? "agenda" : "dashboard");
    showToast("เข้าสู่ระบบสำเร็จ");
  };

  const doLogout = async () => {
    await fetch("api/auth.php", { method:"DELETE", credentials:"same-origin" }).catch(() => {});
    setAuth(null);
    setExpireAt(null);
    go("agenda");
  };

  /* ── Navigation ── */
  const openDetail = (m) => { setSelected(m); go("detail"); };
  const startNew   = ()  => { setEditing(null); go("form"); };
  const startEdit  = (m) => { setEditing(m); go("form"); };

  /* ── Meeting CRUD ── */
  const saveMeeting = async (m) => {
    const isEdit = editing !== null;
    const url    = isEdit ? `api/meetings.php?id=${encodeURIComponent(m.id)}` : "api/meetings.php";
    try {
      const res  = await fetch(url, {
        method:      isEdit ? "PUT" : "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "same-origin",
        body:        JSON.stringify(m),
      });
      const data = await res.json();
      if (data.success) {
        setMeetings(prev => {
          const exists = prev.some(x => x.id === data.data.id);
          return exists
            ? prev.map(x => x.id === data.data.id ? data.data : x)
            : [...prev, data.data];
        });
        showToast(isEdit ? "บันทึกการแก้ไขแล้ว" : "สร้างการประชุมเรียบร้อย");
        setEditing(null);
        go("dashboard");
      } else {
        showToast("เกิดข้อผิดพลาด: " + (data.error ?? ""));
      }
    } catch {
      showToast("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };

  const askDelete = (m) => setConfirm(m);

  const confirmDelete = async () => {
    const target = confirm;
    setConfirm(null);
    try {
      const res  = await fetch(`api/meetings.php?id=${encodeURIComponent(target.id)}`, {
        method:      "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        setMeetings(prev => prev.filter(x => x.id !== target.id));
        if (selected?.id === target.id) setSelected(null);
        showToast("ลบการประชุมแล้ว");
        if (view === "detail") go(canManage(auth) ? "dashboard" : "agenda");
      } else {
        showToast("เกิดข้อผิดพลาด: " + (data.error ?? ""));
      }
    } catch {
      showToast("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };

  /* ── Route guards ── */
  useEf(() => {
    if (!auth) {
      // ต้อง login ก่อนเข้า admin views
      if (["dashboard","calendar","form","users"].includes(view)) go("login");
    } else if (auth.permission === 'staff') {
      // staff เข้า management pages ไม่ได้
      if (["dashboard","form","users"].includes(view)) go("agenda");
    } else if (!isAdmin(auth)) {
      // organizer เข้าหน้า users ไม่ได้
      if (view === "users") go("dashboard");
    }
  }, [auth, view]);

  const liveSelected = selected
    ? (meetings.find(m => m.id === selected.id) || selected)
    : null;

  /* ── Render ── */
  if (loading)  return <LoadingScreen />;
  if (apiError) return <ErrorScreen message={apiError} />;

  return (
    <div className="app">
      {view !== "login" && (
        <Topbar auth={auth} expireAt={expireAt} view={view} go={go} onLogout={doLogout}
          theme={theme} onCycleTheme={cycleTheme} />
      )}

      {view === "agenda"    && <PublicAgenda meetings={meetings} auth={auth} onOpen={openDetail} onGoLogin={() => go("login")} />}
      {view === "login"     && <Login onLogin={doLogin} onBack={() => go("agenda")} />}
      {view === "dashboard" && canManage(auth) && <Dashboard meetings={meetings} auth={auth} onOpen={openDetail} onNew={startNew} onEdit={startEdit} onDelete={askDelete} />}
      {view === "calendar"  && auth && <Calendar meetings={meetings} onOpen={openDetail} />}
      {view === "form"      && canManage(auth) && <MeetingForm initial={editing} onSave={saveMeeting} onCancel={() => go("dashboard")} />}
      {view === "detail"    && <MeetingDetail meeting={liveSelected} auth={auth} onBack={() => go(canManage(auth) ? "dashboard" : "agenda")} admin={canManage(auth)} onEdit={startEdit} onDelete={askDelete} onGoLogin={() => go("login")} />}
      {view === "users"     && isAdmin(auth) && <UserManagement currentUser={auth} />}

      {confirm && (
        <ConfirmModal
          title="ยืนยันการลบการประชุม"
          body={`ต้องการลบ "${confirm.title}" ออกจากระบบหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          confirmLabel="ลบการประชุม"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      <Toast msg={toast} onDone={() => setToast("")} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
