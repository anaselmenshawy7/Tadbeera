import { useId } from 'react';
import type { ActiveTab } from '../app/navigation';

export interface ClayIconProps {
  className?: string;
  active?: boolean;
}

function sanitizeId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * 1. Home (الرئيسية): Elegant soft-3D rose & cream home emblem.
 */
export function Home3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const roofGrad = `${uid}-roof`;
  const wallGrad = `${uid}-wall`;
  const doorGrad = `${uid}-door`;
  const glowGrad = `${uid}-glow`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={roofGrad} x1="10" y1="7" x2="38" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#EAA5B6' : '#F3DCE2'} />
          <stop offset="55%" stopColor={active ? '#D47E93' : '#E2BAC4'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C99AA6'} />
        </linearGradient>
        <linearGradient id={wallGrad} x1="12" y1="19" x2="36" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="58%" stopColor={active ? '#FFF1E8' : '#FFF8FA'} />
          <stop offset="100%" stopColor={active ? '#FADDE4' : '#F3DCE2'} />
        </linearGradient>
        <linearGradient id={doorGrad} x1="20" y1="26" x2="28" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#D47E93' : '#C89EA9'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#B58B96'} />
        </linearGradient>
        <radialGradient id={glowGrad} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#E8D5CB'} />
        </radialGradient>
      </defs>

      {/* Soft porcelain ground shadow */}
      <ellipse cx="24" cy="41.8" rx="14.5" ry="3.2" fill="#4A353B" fillOpacity={active ? '0.13' : '0.07'} />

      {/* Plump cream house body */}
      <rect
        x="11"
        y="20"
        width="26"
        height="20.5"
        rx="6.5"
        fill={`url(#${wallGrad})`}
        stroke={active ? '#F3DCE2' : '#E9D2D8'}
        strokeWidth="1"
      />
      {/* Left specular glaze highlight */}
      <path
        d="M13.5 23.5C13.5 22.1 14.6 21 16 21H20"
        stroke="#FFFFFF"
        strokeOpacity="0.88"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Chimney */}
      <rect
        x="30"
        y="10.5"
        width="5"
        height="8"
        rx="2"
        fill={active ? '#D47E93' : '#D9B6BF'}
      />

      {/* Sculpted dusty-rose roof */}
      <path
        d="M7.8 22.2C6.9 21.4 7 19.9 8 19.1L21.5 8.1C23 6.9 25 6.9 26.5 8.1L40 19.1C41 19.9 41.1 21.4 40.2 22.2C39.3 23.1 37.9 23.1 37 22.3L24 11.8L11 22.3C10.1 23.1 8.7 23.1 7.8 22.2Z"
        fill={`url(#${roofGrad})`}
      />
      {/* Roof top sheen */}
      <path
        d="M11 19.3L22.6 10C23.4 9.3 24.6 9.3 25.4 10L30 13.7"
        stroke="#FFF8FA"
        strokeOpacity="0.65"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Warm cream & rose emblem medallion window */}
      <circle cx="24" cy="21" r="3.1" fill={`url(#${glowGrad})`} stroke="#FFFFFF" strokeWidth="0.9" />

      {/* Arched doorway with champagne-gold handle */}
      <path
        d="M19.5 40.5V31.5C19.5 29 21.5 27 24 27C26.5 27 28.5 29 28.5 31.5V40.5H19.5Z"
        fill={`url(#${doorGrad})`}
      />
      <circle cx="26.3" cy="34.2" r="1.05" fill={active ? '#D9AE72' : '#E7D6CB'} />

      {/* Subtle sage leaf ornament beside porch */}
      <path
        d="M15.2 38.2C13.7 37.8 13.1 36.2 13.9 35.1C15.1 35.3 16.1 36.6 15.2 38.2Z"
        fill={active ? '#A8B8A0' : '#C8CFC5'}
      />
    </svg>
  );
}

/**
 * 2. Kitchen (المطبخ): Glossy cream-white ceramic cooking pot with dusty-rose handles and lid,
 *    delicate steam puffs, and subtle rose details.
 */
