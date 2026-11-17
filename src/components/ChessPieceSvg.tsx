import React from 'react';
import { PieceColor, PieceSetId, PieceType } from '../types/chess';

interface ChessPieceSvgProps {
  type: PieceType;
  color: PieceColor;
  pieceSet: PieceSetId;
  className?: string;
}

interface Palette {
  fill: string;
  stroke: string;
  detail: string;
  strokeWidth: number;
  highlight?: string;
  gradId?: string;
}

function getPalette(color: PieceColor, pieceSet: PieceSetId, uid: string): Palette {
  const isW = color === 'w';
  switch (pieceSet) {
    case 'modern':
      return {
        fill: isW ? '#F8F8F6' : '#232428',
        stroke: isW ? '#2E2F34' : '#111214',
        detail: isW ? '#2E2F34' : '#D4D6DC',
        strokeWidth: 1.5,
      };
    case 'royal':
      return {
        fill: isW ? '#F7EFDC' : '#3B2820',
        stroke: isW ? '#4A3425' : '#1C110D',
        detail: isW ? '#7A5638' : '#E2C59B',
        strokeWidth: 1.5,
      };
    case 'bold':
      return {
        fill: isW ? '#FFFFFF' : '#18181B',
        stroke: isW ? '#18181B' : '#09090B',
        detail: isW ? '#18181B' : '#F4F4F5',
        strokeWidth: 2.3,
      };
    case 'glass':
      return {
        fill: `url(#${uid}-grad)`,
        stroke: isW ? '#B9985A' : '#8A7348',
        detail: isW ? '#7D6234' : '#F0D79E',
        strokeWidth: 1.4,
        gradId: `${uid}-grad`,
      };
    case 'staunton':
    default:
      return {
        fill: isW ? '#FFFFFF' : '#2B2B2B',
        stroke: isW ? '#222222' : '#141414',
        detail: isW ? '#222222' : '#EAEAEA',
        strokeWidth: 1.5,
      };
  }
}

