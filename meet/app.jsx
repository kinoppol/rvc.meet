/* app.jsx — shell, routing, topbar. PHP API-backed version. */
const { useState: useSt, useEffect: useEf } = React;

/* ── Topbar ──────────────────────────────────────────────── */
function Topbar({ auth, view, go, onLogout }) {
  const now = useNow(1000);
  const navItems = [
    ["agenda",    "วาระวันนี้",    IcoCalendar],
    ["dashboard", "จัดการประชุม", IcoList],
    ["calendar",  "ปฏิทิน",       IcoGrid],
  ];
  return (
    <div className="topbar">
      <div className="brand" onClick={() => go(auth ? "dashboard" : "agenda")}>
        <span style={{ width:38, height:38, borderRadius:11, background:"var(--blue)",
          display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
          <IcoVideo size={21} stroke="#fff" />
        </span>
        <div>
          <div className="brand-name">SimpleMeet</div>
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

      {auth ? (
        <div className="row" style={{ gap:10, marginLeft:8 }}>
          <div style={{ textAlign:"right", lineHeight:1.2 }}>
            <div style={{ fontSize:13.5, fontWeight:600 }}>{auth.name}</div>
            <div style={{ fontSize:11.5, color:"var(--muted)" }}>{auth.role}</div>
          </div>
          <Avatar name={auth.name} />
          <button className="icon-btn" title="ออกจากระบบ" onClick={onLogout}>
            <IcoLogout size={20} />
          </button>
        </div>
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
        color:"var(--ink-2)" }}>กำลังโหลด SimpleMeet…</div>
      <div className="muted" style={{ fontSize:14 }}>กำลังเชื่อมต่อฐานข้อมูล</div>
    </div>
  );
}

/* ── Error screen (DB not configured) ───────────────────── */
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
  const [meetings, setMeetings] = useSt([]);
  const [auth,     setAuth]     = useSt(null);
  const [view,     setView]     = useSt("agenda");
  const [selected, setSelected] = useSt(null);
  const [editing,  setEditing]  = useSt(null);
  const [toast,    setToast]    = useSt("");
  const [confirm,  setConfirm]  = useSt(null);
  const [loading,  setLoading]  = useSt(true);
  const [apiError, setApiError] = useSt(null);

  /* Load auth + meetings on mount */
  useEf(() => {
    Promise.all([
      fetch("api/auth.php",     { credentials:"same-origin" }).then(r => r.json()),
      fetch("api/meetings.php", { credentials:"same-origin" }).then(r => r.json()),
    ])
      .then(([authRes, meetRes]) => {
        if (authRes.success  && authRes.data.user) setAuth(authRes.data.user);
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
  const doLogin = (user) => {
    setAuth(user);
    go("dashboard");
    showToast("เข้าสู่ระบบสำเร็จ");
  };

  const doLogout = async () => {
    await fetch("api/auth.php", { method:"DELETE", credentials:"same-origin" }).catch(() => {});
    setAuth(null);
    go("agenda");
  };

  /* ── Navigation ── */
  const openDetail = (m) => { setSelected(m); go("detail"); };
  const startNew   = ()  => { setEditing(null); go("form"); };
  const startEdit  = (m) => { setEditing(m); go("form"); };

  /* ── CRUD ── */
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
        if (view === "detail") go(auth ? "dashboard" : "agenda");
      } else {
        showToast("เกิดข้อผิดพลาด: " + (data.error ?? ""));
      }
    } catch {
      showToast("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };

  /* Guard admin views when not logged in */
  useEf(() => {
    if (!auth && ["dashboard","calendar","form"].includes(view)) go("login");
  }, [auth, view]);

  /* Keep selected fresh when a meeting is edited */
  const liveSelected = selected
    ? (meetings.find(m => m.id === selected.id) || selected)
    : null;

  /* ── Render ── */
  if (loading)  return <LoadingScreen />;
  if (apiError) return <ErrorScreen message={apiError} />;

  return (
    <div className="app">
      {view !== "login" && (
        <Topbar auth={auth} view={view} go={go} onLogout={doLogout} />
      )}

      {view === "agenda"    && <PublicAgenda meetings={meetings} auth={auth} onOpen={openDetail} onGoLogin={() => go("login")} />}
      {view === "login"     && <Login onLogin={doLogin} onBack={() => go("agenda")} />}
      {view === "dashboard" && auth && <Dashboard meetings={meetings} auth={auth} onOpen={openDetail} onNew={startNew} onEdit={startEdit} onDelete={askDelete} />}
      {view === "calendar"  && auth && <Calendar  meetings={meetings} onOpen={openDetail} />}
      {view === "form"      && auth && <MeetingForm initial={editing} onSave={saveMeeting} onCancel={() => go("dashboard")} />}
      {view === "detail"    && <MeetingDetail meeting={liveSelected} auth={auth} onBack={() => go(auth ? "dashboard" : "agenda")} admin={!!auth} onEdit={startEdit} onDelete={askDelete} onGoLogin={() => go("login")} />}

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
