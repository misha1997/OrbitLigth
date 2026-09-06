// Inline SVG icons for the admin dashboard — same pattern as lib/icons.js
// (24x24 viewBox, stroke=currentColor so CSS can tint them). Kept separate
// from lib/icons.js since these are admin-only and would otherwise bloat
// the public site's icon set.
const base = (w, h) => ({
  width: w, height: h, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round", strokeLinejoin: "round",
});

export function GridIcon({ size = 18, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function NewspaperIcon({ size = 18, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M4 5h13a2 2 0 012 2v11a1.5 1.5 0 01-1.5 1.5H6a2 2 0 01-2-2V5z" />
      <path d="M4 5v13a2 2 0 002 2" />
      <path d="M8 9h6M8 12.5h6M8 16h4" />
    </svg>
  );
}

export function UsersIcon({ size = 18, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 4.3c1.5.4 2.6 1.7 2.6 3.3 0 1.6-1.1 2.9-2.6 3.3" />
      <path d="M19 14.8c1.8.6 3 2.3 3 4.2" />
    </svg>
  );
}

export function ImageIcon({ size = 18, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.7" />
      <path d="M21 16l-5.5-5.5a1.5 1.5 0 00-2.1 0L4 19" />
    </svg>
  );
}

export function SparkleIcon({ size = 18, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M12 3l1.6 4.7L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.3L12 3z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

export function SearchIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

export function LogOutIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H9" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 14, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

export function PencilIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function TrashIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" />
      <path d="M6 7l1 12.5A2 2 0 009 21.5h6a2 2 0 002-2L18 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function PlusIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function UploadIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  );
}

export function RefreshIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M3 12a9 9 0 0115.4-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function ActivityIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M3 12h4l2.5-7L14 19l2.5-7H21" />
    </svg>
  );
}

export function TrendingUpIcon({ size = 16, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 6h6v6" />
    </svg>
  );
}

export function UserCircleIcon({ size = 20, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.2 18.5a6 6 0 0111.6 0" />
    </svg>
  );
}
