import React from "react";

export default function EclipseGraphic({ type, size = 120 }) {
  switch (type) {
    case "sun_total":
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Повне сонячне затемнення">
          <defs>
            <radialGradient id="solar-corona-outer" cx="50%" cy="50%" r="50%">
              <stop offset="40%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#ffe680" stopOpacity="0.55" />
              <stop offset="80%" stopColor="#4fd1c5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#070914" stopOpacity="0" />
            </radialGradient>
            <filter id="corona-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
            <radialGradient id="diamond-sparkle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#fff5cc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffe680" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#solar-corona-outer)" />
          <g filter="url(#corona-blur)" opacity="0.65">
            <path d="M 50 6 L 52 50 L 50 94 L 48 50 Z" fill="#ffffff" />
            <path d="M 6 50 L 50 52 L 94 50 L 50 48 Z" fill="#ffffff" />
            <path d="M 18 18 L 50 49 L 82 82 L 49 50 Z" fill="#ffe680" />
            <path d="M 82 18 L 51 50 L 18 82 L 50 51 Z" fill="#ffe680" />
          </g>
          <circle cx="50" cy="50" r="32" fill="#060713" />
          <circle cx="50" cy="50" r="32.5" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
          <circle cx="72" cy="28" r="8" fill="url(#diamond-sparkle)" />
          <circle cx="72" cy="28" r="2.5" fill="#ffffff" />
        </svg>
      );

    case "sun_partial":
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Часткове сонячне затемнення">
          <defs>
            <radialGradient id="sun-body-glow" cx="45%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#ffea75" />
              <stop offset="75%" stopColor="#ffaa1a" />
              <stop offset="100%" stopColor="#e06500" />
            </radialGradient>
            <radialGradient id="sun-outer-halo" cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#ffa012" stopOpacity="0.35" />
              <stop offset="90%" stopColor="#ff6200" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ff6200" stopOpacity="0" />
            </radialGradient>
            <clipPath id="sun-clip">
              <circle cx="50" cy="50" r="36" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#sun-outer-halo)" />
          <g clipPath="url(#sun-clip)">
            <circle cx="50" cy="50" r="36" fill="url(#sun-body-glow)" />
            <circle cx="34" cy="38" r="34" fill="#060713" />
          </g>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#ffe066" strokeWidth="0.8" strokeOpacity="0.4" />
        </svg>
      );

    case "sun_annular":
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Кільцеве сонячне затемнення">
          <defs>
            <radialGradient id="annular-glow" cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#ff9900" stopOpacity="0.4" />
              <stop offset="85%" stopColor="#ff4400" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ff2200" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="annular-fire" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#ffffff" />
              <stop offset="85%" stopColor="#ffcc00" />
              <stop offset="100%" stopColor="#ff5500" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#annular-glow)" />
          <circle cx="50" cy="50" r="36" fill="url(#annular-fire)" />
          <circle cx="50" cy="50" r="30.5" fill="#060713" />
          <circle cx="50" cy="50" r="31" fill="none" stroke="#fff8db" strokeWidth="1" strokeOpacity="0.9" />
        </svg>
      );

    case "moon_total":
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Повне місячне затемнення">
          <defs>
            <radialGradient id="blood-glow" cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#ff451a" stopOpacity="0.22" />
              <stop offset="90%" stopColor="#c23214" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ff451a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blood-surface" cx="42%" cy="40%" r="62%">
              <stop offset="0%" stopColor="#ff6538" />
              <stop offset="38%" stopColor="#db3b16" />
              <stop offset="72%" stopColor="#8c1c08" />
              <stop offset="100%" stopColor="#400c04" />
            </radialGradient>
            <clipPath id="moon-total-clip">
              <circle cx="50" cy="50" r="36" />
            </clipPath>
            <filter id="blood-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#blood-glow)" />
          <g clipPath="url(#moon-total-clip)">
            <circle cx="50" cy="50" r="36" fill="url(#blood-surface)" />
            <path d="M 38 34 Q 45 28 52 32 Q 58 36 55 44 Q 50 48 42 43 Z" fill="#290602" opacity="0.45" filter="url(#blood-blur)" />
            <path d="M 52 50 Q 62 48 64 56 Q 60 64 50 62 Q 45 57 52 50 Z" fill="#290602" opacity="0.4" filter="url(#blood-blur)" />
            <path d="M 32 54 Q 38 52 40 60 Q 36 67 30 65 Z" fill="#290602" opacity="0.35" filter="url(#blood-blur)" />
          </g>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#ff8563" strokeWidth="0.8" strokeOpacity="0.45" />
        </svg>
      );

    case "moon_penumbral":
    case "moon_partial":
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Часткове місячне затемнення">
          <defs>
            <radialGradient id="lunar-ambient-glow" cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="90%" stopColor="#e8e6d8" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#e8e6d8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="moon-full-sphere" cx="42%" cy="40%" r="62%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="42%" stopColor="#f0ece1" />
              <stop offset="78%" stopColor="#d6d1c2" />
              <stop offset="100%" stopColor="#aba596" />
            </radialGradient>
            <radialGradient id="earth-shadow-umbra" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#1a0604" stopOpacity="0.98" />
              <stop offset="48%" stopColor="#3d120a" stopOpacity="0.95" />
              <stop offset="82%" stopColor="#6e2216" stopOpacity="0.90" />
              <stop offset="100%" stopColor="#8c2e1f" stopOpacity="0.75" />
            </radialGradient>
            <clipPath id="moon-partial-clip">
              <circle cx="50" cy="50" r="36" />
            </clipPath>
            <filter id="lunar-soft-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#lunar-ambient-glow)" />
          <g clipPath="url(#moon-partial-clip)">
            <circle cx="50" cy="50" r="36" fill="url(#moon-full-sphere)" />
            <path d="M 38 34 Q 45 28 52 32 Q 58 36 55 44 Q 50 48 42 43 Z" fill="#8f8979" opacity="0.28" filter="url(#lunar-soft-blur)" />
            <path d="M 52 50 Q 62 48 64 56 Q 60 64 50 62 Q 45 57 52 50 Z" fill="#8f8979" opacity="0.25" filter="url(#lunar-soft-blur)" />
            <path d="M 32 54 Q 38 52 40 60 Q 36 67 30 65 Z" fill="#8f8979" opacity="0.22" filter="url(#lunar-soft-blur)" />

            <circle cx="36" cy="38" r="42" fill="#5e1b10" opacity="0.45" filter="url(#lunar-soft-blur)" />
            <circle cx="32" cy="34" r="40" fill="url(#earth-shadow-umbra)" filter="url(#lunar-soft-blur)" />
            <circle cx="28" cy="30" r="36" fill="#120402" opacity="0.88" filter="url(#lunar-soft-blur)" />
          </g>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.25" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Місяць">
          <defs>
            <radialGradient id="moon-def-sphere" cx="42%" cy="40%" r="62%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="42%" stopColor="#f0ece1" />
              <stop offset="78%" stopColor="#d6d1c2" />
              <stop offset="100%" stopColor="#aba596" />
            </radialGradient>
            <radialGradient id="moon-def-glow" cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#e8e6d8" stopOpacity="0" />
            </radialGradient>
            <clipPath id="moon-def-clip">
              <circle cx="50" cy="50" r="36" />
            </clipPath>
            <filter id="moon-def-blur">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#moon-def-glow)" />
          <g clipPath="url(#moon-def-clip)">
            <circle cx="50" cy="50" r="36" fill="url(#moon-def-sphere)" />
            <path d="M 38 34 Q 45 28 52 32 Q 58 36 55 44 Q 50 48 42 43 Z" fill="#8f8979" opacity="0.28" filter="url(#moon-def-blur)" />
            <path d="M 52 50 Q 62 48 64 56 Q 60 64 50 62 Q 45 57 52 50 Z" fill="#8f8979" opacity="0.25" filter="url(#moon-def-blur)" />
            <path d="M 32 54 Q 38 52 40 60 Q 36 67 30 65 Z" fill="#8f8979" opacity="0.22" filter="url(#moon-def-blur)" />
          </g>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.25" />
        </svg>
      );
  }
}
