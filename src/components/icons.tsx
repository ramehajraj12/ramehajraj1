import React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: P, children: React.ReactNode) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  );
}

// Brand mark: sigma inside an axis frame
export const LogoMark = ({ size = 26, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...rest}>
    <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#1b44cc" />
    <path d="M7 24V9h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 24l6-15" stroke="#8fabf7" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="21" cy="12" r="1.8" fill="#f4b63f" stroke="none" />
    <circle cx="24" cy="19" r="1.8" fill="#fff" stroke="none" opacity="0.85" />
  </svg>
);

export const ISigma = (p: P) => base(p, <><path d="M17 6H7.5L13 12l-5.5 6H17" /><path d="M17 6h.01M17 18h.01" strokeWidth={2.4} /></>);
export const IBell = (p: P) => base(p, <><path d="M3 18c2.5 0 3-9 6-9s3.5 12 6 12 3-6 6-6" /><path d="M3 20h18" opacity={0.5} /></>);
export const IScatter = (p: P) => base(p, <><path d="M4 4v16h16" /><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="7" r="1.3" fill="currentColor" stroke="none" /><path d="M7 16L19 6" strokeDasharray="2 2.4" /></>);
export const IBars = (p: P) => base(p, <><path d="M4 20V10M9.3 20V4M14.6 20v-8M20 20V7" /></>);
export const ICal = (p: P) => base(p, <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>);
export const IClock = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IUser = (p: P) => base(p, <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.3-3.4 3.9-5 7-5s5.7 1.6 7 5" /></>);
export const IUsers = (p: P) => base(p, <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c1-3 3.1-4.5 5.5-4.5s4.5 1.5 5.5 4.5" /><path d="M15.5 5.8a3.2 3.2 0 010 5.9M17 15.3c1.8.6 3 2 3.6 4.2" /></>);
export const IFolder = (p: P) => base(p, <><path d="M3.5 6.5A1.5 1.5 0 015 5h4l2 2.5h8A1.5 1.5 0 0120.5 9v9A1.5 1.5 0 0119 19.5H5A1.5 1.5 0 013.5 18z" /></>);
export const IFile = (p: P) => base(p, <><path d="M6 3.5h8L19 8.5V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M14 3.5V9h5" /></>);
export const IUpload = (p: P) => base(p, <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 15.5V19a1.5 1.5 0 001.5 1.5h12A1.5 1.5 0 0019.5 19v-3.5" /></>);
export const IDownload = (p: P) => base(p, <><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 15.5V19A1.5 1.5 0 006 20.5h12a1.5 1.5 0 001.5-1.5v-3.5" /></>);
export const IEuro = (p: P) => base(p, <><path d="M17.5 6.5a6.5 6.5 0 100 11" /><path d="M4.5 10.5h9M4.5 13.5h8" /></>);
export const IInvoice = (p: P) => base(p, <><path d="M6 3.5h12V21l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>);
export const IStar = ({ filled, ...p }: P & { filled?: boolean }) => base({ ...p, fill: filled ? "currentColor" : "none" }, <path d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6L3.8 9.5l5.7-.7z" />);
export const ICheck = (p: P) => base(p, <path d="M4.5 12.5l5 5L19.5 7" />);
export const IX = (p: P) => base(p, <path d="M6 6l12 12M18 6L6 18" />);
export const IChevD = (p: P) => base(p, <path d="M6 9.5l6 6 6-6" />);
export const IChevR = (p: P) => base(p, <path d="M9.5 6l6 6-6 6" />);
export const IChevL = (p: P) => base(p, <path d="M14.5 6l-6 6 6 6" />);
export const IPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IMinus = (p: P) => base(p, <path d="M5 12h14" />);
export const ISearch = (p: P) => base(p, <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>);
export const ISettings = (p: P) => base(p, <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></>);
export const IShield = (p: P) => base(p, <><path d="M12 3.5l7 2.6v5.2c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2V6.1z" /><path d="M9 12l2 2 4-4.5" /></>);
export const IMail = (p: P) => base(p, <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>);
export const IVideo = (p: P) => base(p, <><rect x="3.5" y="6.5" width="12" height="11" rx="2" /><path d="M15.5 10.5l5-3v9l-5-3" /></>);
export const IEdit = (p: P) => base(p, <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17z" /><path d="M14.5 7.5l3 3" /></>);
export const ITrash = (p: P) => base(p, <><path d="M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l1 13h9l1-13" /><path d="M10 10.5v5.5M14 10.5v5.5" /></>);
export const IEye = (p: P) => base(p, <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>);
export const IFilter = (p: P) => base(p, <path d="M4 6h16M7 12h10M10 18h4" />);
export const ILogout = (p: P) => base(p, <><path d="M14.5 8V5.5A1.5 1.5 0 0013 4H6a1.5 1.5 0 00-1.5 1.5v13A1.5 1.5 0 006 20h7a1.5 1.5 0 001.5-1.5V16" /><path d="M9.5 12H21M17.5 8.5L21 12l-3.5 3.5" /></>);
export const IMenu = (p: P) => base(p, <path d="M4 6.5h16M4 12h16M4 17.5h16" />);
export const IArrowR = (p: P) => base(p, <path d="M4 12h16M14 6l6 6-6 6" />);
export const IWarn = (p: P) => base(p, <><path d="M12 4L2.8 19.5h18.4z" /><path d="M12 10v4M12 16.8v.01" strokeWidth={2.2} /></>);
export const IInfo = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8v.01" strokeWidth={2.2} /></>);
export const IBriefcase = (p: P) => base(p, <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V6a2 2 0 012-2h2a2 2 0 012 2v1.5M3.5 12.5h17" /></>);
export const IFlask = (p: P) => base(p, <><path d="M9.5 3.5h5M10.5 3.5v5L5 18a1.7 1.7 0 001.6 2.5h10.8A1.7 1.7 0 0019 18L13.5 8.5v-5" /><path d="M7.5 14.5h9" /></>);
export const IDoc = (p: P) => base(p, <><path d="M6 3.5h8L19 8.5V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M14 3.5V9h5M8.5 13h7M8.5 16.5h7" /></>);
export const IGrid = (p: P) => base(p, <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>);
export const IBell2 = (p: P) => base(p, <><path d="M12 4a5.5 5.5 0 015.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0112 4z" /><path d="M10 18.5a2 2 0 004 0" /></>);
export const ILink = (p: P) => base(p, <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2" /></>);
export const IGlobe = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c-2.5 2.6-3.8 5.4-3.8 8.5s1.3 5.9 3.8 8.5c2.5-2.6 3.8-5.4 3.8-8.5S14.5 6.1 12 3.5z" /></>);
export const ITrend = (p: P) => base(p, <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M6.5 15l4-5 3 2.5L18 7" /><circle cx="18" cy="7" r="1.4" fill="currentColor" stroke="none" /></>);
export const IQueue = (p: P) => base(p, <><path d="M4 7h12M4 12h12M4 17h8" /><path d="M18 14v6M15 17h6" /></>);
export const ISpark = (p: P) => base(p, <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></>);
export const IRefresh = (p: P) => base(p, <><path d="M20 12a8 8 0 11-2.3-5.6" /><path d="M20 3.5V8h-4.5" /></>);
export const IKey = (p: P) => base(p, <><circle cx="8" cy="15" r="4.5" /><path d="M11.5 11.5L20 3M17 6l2.5 2.5M14.5 8.5L17 11" /></>);
export const IGraduation = (p: P) => base(p, <><path d="M12 4L2.5 8.5 12 13l9.5-4.5z" /><path d="M6.5 10.5v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5" /><path d="M21.5 8.5v5" /></>);
export const IPrint = (p: P) => base(p, <><path d="M7 8V3.5h10V8" /><rect x="4" y="8" width="16" height="8" rx="1.5" /><path d="M7 13h10v7H7z" /></>);
export const IActivity = (p: P) => base(p, <path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" />);
export const IPhone = (p: P) => base(p, <path d="M7.5 3.5h3L12 8l-2.2 1.6a12 12 0 004.6 4.6L16 12l4.5 1.5v3a2 2 0 01-2.2 2A15.5 15.5 0 015.5 5.7a2 2 0 012-2.2z" />);
export const IGoogle = ({ size = 18, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 01-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.81z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0012 24z" />
    <path fill="#FBBC05" d="M5.27 14.27A7.2 7.2 0 014.9 12c0-.79.14-1.56.37-2.27v-3.1H1.29a12 12 0 000 10.75l3.98-3.11z" />
    <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0012 0 12 12 0 001.29 6.63l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
  </svg>
);