export function Kitchen3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const potGrad = `${uid}-pot`;
  const lidGrad = `${uid}-lid`;
  const knobGrad = `${uid}-knob`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={potGrad} x1="11" y1="20" x2="37" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#FFF1E8" />
          <stop offset="100%" stopColor={active ? '#FADDE4' : '#F3DCE2'} />
        </linearGradient>
        <linearGradient id={lidGrad} x1="12" y1="13" x2="36" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#ECAAB9' : '#F3DCE2'} />
          <stop offset="55%" stopColor={active ? '#D47E93' : '#DFBBC4'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C79FA9'} />
        </linearGradient>
        <radialGradient id={knobGrad} cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#FFF1E8" />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#D8C7B6'} />
        </radialGradient>
      </defs>

      {/* Ambient base shadow */}
      <ellipse cx="24" cy="41.5" rx="14.5" ry="3" fill="#4A353B" fillOpacity={active ? '0.13' : '0.07'} />

      {/* Delicate steam puffs */}
      <path
        d="M19 11.2C18.2 9.9 19.6 8.5 18.8 7"
        stroke={active ? '#D47E93' : '#C6B0B6'}
        strokeOpacity="0.7"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M24.2 10.3C23.3 8.8 25 7.4 24.1 5.6"
        stroke={active ? '#C96D84' : '#C6B0B6'}
        strokeOpacity="0.75"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M29.4 11.3C28.7 10 30 8.6 29.3 7.2"
        stroke={active ? '#D47E93' : '#C6B0B6'}
        strokeOpacity="0.65"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Dusty-rose ceramic side handles */}
      <path
        d="M11 23.2H8.4C7 23.2 6 24.3 6 25.6C6 26.9 7 28 8.4 28H11"
        stroke={active ? '#C96D84' : '#CEABB4'}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M37 23.2H39.6C41 23.2 42 24.3 42 25.6C42 26.9 41 28 39.6 28H37"
        stroke={active ? '#C96D84' : '#CEABB4'}
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Cream-white glossy ceramic pot body */}
      <path
        d="M10.5 22.5H37.5V31.5C37.5 36.7 33.2 40.2 27.5 40.2H20.5C14.8 40.2 10.5 36.7 10.5 31.5V22.5Z"
        fill={`url(#${potGrad})`}
        stroke={active ? '#F3DCE2' : '#E7CFD6'}
        strokeWidth="1"
      />

      {/* Subtle rose band & emblem detail on ceramic belly */}
      <rect x="11" y="22.8" width="26" height="2.4" rx="1.2" fill={active ? '#FADDE4' : '#F3DCE2'} />
      <path
        d="M24 34.4C24 34.4 21.1 32.6 21.1 30.8C21.1 29.8 21.9 29.1 22.8 29.1C23.4 29.1 23.8 29.4 24 29.8C24.2 29.4 24.6 29.1 25.2 29.1C26.1 29.1 26.9 29.8 26.9 30.8C26.9 32.6 24 34.4 24 34.4Z"
        fill={active ? '#D47E93' : '#D5B2BC'}
      />

      {/* Left porcelain gloss reflection */}
      <path
        d="M14 26.2V32.4C14 34 15 35.4 16.4 36.2"
        stroke="#FFFFFF"
        strokeOpacity="0.9"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Champagne-gold lid knob */}
      <circle cx="24" cy="14" r="2.7" fill={`url(#${knobGrad})`} stroke="#FFFFFF" strokeWidth="0.8" />

      {/* Domed dusty-rose ceramic lid */}
      <path
        d="M9.5 21.6C9.5 17.8 15.8 15.4 24 15.4C32.2 15.4 38.5 17.8 38.5 21.6C38.5 22.7 37.6 23.4 36.5 23.4H11.5C10.4 23.4 9.5 22.7 9.5 21.6Z"
        fill={`url(#${lidGrad})`}
      />
      {/* Specular lid highlight */}
      <path
        d="M14 19.6C16.5 18 19.8 17.3 23 17.2"
        stroke="#FFF8FA"
        strokeOpacity="0.72"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3. Household (البيت): Cream-colored miniature house with dusty-rose roof,
 *    champagne-gold window details, warm glowing windows, and a matching alarm bell.
 */
