'use client';

import { CERTIFICATE } from '@/lib/constants';

/**
 * CertificateSVG — renders the REAL certificate template PNG with dynamic text overlays.
 * Same approach as the backend generateCertificateSVG(): template image + text at exact coords.
 * Template: 1414×2000 PNG stored on Arweave.
 */

const { TEMPLATE_URL, VALUE_X, FIELD_Y } = CERTIFICATE;

interface CertificateSVGProps {
  tokenId?: string;
  owner?: string;
  shares?: string;
  valueUSDC?: string;
  issueDate?: string;
  network?: string;
  googlPrice?: string;
  width?: number;
  height?: number;
}

export default function CertificateSVG({
  tokenId = '\u2014',
  owner = '0x...',
  shares = '\u2014',
  valueUSDC = '10',
  issueDate = new Date().toISOString().split('T')[0],
  network = 'Ethereum Mainnet',
  googlPrice = '365.00',
  width = 400,
  height = 566,
}: CertificateSVGProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1414 2000"
      width={width}
      height={height}
      style={{ display: 'block' }}
    >
      {/* Certificate template background (permanent Arweave URL) */}
      <image
        href={TEMPLATE_URL}
        x="0"
        y="0"
        width="1414"
        height="2000"
        preserveAspectRatio="xMidYMid meet"
      />

      {/* === DYNAMIC DATA OVERLAYS === */}
      <text
        x={VALUE_X}
        y={FIELD_Y.certificateNo}
        fontFamily="Georgia,serif"
        fontSize="28"
        fill="#1e293b"
        fontWeight="bold"
      >
        #{tokenId}
      </text>

      <text
        x={VALUE_X}
        y={FIELD_Y.owner}
        fontFamily="Courier New,monospace"
        fontSize="28"
        fill="#334155"
        fontWeight="bold"
      >
        {owner}
      </text>

      <text
        x={VALUE_X}
        y={FIELD_Y.share}
        fontFamily="Georgia,serif"
        fontSize="28"
        fill="#1e293b"
        fontWeight="bold"
      >
        {shares}
      </text>

      <text
        x={VALUE_X}
        y={FIELD_Y.value}
        fontFamily="Georgia,serif"
        fontSize="28"
        fill="#1e293b"
        fontWeight="bold"
      >
        ${valueUSDC}
      </text>

      <text
        x={VALUE_X}
        y={FIELD_Y.issueDate}
        fontFamily="Courier New,monospace"
        fontSize="28"
        fill="#334155"
        fontWeight="bold"
      >
        {issueDate}
      </text>

      <text
        x={VALUE_X}
        y={FIELD_Y.network}
        fontFamily="Courier New,monospace"
        fontSize="28"
        fill="#334155"
        fontWeight="bold"
      >
        {network}
      </text>

      <text
        x={VALUE_X}
        y={FIELD_Y.googlPrice}
        fontFamily="Georgia,serif"
        fontSize="28"
        fill="#1e293b"
        fontWeight="bold"
      >
        ${googlPrice}
      </text>
    </svg>
  );
}

