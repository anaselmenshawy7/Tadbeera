import { useId } from 'react';

/**
 * Original offline-ready Powder Pink Claymorphism cooking illustration.
 * Rendered whenever no verified exact dish photo exists or when offline,
 * guaranteeing zero misleading photos of unrelated dishes.
 */
export function RecipeCookingClayArt({
  className = 'w-24 h-24',
  title = 'وصفة مطبخ تدبيرة',
}: {
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const potGrad = `pot_${uid}`;
  const lidGrad = `lid_${uid}`;
  const badgeGrad = `badge_${uid}`;
  const goldGrad = `gold_${uid}`;
  const steamGrad = `steam_${uid}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      <defs>
        <linearGradient id={badgeGrad} x1="18" y1="14" x2="104" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF1E8" />
          <stop offset="55%" stopColor="#FADDE4" />
          <stop offset="100%" stopColor="#F3DCE2" />
        </linearGradient>
        <linearGradient id={potGrad} x1="28" y1="54" x2="90" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E698AC" />
          <stop offset="55%" stopColor="#D47E93" />
          <stop offset="100%" stopColor="#C96D84" />
        </linearGradient>
        <linearGradient id={lidGrad} x1="32" y1="40" x2="88" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="100%" stopColor="#FADDE4" />
        </linearGradient>
        <linearGradient id={goldGrad} x1="50" y1="30" x2="70" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ECCB93" />
          <stop offset="100%" stopColor="#D9AE72" />
        </linearGradient>
        <linearGradient id={steamGrad} x1="60" y1="16" x2="60" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D47E93" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#D47E93" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Soft Clay Background Tile */}
      <rect x="8" y="8" width="104" height="104" rx="30" fill={`url(#${badgeGrad})`} stroke="#FFFFFF" strokeWidth="2.5" />

      {/* Warm Steam Curls */}
      <path d="M46 37C44 31 49 27 47 21" stroke={`url(#${steamGrad})`} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M60 34C58 27 64 23 61 16" stroke={`url(#${steamGrad})`} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M74 37C72 31 77 27 75 21" stroke={`url(#${steamGrad})`} strokeWidth="3.2" strokeLinecap="round" />

      {/* Wooden Ladle Handle */}
      <path d="M76 47L93 28" stroke="#D9AE72" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M76 47L93 28" stroke="#FFF1E8" strokeOpacity="0.45" strokeWidth="1.8" strokeLinecap="round" />

      {/* Clay Pot Handles */}
      <rect x="19" y="59" width="14" height="8" rx="4" fill="#C96D84" />
      <rect x="87" y="59" width="14" height="8" rx="4" fill="#C96D84" />

      {/* Clay Pot Body */}
      <path
        d="M28 56H92V78C92 89.046 83.046 98 72 98H48C36.954 98 28 89.046 28 78V56Z"
        fill={`url(#${potGrad})`}
      />
      {/* Specular Soft Highlight on Pot */}
      <path
        d="M37 64C37 73 39 83 45 88"
        stroke="#FFF8FA"
        strokeOpacity="0.45"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Pot Rim & Lid */}
      <rect x="26" y="48" width="68" height="10" rx="5" fill={`url(#${lidGrad})`} stroke="#E8A8B7" strokeWidth="1.5" />
      <path d="M35 48C39 40 49 37 60 37C71 37 81 40 85 48H35Z" fill={`url(#${lidGrad})`} stroke="#E8A8B7" strokeWidth="1.4" />

      {/* Champagne Gold Lid Knob */}
      <circle cx="60" cy="34.5" r="5" fill={`url(#${goldGrad})`} stroke="#FFF8FA" strokeWidth="1.5" />

      {/* Fresh Sage Herb Leaf Accent */}
      <path d="M32 88C27 83 25 77 31 73C36 77 37 83 32 88Z" fill="#A8B8A0" />
      <path d="M88 86C93 82 94 76 89 72C84 76 84 82 88 86Z" fill="#D9AE72" fillOpacity="0.8" />
    </svg>
  );
}