export function Household3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const houseGrad = `${uid}-house`;
  const roofGrad = `${uid}-roof`;
  const winGlow = `${uid}-winglow`;
  const bellGrad = `${uid}-bell`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={houseGrad} x1="8" y1="20" x2="34" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#FFF1E8" />
          <stop offset="100%" stopColor={active ? '#FADDE4' : '#F3DCE2'} />
        </linearGradient>
        <linearGradient id={roofGrad} x1="6" y1="9" x2="34" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#EAA5B6' : '#F3DCE2'} />
          <stop offset="55%" stopColor={active ? '#D47E93' : '#DFBAC3'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C9A1AC'} />
        </linearGradient>
        <radialGradient id={winGlow} cx="0.5" cy="0.45" r="0.65">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="60%" stopColor={active ? '#FFF1E8' : '#FFF8FA'} />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#E3D3C8'} />
        </radialGradient>
        <linearGradient id={bellGrad} x1="30" y1="8" x2="43" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#E8C590' : '#E8D9CA'} />
          <stop offset="55%" stopColor={active ? '#D9AE72' : '#D5C5B6'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C3A4AD'} />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="21.5" cy="41.8" rx="14" ry="3" fill="#4A353B" fillOpacity={active ? '0.13' : '0.07'} />

      {/* Cream miniature house body */}
      <rect
        x="8"
        y="21"
        width="25.5"
        height="19.5"
        rx="5.5"
        fill={`url(#${houseGrad})`}
        stroke={active ? '#F3DCE2' : '#E7CFD6'}
        strokeWidth="1"
      />

      {/* Dusty-rose roof */}
      <path
        d="M5.6 22.8C4.8 22.1 4.9 20.8 5.8 20L18.2 10.1C19.6 9 21.5 9 22.9 10.1L35.3 20C36.2 20.8 36.3 22.1 35.5 22.8C34.7 23.6 33.4 23.6 32.5 22.9L20.55 13.3L8.6 22.9C7.7 23.6 6.4 23.6 5.6 22.8Z"
        fill={`url(#${roofGrad})`}
      />
      <path
        d="M9 19.9L19.4 11.7C20 11.2 21 11.2 21.7 11.7L25 14.3"
        stroke="#FFF8FA"
        strokeOpacity="0.65"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Warm glowing windows with champagne-gold frames */}
      <rect
        x="11.4"
        y="25.5"
        width="6.8"
        height="6.8"
        rx="1.8"
        fill={`url(#${winGlow})`}
        stroke={active ? '#D9AE72' : '#D8C5B6'}
        strokeWidth="1.2"
      />
      <path d="M14.8 25.8V32M11.7 28.9H17.9" stroke={active ? '#D9AE72' : '#D8C5B6'} strokeWidth="0.9" />

      <rect
        x="23.2"
        y="25.5"
        width="6.8"
        height="6.8"
        rx="1.8"
        fill={`url(#${winGlow})`}
        stroke={active ? '#D9AE72' : '#D8C5B6'}
        strokeWidth="1.2"
      />
      <path d="M26.6 25.8V32M23.5 28.9H29.7" stroke={active ? '#D9AE72' : '#D8C5B6'} strokeWidth="0.9" />

      {/* Warm rose door */}
      <path
        d="M17.8 40.5V35.2C17.8 33.7 19 32.5 20.5 32.5C22 32.5 23.2 33.7 23.2 35.2V40.5H17.8Z"
        fill={active ? '#D47E93' : '#CEABB4'}
      />

      {/* Matching alarm bell tucked on upper right roof */}
      <g>
        <circle cx="36.2" cy="14.8" r="7" fill="#FFF8FA" fillOpacity="0.72" />
        {/* Tiny sound rings */}
        <path
          d="M41.5 10.6C42.6 11.8 43.1 13.3 42.8 14.9"
          stroke={active ? '#D9AE72' : '#CBB8AC'}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        {/* Bell dome */}
        <path
          d="M36.2 9.2C33.4 9.2 31.6 11.3 31.6 14.2V16.6L30.2 18.2C29.9 18.6 30.2 19.2 30.7 19.2H41.7C42.2 19.2 42.5 18.6 42.2 18.2L40.8 16.6V14.2C40.8 11.3 39 9.2 36.2 9.2Z"
          fill={`url(#${bellGrad})`}
          stroke="#FFFFFF"
          strokeWidth="0.75"
        />
        <circle cx="36.2" cy="20.4" r="1.4" fill={active ? '#C96D84' : '#B998A1'} />
        <path
          d="M33.4 13.6C33.6 12.1 34.4 11.1 35.6 10.7"
          stroke="#FFFFFF"
          strokeOpacity="0.8"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * 4. Shopping (التسوق): Powder-pink shopping basket containing a realistic tomato,
 *    fresh sage-green vegetables, and a warm cream bread loaf.
 */
export function Shopping3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const basketGrad = `${uid}-basket`;
  const rimGrad = `${uid}-rim`;
  const breadGrad = `${uid}-bread`;
  const tomatoGrad = `${uid}-tomato`;
  const sageGrad = `${uid}-sage`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={basketGrad} x1="10" y1="22" x2="38" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#FADDE4' : '#FAF0F3'} />
          <stop offset="60%" stopColor={active ? '#E8A8B7' : '#EDD0D8'} />
          <stop offset="100%" stopColor={active ? '#D47E93' : '#D3AAB5'} />
        </linearGradient>
        <linearGradient id={rimGrad} x1="7" y1="19" x2="41" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#F6C2D0' : '#F3DCE2'} />
          <stop offset="100%" stopColor={active ? '#D47E93' : '#D2A8B3'} />
        </linearGradient>
        <linearGradient id={breadGrad} x1="25" y1="10" x2="38" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="48%" stopColor="#FFF1E8" />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#DFC9AA'} />
        </linearGradient>
        <radialGradient id={tomatoGrad} cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor={active ? '#F29A9F' : '#EAC0C4'} />
          <stop offset="55%" stopColor={active ? '#D95E6A' : '#CF8E95'} />
          <stop offset="100%" stopColor={active ? '#B84452' : '#B77880'} />
        </radialGradient>
        <linearGradient id={sageGrad} x1="10" y1="10" x2="23" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#C2D0BA' : '#D5DDD1'} />
          <stop offset="100%" stopColor={active ? '#8FA385' : '#AEB9A8'} />
        </linearGradient>
      </defs>

      {/* Ambient shadow */}
      <ellipse cx="24" cy="41.6" rx="14.5" ry="3" fill="#4A353B" fillOpacity={active ? '0.13' : '0.07'} />

      {/* Warm cream bread loaf peeking out on the right */}
      <g transform="rotate(14 31 16)">
        <rect
          x="24.5"
          y="10.2"
          width="12.5"
          height="13.5"
          rx="6.2"
          fill={`url(#${breadGrad})`}
          stroke={active ? '#D9AE72' : '#D8C5B0'}
          strokeWidth="0.9"
        />
        <path d="M28 13.5L32.8 14.8M27.5 17L32.5 18.2" stroke={active ? '#D9AE72' : '#D5C3B0'} strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Fresh sage-green leafy vegetables on the left */}
      <path
        d="M12.5 21.5C9.8 18.2 10.6 13.2 14.3 11.4C17.4 10 20.6 12.1 21.4 15.8L22.2 21.5H12.5Z"
        fill={`url(#${sageGrad})`}
      />
      <path
        d="M16.2 20.8C15.5 16.5 17.8 12.2 21.4 11.5C23.8 11 25.5 12.8 25.5 16.2L24.8 21.5H16.2Z"
        fill={active ? '#A8B8A0' : '#C2CEC0'}
      />
      <path d="M15.4 14.2L17.4 19.4" stroke="#FFF8FA" strokeOpacity="0.65" strokeWidth="1.1" strokeLinecap="round" />

      {/* Plump glossy tomato tucked center-left */}
      <circle cx="21.5" cy="18.6" r="5.3" fill={`url(#${tomatoGrad})`} />
      {/* Tomato calyx */}
      <path
        d="M19.8 14.2C20.8 14.7 22.2 14.7 23.2 14.2M21.5 12.8V14.7"
        stroke={active ? '#8FA385' : '#A9B5A4'}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Specular shine on tomato */}
      <circle cx="19.6" cy="17" r="1.2" fill="#FFF8FA" fillOpacity="0.82" />

      {/* Arched porcelain carry handle behind rim */}
      <path
        d="M15.5 21.5C15.5 15.6 19.3 11.8 24 11.8C28.7 11.8 32.5 15.6 32.5 21.5"
        stroke={active ? '#C96D84' : '#CAA3AE'}
        strokeOpacity="0.85"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Powder-pink woven ceramic basket body */}
      <path
        d="M9.5 22.5H38.5L35.4 35.8C34.8 38.4 32.5 40.2 29.8 40.2H18.2C15.5 40.2 13.2 38.4 12.6 35.8L9.5 22.5Z"
        fill={`url(#${basketGrad})`}
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="0.9"
      />

      {/* Molded clay basket ribs */}
      <path
        d="M16.8 26.8L17.8 35.8M24 26.8V35.8M31.2 26.8L30.2 35.8"
        stroke="#FFF8FA"
        strokeOpacity="0.65"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Plump basket rim */}
      <rect
        x="7.5"
        y="20.2"
        width="33"
        height="4.6"
        rx="2.3"
        fill={`url(#${rimGrad})`}
        stroke="#FFFFFF"
        strokeOpacity="0.72"
        strokeWidth="0.8"
      />
      <path d="M10.5 21.7H23" stroke="#FFF8FA" strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 5. Budget (الميزانية): Dusty-rose leather wallet with subtle stitching,
 *    champagne-gold clasp, and a dimensional Egyptian pound coin marked ج.م.
 */
