// Line icons copied from the prototype's inline SVGs (24×24, stroked).
import type { SVGProps } from "react";
import type { CategoryIcon } from "@/lib/site-nav";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, strokeWidth = 1.8, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20.5s-7.5-4.6-9.8-9A5.2 5.2 0 0 1 12 6.3 5.2 5.2 0 0 1 21.8 11.5c-2.3 4.4-9.8 9-9.8 9z" />
  </Icon>
);

export const CartIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L21 7H6" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

const categoryPaths: Record<CategoryIcon, React.ReactNode> = {
  computers: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </>
  ),
  tablets: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  monitors: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  networking: (
    <>
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 17h.01M11 17h.01M8.5 10.5a5 5 0 0 1 7 0M5.5 7.5a9 9 0 0 1 13 0" />
    </>
  ),
  power: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  iot: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  "audio-conferencing": (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="14" r="3.5" />
      <path d="M12 7h.01" />
    </>
  ),
};

export const CategoryGlyph = ({ name, ...p }: IconProps & { name: CategoryIcon }) => (
  <Icon strokeWidth={1.7} {...p}>
    {categoryPaths[name]}
  </Icon>
);

export const ServicesIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
    <path d="M19 20a4 4 0 0 1-4 2h-2" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

// Sector icons (home "Serving every sector")
export type SectorIcon = "education" | "healthcare" | "retail" | "manufacturing" | "government" | "logistics" | "finance";

const sectorPaths: Record<SectorIcon, React.ReactNode> = {
  education: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6" />
    </>
  ),
  healthcare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  retail: (
    <>
      <path d="M6 7h12l1 13H5z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  manufacturing: (
    <>
      <path d="M3 21V10l6 3V10l6 3V6h3v15z" />
      <path d="M3 21h18" />
    </>
  ),
  government: (
    <>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18" />
    </>
  ),
  logistics: (
    <>
      <path d="M2 6h11v10H2z" />
      <path d="M13 9h4l3 3v4h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  finance: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
};

export const SectorGlyph = ({ name, ...p }: IconProps & { name: SectorIcon }) => (
  <Icon strokeWidth={1.6} {...p}>
    {sectorPaths[name]}
  </Icon>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const LeafIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" />
    <path d="M5 19c3-4 6-6 9-8" />
  </Icon>
);