export const ChessPieceSvg: React.FC<ChessPieceSvgProps> = ({
  type,
  color,
  pieceSet,
  className = 'w-full h-full',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const p = getPalette(color, pieceSet, uid);
  const isW = color === 'w';

  const defs =
    pieceSet === 'glass' ? (
      <defs>
        <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          {isW ? (
            <>
              <stop offset="0%" stopColor="#FFFDF7" />
              <stop offset="55%" stopColor="#EFE3C8" />
              <stop offset="100%" stopColor="#D7C39B" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#4A453F" />
              <stop offset="55%" stopColor="#262320" />
              <stop offset="100%" stopColor="#141210" />
            </>
          )}
        </linearGradient>
      </defs>
    ) : null;

  // Modern Minimal uses distinct geometric vector shapes
  if (pieceSet === 'modern') {
    return (
      <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
        {type === 'p' && (
          <g stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round">
            <circle cx="22.5" cy="14" r="5" fill={p.fill} />
            <path d="M16 35 L19 21 L26 21 L29 35 Z" fill={p.fill} />
            <rect x="12.5" y="35" width="20" height="4" rx="1.5" fill={p.fill} />
          </g>
        )}
        {type === 'r' && (
          <g stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round">
            <path d="M13 10 H17 V14 H20.5 V10 H24.5 V14 H28 V10 H32 V18 L29 20 V34 H16 V20 L13 18 Z" fill={p.fill} />
            <rect x="11.5" y="34" width="22" height="5" rx="1.5" fill={p.fill} />
          </g>
        )}
        {type === 'n' && (
          <g stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round">
            <path
              d="M14 35 L17 24 L12 20 L17 11 L24 9 L26 12 C31 13 33 21 31 35 Z"
              fill={p.fill}
            />
            <circle cx="19" cy="15.5" r="1.3" fill={p.detail} stroke="none" />
            <rect x="11.5" y="35" width="22" height="4.5" rx="1.5" fill={p.fill} />
          </g>
        )}
        {type === 'b' && (
          <g stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round">
            <circle cx="22.5" cy="8.5" r="2.3" fill={p.fill} />
            <path d="M22.5 11 C17 16 15.5 22 17 28 L15 35 H30 L28 28 C29.5 22 28 16 22.5 11 Z" fill={p.fill} />
            <line x1="19.5" y1="22.5" x2="25.5" y2="16.5" stroke={p.detail} strokeWidth="1.6" strokeLinecap="round" />
            <rect x="12" y="35" width="21" height="4.5" rx="1.5" fill={p.fill} />
          </g>
        )}
        {type === 'q' && (
          <g stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round">
            <path d="M10 15 L15.5 25 L17.5 12 L22.5 24 L27.5 12 L29.5 25 L35 15 L31.5 35 H13.5 Z" fill={p.fill} />
            <circle cx="10" cy="13.5" r="1.8" fill={p.fill} />
            <circle cx="17.5" cy="10.5" r="1.8" fill={p.fill} />
            <circle cx="27.5" cy="10.5" r="1.8" fill={p.fill} />
            <circle cx="35" cy="13.5" r="1.8" fill={p.fill} />
            <rect x="11.5" y="35" width="22" height="4.5" rx="1.5" fill={p.fill} />
          </g>
        )}
        {type === 'k' && (
          <g stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round">
            <line x1="22.5" y1="6" x2="22.5" y2="14" stroke={p.stroke} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="18.5" y1="9.5" x2="26.5" y2="9.5" stroke={p.stroke} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M13 18 C13 13 20 13 22.5 17 C25 13 32 13 32 18 L29.5 35 H15.5 Z" fill={p.fill} />
            <rect x="11.5" y="35" width="22" height="4.5" rx="1.5" fill={p.fill} />
          </g>
        )}
      </svg>
    );
  }

  // Classic Staunton / Royal / Bold / Glass silhouettes
  const hasRoyalCollar = pieceSet === 'royal';

  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      {defs}

      {type === 'p' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
          {hasRoyalCollar && (
            <path d="M16 26.5h13" stroke={p.detail} strokeWidth="1.3" fill="none" />
          )}
        </g>
      )}

      {type === 'r' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" />
          <path d="M34 14l-3 3H14l-3-3" />
          <path d="M31 17v12.5H14V17" />
          <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
          <path d="M11 14h23" fill="none" stroke={p.detail} strokeWidth="1.2" />
          {hasRoyalCollar && (
            <>
              <path d="M14 21h17" fill="none" stroke={p.detail} strokeWidth="1.1" />
              <path d="M14 29.5h17" fill="none" stroke={p.detail} strokeWidth="1.2" />
            </>
          )}
        </g>
      )}

      {type === 'n' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" />
          <circle cx="15" cy="15.5" r="1.1" fill={p.detail} stroke="none" />
          <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill={p.detail} stroke="none" />
          {!isW && (
            <path
              d="M24.55 10.4L24.1 11.85L24.6 12C27.75 13 30.25 14.49 32.5 18.75C34.75 23.01 35.75 29.06 35.25 39L35.2 39.5H37.45L37.5 39C38 28.94 36.62 22.15 34.25 17.66C31.88 13.17 28.46 11.02 25.06 10.5L24.55 10.4Z"
              fill={p.detail}
              stroke="none"
              opacity={0.7}
            />
          )}
          <rect x="11" y="36.5" width="27" height="2.5" rx="1" fill={p.fill} stroke={p.stroke} strokeWidth="1.2" />
        </g>
      )}

      {type === 'b' && (
        <g fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <g fill={p.fill}>
            <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
            <circle cx="22.5" cy="8" r="2.5" />
          </g>
          <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke={p.detail} strokeWidth="1.4" />
          {hasRoyalCollar && (
            <path d="M16 28h13" stroke={p.detail} strokeWidth="1.1" />
          )}
        </g>
      )}

      {type === 'q' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2.2" />
          <circle cx="14" cy="9" r="2.2" />
          <circle cx="22.5" cy="8" r="2.2" />
          <circle cx="31" cy="9" r="2.2" />
          <circle cx="39" cy="12" r="2.2" />
          <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25L7 14l2 12z" />
          <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
          <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none" stroke={p.detail} strokeWidth="1.2" />
          {hasRoyalCollar && (
            <circle cx="22.5" cy="28" r="1.4" fill={p.detail} stroke="none" />
          )}
        </g>
      )}

      {type === 'k' && (
        <g fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 11.63V6M20 8h5" stroke={p.stroke} strokeWidth="1.8" />
          <path
            d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
            fill={p.fill}
          />
          <path
            d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z"
            fill={p.fill}
          />
          <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke={p.detail} strokeWidth="1.2" />
          {hasRoyalCollar && (
            <path d="M22.5 20v5" stroke={p.detail} strokeWidth="1.3" />
          )}
        </g>
      )}
    </svg>
  );
};