export function Budget3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const walletGrad = `${uid}-wallet`;
  const flapGrad = `${uid}-flap`;
  const goldGrad = `${uid}-gold`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={walletGrad} x1="7" y1="14" x2="38" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#E8A5B5' : '#F3DCE2'} />
          <stop offset="55%" stopColor={active ? '#D47E93' : '#DCBAC3'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C59CA7'} />
        </linearGradient>
        <linearGradient id={flapGrad} x1="7" y1="13" x2="33" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#F0B6C4' : '#F6E4E9'} />
          <stop offset="100%" stopColor={active ? '#D47E93' : '#D9B5BF'} />
        </linearGradient>
        <radialGradient id={goldGrad} cx="0.35" cy="0.32" r="0.68">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="35%" stopColor={active ? '#F1D4A3' : '#EFE0CA'} />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#D0BC9F'} />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="22.5" cy="41.6" rx="15" ry="3" fill="#4A353B" fillOpacity={active ? '0.13' : '0.07'} />

      {/* Warm cream bill edge peeking at top of wallet */}
      <rect
        x="11.5"
        y="12.5"
        width="17"
        height="7"
        rx="2.5"
        fill="#FFF1E8"
        stroke={active ? '#A8B8A0' : '#C8D0C4'}
        strokeWidth="0.9"
      />

      {/* Dusty-rose leather wallet body */}
      <rect
        x="7"
        y="16.5"
        width="29"
        height="23"
        rx="6"
        fill={`url(#${walletGrad})`}
        stroke="#FFFFFF"
        strokeOpacity="0.5"
        strokeWidth="0.9"
      />

      {/* Subtle cream stitching along edges */}
      <rect
        x="9.3"
        y="18.8"
        width="24.4"
        height="18.4"
        rx="4.2"
        stroke="#FFF8FA"
        strokeOpacity="0.6"
        strokeWidth="1"
        strokeDasharray="2.2 2"
      />

      {/* Upper wallet flap */}
      <path
        d="M7 20.5C7 17.7 9.2 15.5 12 15.5H31C33.8 15.5 36 17.7 36 20.5V22.5C36 24.4 34.4 26 32.5 26H10.5C8.6 26 7 24.4 7 22.5V20.5Z"
        fill={`url(#${flapGrad})`}
      />
      <path d="M10.5 17.4H24" stroke="#FFF8FA" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />

      {/* Champagne-gold wallet clasp */}
      <rect
        x="19.2"
        y="23.2"
        width="10.2"
        height="6.4"
        rx="3.2"
        fill={`url(#${goldGrad})`}
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="0.8"
      />
      <circle cx="24.3" cy="26.4" r="1.35" fill="#4A353B" fillOpacity={active ? '0.68' : '0.45'} />

      {/* Dimensional Egyptian Pound Coin marked ج.م */}
      <g>
        <circle
          cx="35"
          cy="17"
          r="9"
          fill={`url(#${goldGrad})`}
          stroke="#FFFFFF"
          strokeWidth="1.1"
        />
        <circle
          cx="35"
          cy="17"
          r="6.7"
          stroke="#4A353B"
          strokeOpacity="0.24"
          strokeWidth="0.9"
          strokeDasharray="1.8 1.4"
        />
        <text
          x="35"
          y="19.6"
          textAnchor="middle"
          fill="#4A353B"
          fillOpacity={active ? '0.92' : '0.68'}
          fontSize="7.4"
          fontWeight="800"
          fontFamily="Cairo, sans-serif"
        >
          ج.م
        </text>
      </g>
    </svg>
  );
}

