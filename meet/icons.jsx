/* icons.jsx — SVG icons (UI + platforms). Exports to window. */
const Ico = ({ d, size = 20, fill = "none", stroke = "currentColor", sw = 1.8, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={children ? stroke : (fill === "none" ? stroke : "none")}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children || <path d={d} />}
  </svg>
);

/* ---- UI icons (line) ---- */
const IcoCalendar = (p) => <Ico {...p}><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></Ico>;
const IcoClock = (p) => <Ico {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Ico>;
const IcoVideo = (p) => <Ico {...p}><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10l6-3.2v10.4l-6-3.2"/></Ico>;
const IcoUsers = (p) => <Ico {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17 14c2.6.4 4 2.2 4 5"/></Ico>;
const IcoUser = (p) => <Ico {...p}><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.4 3-6 7-6s7 2.6 7 6"/></Ico>;
const IcoPin = (p) => <Ico {...p}><path d="M12 21c5-4.6 7-8 7-11a7 7 0 1 0-14 0c0 3 2 6.4 7 11Z"/><circle cx="12" cy="10" r="2.6"/></Ico>;
const IcoLink = (p) => <Ico {...p}><path d="M10 13.5a4 4 0 0 0 5.7.3l3-3a4 4 0 1 0-5.7-5.7l-1.6 1.6"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-3 3a4 4 0 1 0 5.7 5.7l1.6-1.6"/></Ico>;
const IcoFile = (p) => <Ico {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></Ico>;
const IcoDownload = (p) => <Ico {...p}><path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/></Ico>;
const IcoPlus = (p) => <Ico {...p}><path d="M12 5v14M5 12h14"/></Ico>;
const IcoSearch = (p) => <Ico {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></Ico>;
const IcoEdit = (p) => <Ico {...p}><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4z"/></Ico>;
const IcoTrash = (p) => <Ico {...p}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></Ico>;
const IcoChevL = (p) => <Ico {...p}><path d="M15 5l-7 7 7 7"/></Ico>;
const IcoChevR = (p) => <Ico {...p}><path d="M9 5l7 7-7 7"/></Ico>;
const IcoChevDown = (p) => <Ico {...p}><path d="M5 9l7 7 7-7"/></Ico>;
const IcoArrowR = (p) => <Ico {...p}><path d="M4 12h15M13 5l7 7-7 7"/></Ico>;
const IcoCheck = (p) => <Ico {...p}><path d="M5 12.5l4.5 4.5L19 6.5"/></Ico>;
const IcoCheckCircle = (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.6 2.6L16 9.5"/></Ico>;
const IcoX = (p) => <Ico {...p}><path d="M6 6l12 12M18 6L6 18"/></Ico>;
const IcoLock = (p) => <Ico {...p}><rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></Ico>;
const IcoLogout = (p) => <Ico {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 12H3m0 0l3.5-3.5M3 12l3.5 3.5"/></Ico>;
const IcoBuilding = (p) => <Ico {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></Ico>;
const IcoList = (p) => <Ico {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></Ico>;
const IcoGrid = (p) => <Ico {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></Ico>;
const IcoBell = (p) => <Ico {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></Ico>;
const IcoSparkle = (p) => <Ico {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></Ico>;
const IcoShield = (p) => <Ico {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></Ico>;
const IcoCopy = (p) => <Ico {...p}><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></Ico>;
const IcoEye = (p) => <Ico {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></Ico>;

/* ---- Platform brand glyphs ---- */
const PfMeet = (p) => <Ico {...p}><rect x="2.5" y="7" width="12" height="10" rx="2.5"/><path d="M14.5 10.5l5-3v9l-5-3"/></Ico>;
const PfZoom = (p) => <Ico {...p}><rect x="2.5" y="7" width="12" height="10" rx="3"/><path d="M14.5 10l5-2.6v9.2L14.5 14"/></Ico>;
const PfWebex = (p) => <Ico {...p}><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0M12 12v4"/></Ico>;
const PfTeams = (p) => <Ico {...p}><circle cx="16.5" cy="7" r="2.4"/><rect x="3" y="8" width="9" height="9" rx="2"/><path d="M5.5 11h4M7.5 11v4"/><path d="M13 9.5h6.5a1 1 0 0 1 1 1V15a3 3 0 0 1-3 3h-.5"/></Ico>;
const PfOther = (p) => <Ico {...p}><path d="M10 13.5a4 4 0 0 0 5.7.3l3-3a4 4 0 1 0-5.7-5.7l-1.6 1.6"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-3 3a4 4 0 1 0 5.7 5.7l1.6-1.6"/></Ico>;

const PLATFORMS = {
  meet:  { key: "meet",  label: "Google Meet", color: "var(--meet)",  Icon: PfMeet },
  zoom:  { key: "zoom",  label: "Zoom",        color: "var(--zoom)",  Icon: PfZoom },
  webex: { key: "webex", label: "Webex",       color: "var(--webex)", Icon: PfWebex },
  teams: { key: "teams", label: "MS Teams",    color: "var(--teams)", Icon: PfTeams },
  other: { key: "other", label: "ลิงก์อื่น ๆ", color: "var(--other)", Icon: PfOther },
};

Object.assign(window, {
  Ico, PLATFORMS,
  IcoCalendar, IcoClock, IcoVideo, IcoUsers, IcoUser, IcoPin, IcoLink, IcoFile,
  IcoDownload, IcoPlus, IcoSearch, IcoEdit, IcoTrash, IcoChevL, IcoChevR, IcoChevDown,
  IcoArrowR, IcoCheck, IcoCheckCircle, IcoX, IcoLock, IcoLogout, IcoBuilding, IcoList,
  IcoGrid, IcoBell, IcoSparkle, IcoShield, IcoCopy, IcoEye,
  PfMeet, PfZoom, PfWebex, PfTeams, PfOther,
});