/**
 * 6. Household Tasks (مهام البيت): Warm cream porcelain clipboard with sage checkmarks and dusty-rose clip.
 */
export function Tasks3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const boardGrad = `${uid}-board`;
  const clipGrad = `${uid}-clip`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={boardGrad} x1="11" y1="10" x2="37" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#FFF1E8" />
          <stop offset="100%" stopColor={active ? '#FADDE4' : '#F3DCE2'} />
        </linearGradient>
        <linearGradient id={clipGrad} x1="17" y1="6" x2="31" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#EAA5B6' : '#E7CFD6'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C7A2AC'} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.8" rx="13" ry="2.8" fill="#4A353B" fillOpacity="0.12" />
      <rect x="11" y="10.5" width="26" height="29.5" rx="6" fill={`url(#${boardGrad})`} stroke="#F3DCE2" strokeWidth="1" />
      <rect x="17.5" y="7" width="13" height="6" rx="3" fill={`url(#${clipGrad})`} stroke="#FFFFFF" strokeWidth="0.8" />
      <path d="M16 20.5L18.2 22.7L22 18.7" stroke={active ? '#A8B8A0' : '#B9C4B4'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24.5" y="19.6" width="8.5" height="2.6" rx="1.3" fill={active ? '#D47E93' : '#CFA8B2'} />
      <path d="M16 28.5L18.2 30.7L22 26.7" stroke={active ? '#A8B8A0' : '#B9C4B4'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24.5" y="27.6" width="7" height="2.6" rx="1.3" fill={active ? '#E8A8B7' : '#D9BCC4'} />
      <path d="M14 14.5V23" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 7. Savings (أهداف التوفير / التحويش): Champagne-gold coins stacked with a dusty-rose gem accent.
 */
export function SavingsGold3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const goldGrad = `${uid}-gold`;
  const rimGrad = `${uid}-rim`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={goldGrad} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="40%" stopColor={active ? '#F1D4A3' : '#EDE0CC'} />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#CEBC9F'} />
        </radialGradient>
        <linearGradient id={rimGrad} x1="10" y1="22" x2="36" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#E8C590' : '#E3D4C0'} />
          <stop offset="100%" stopColor={active ? '#C99654' : '#BFA98B'} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.5" rx="14" ry="2.9" fill="#4A353B" fillOpacity="0.12" />
      {/* Stacked bottom champagne-gold cylinders */}
      <ellipse cx="21" cy="35" rx="11.5" ry="4.5" fill={`url(#${rimGrad})`} />
      <ellipse cx="21" cy="32.5" rx="11.5" ry="4.5" fill={`url(#${goldGrad})`} stroke="#FFFFFF" strokeWidth="0.75" />
      <ellipse cx="21" cy="27.5" rx="11.5" ry="4.5" fill={`url(#${rimGrad})`} />
      <ellipse cx="21" cy="25" rx="11.5" ry="4.5" fill={`url(#${goldGrad})`} stroke="#FFFFFF" strokeWidth="0.75" />
      {/* Upright EGP coin */}
      <circle cx="31.5" cy="18.5" r="9.5" fill={`url(#${goldGrad})`} stroke="#FFFFFF" strokeWidth="1.1" />
      <circle cx="31.5" cy="18.5" r="7" stroke="#4A353B" strokeOpacity="0.22" strokeWidth="0.9" strokeDasharray="1.8 1.4" />
      <text x="31.5" y="21.2" textAnchor="middle" fill="#4A353B" fillOpacity="0.9" fontSize="7.5" fontWeight="800" fontFamily="Cairo, sans-serif">
        ج.م
      </text>
      {/* Tiny dusty-rose sparkle */}
      <path d="M12 13L13.2 15.6L15.8 16.8L13.2 18L12 20.6L10.8 18L8.2 16.8L10.8 15.6Z" fill={active ? '#D47E93' : '#CFA8B2'} />
    </svg>
  );
}

/**
 * 8. Alarm Bell (التنبيهات والتذكيرات): Sculpted champagne-gold & dusty-rose 3D bell.
 */
export function AlarmBell3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const bellGrad = `${uid}-bell`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={bellGrad} x1="12" y1="10" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF1E8" />
          <stop offset="45%" stopColor={active ? '#E8C590' : '#E7D8C5'} />
          <stop offset="100%" stopColor={active ? '#D9AE72' : '#CEBC9F'} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.5" rx="13" ry="2.8" fill="#4A353B" fillOpacity="0.12" />
      <path d="M11 16.5C9.5 19.2 9.5 22.4 10.8 25" stroke={active ? '#D47E93' : '#CBB2B9'} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M37 16.5C38.5 19.2 38.5 22.4 37.2 25" stroke={active ? '#D47E93' : '#CBB2B9'} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="9.8" r="2.6" fill={active ? '#D47E93' : '#CFA8B2'} />
      <path
        d="M24 11.5C17.6 11.5 13.8 16.2 13.8 22.6V27.6L10.8 31.4C10.1 32.3 10.8 33.6 11.9 33.6H36.1C37.2 33.6 37.9 32.3 37.2 31.4L34.2 27.6V22.6C34.2 16.2 30.4 11.5 24 11.5Z"
        fill={`url(#${bellGrad})`}
        stroke="#FFFFFF"
        strokeWidth="1"
      />
      <circle cx="24" cy="36.2" r="3.4" fill={active ? '#C96D84' : '#BA959F'} stroke="#FFFFFF" strokeWidth="0.8" />
      <path d="M17.4 22C17.7 18.3 19.6 15.8 22.2 14.8" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 9. Calendar (خطة الأسبوع / دورة الراتب): Cream & dusty-rose 3D desk calendar.
 */
export function Calendar3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const cardGrad = `${uid}-card`;
  const topGrad = `${uid}-top`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={cardGrad} x1="9" y1="13" x2="39" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#FFF1E8" />
          <stop offset="100%" stopColor={active ? '#FADDE4' : '#F3DCE2'} />
        </linearGradient>
        <linearGradient id={topGrad} x1="9" y1="11" x2="39" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#EAA5B6' : '#E7CFD6'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C7A2AC'} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.6" rx="14" ry="2.8" fill="#4A353B" fillOpacity="0.12" />
      <rect x="9" y="12.5" width="30" height="27.5" rx="6.5" fill={`url(#${cardGrad})`} stroke="#F3DCE2" strokeWidth="1" />
      <path d="M9 19C9 15.4 11.9 12.5 15.5 12.5H32.5C36.1 12.5 39 15.4 39 19V21.2H9V19Z" fill={`url(#${topGrad})`} />
      <rect x="16" y="8.5" width="3.5" height="7" rx="1.75" fill={active ? '#D9AE72' : '#D5C3AC'} stroke="#FFFFFF" strokeWidth="0.7" />
      <rect x="28.5" y="8.5" width="3.5" height="7" rx="1.75" fill={active ? '#D9AE72' : '#D5C3AC'} stroke="#FFFFFF" strokeWidth="0.7" />
      <circle cx="17.5" cy="27.5" r="2.2" fill={active ? '#D47E93' : '#CFB0B8'} />
      <circle cx="24" cy="27.5" r="2.2" fill={active ? '#A8B8A0' : '#BCC6B7'} />
      <circle cx="30.5" cy="27.5" r="2.2" fill={active ? '#D9AE72' : '#D2C0A6'} />
      <circle cx="17.5" cy="34" r="2.2" fill={active ? '#FADDE4' : '#E8D5DA'} />
      <circle cx="24" cy="34" r="2.2" fill={active ? '#D47E93' : '#CFB0B8'} />
    </svg>
  );
}

/**
 * 10. Voice Mic (مساعد الوصفات الصوتي): Powder-pink & cream ceramic microphone with gold capsule.
 */
export function VoiceMic3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const capGrad = `${uid}-cap`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={capGrad} x1="17" y1="8" x2="31" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF1E8" />
          <stop offset="45%" stopColor={active ? '#F0B2C1' : '#F3DCE2'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C59EA8'} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.8" rx="11" ry="2.6" fill="#4A353B" fillOpacity="0.12" />
      <rect x="18" y="8" width="12" height="19" rx="6" fill={`url(#${capGrad})`} stroke="#FFFFFF" strokeWidth="0.9" />
      <path d="M20.5 14H24.5M20.5 18H25.5" stroke="#FFF8FA" strokeOpacity="0.85" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 22C13.5 27.8 18.2 32.2 24 32.2C29.8 32.2 34.5 27.8 34.5 22" stroke={active ? '#D9AE72' : '#CEBC9F'} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M24 32.5V38.5M18.5 39H29.5" stroke={active ? '#C96D84' : '#BA959F'} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 11. Bookmark (المحفوظات): Dusty-rose ribbon bookmark with champagne-gold star medallion.
 */
export function Bookmark3DIcon({ className = 'w-6 h-6', active = true }: ClayIconProps) {
  const uid = sanitizeId(useId());
  const ribbonGrad = `${uid}-ribbon`;

  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={ribbonGrad} x1="13" y1="8" x2="35" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#F0B6C4' : '#F3DCE2'} />
          <stop offset="55%" stopColor={active ? '#D47E93' : '#DCBAC3'} />
          <stop offset="100%" stopColor={active ? '#C96D84' : '#C59CA7'} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.8" rx="11.5" ry="2.6" fill="#4A353B" fillOpacity="0.12" />
      <path
        d="M14 12.5C14 9.7 16.2 7.5 19 7.5H29C31.8 7.5 34 9.7 34 12.5V38.2C34 39.4 32.7 40.1 31.7 39.4L24 34.2L16.3 39.4C15.3 40.1 14 39.4 14 38.2V12.5Z"
        fill={`url(#${ribbonGrad})`}
        stroke="#FFFFFF"
        strokeWidth="0.9"
      />
      <circle cx="24" cy="19.5" r="4.8" fill={active ? '#D9AE72' : '#D5C3AC'} stroke="#FFF8FA" strokeWidth="1" />
      <path d="M17.2 12V24" stroke="#FFF8FA" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Unified Tab Icon Dispatcher preserving exact tab IDs.
 */
export function TadbeeraNav3DIcon({
  tabId,
  active = true,
  className = 'w-7 h-7',
}: {
  tabId: ActiveTab;
  active?: boolean;
  className?: string;
}) {
  switch (tabId) {
    case 'home':
    case 'daily':
      return <Home3DIcon active={active} className={className} />;
    case 'food':
      return <Kitchen3DIcon active={active} className={className} />;
    case 'household':
      return <Household3DIcon active={active} className={className} />;
    case 'saved':
      return <Shopping3DIcon active={active} className={className} />;
    case 'budget':
      return <Budget3DIcon active={active} className={className} />;
  }
}
