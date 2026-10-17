import { useId } from "react";

/** Original SVG artwork: no stock imagery, external network request or recipe claim. */
export function Cocktail({
  variant = "mint",
  hero = false,
}: {
  variant?: string;
  hero?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const warm = variant === "sunset";
  const amber = variant === "amber";
  const liquid = warm
    ? ["#ffd5ac", "#f48d89"]
    : amber
      ? ["#f5cc92", "#ba675f"]
      : ["#e8dfef", "#ac8bce"];
  return (
    <svg
      viewBox="0 0 380 390"
      className={hero ? "cocktail-art hero-art" : "cocktail-art"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" stopOpacity=".8" />
          <stop offset=".5" stopColor="#f5eeff" stopOpacity=".12" />
          <stop offset="1" stopColor="#fff" stopOpacity=".62" />
        </linearGradient>
        <linearGradient id={`${id}drink`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={liquid[0]} stopOpacity=".85" />
          <stop offset="1" stopColor={liquid[1]} />
        </linearGradient>
        <radialGradient id={`${id}lime`}>
          <stop stopColor="#e8f4c4" />
          <stop offset=".8" stopColor="#c6df8a" />
          <stop offset="1" stopColor="#99b967" />
        </radialGradient>
        <filter id={`${id}shadow`}>
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <ellipse
        cx="193"
        cy="351"
        rx="89"
        ry="11"
        fill="#513466"
        opacity=".12"
        filter={`url(#${id}shadow)`}
      />
      <path
        d="M92 132h196c-7 67-40 110-95 111-53 0-91-43-101-111Z"
        fill={`url(#${id}glass)`}
        stroke="#fff"
        strokeOpacity=".85"
        strokeWidth="2"
      />
      <path
        d="M100 151h179c-12 52-40 83-87 84-45 0-76-32-92-84Z"
        fill={`url(#${id}drink)`}
      />
      <ellipse
        cx="190"
        cy="151"
        rx="89"
        ry="12"
        fill={liquid[0]}
        opacity=".9"
      />
      <ellipse
        cx="190"
        cy="132"
        rx="98"
        ry="15"
        fill="#fff"
        fillOpacity=".2"
        stroke="#fff"
        strokeWidth="2"
      />
      <path
        d="M188 243v92m8-92v92"
        stroke="#fff"
        strokeOpacity=".68"
        strokeWidth="3"
      />
      <ellipse
        cx="192"
        cy="339"
        rx="57"
        ry="9"
        fill={`url(#${id}glass)`}
        stroke="#fff"
        strokeOpacity=".72"
        strokeWidth="2"
      />
      <path
        d="M103 147c10 45 32 71 61 81"
        fill="none"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M271 151c-7 23-16 39-29 53"
        fill="none"
        stroke="#fff"
        strokeOpacity=".4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g transform="rotate(-19 235 120)">
        <circle
          cx="235"
          cy="120"
          r="45"
          fill={`url(#${id}lime)`}
          stroke="#8ba861"
          strokeWidth="3"
        />
        <circle
          cx="235"
          cy="120"
          r="37"
          fill="none"
          stroke="#f6f8db"
          strokeWidth="3"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d="M235 120v-34"
            transform={`rotate(${i * 45} 235 120)`}
            stroke="#f5f8db"
            strokeWidth="2"
          />
        ))}
        <circle cx="235" cy="120" r="4" fill="#f8f6db" />
      </g>
      <path d="M135 136c-36-1-48-24-40-40 24-2 42 10 40 40Z" fill="#63846b" />
      <path d="M135 136c-9-35 3-57 20-58 15 22 6 46-20 58Z" fill="#7f9e73" />
      <path
        d="m106 105 29 31 16-46"
        fill="none"
        stroke="#b6c6a0"
        strokeWidth="1.5"
      />
      <g fill="#fff" fillOpacity=".32" stroke="#fff" strokeOpacity=".7">
        <rect
          x="149"
          y="158"
          width="26"
          height="25"
          rx="6"
          transform="rotate(18 162 170)"
        />
        <rect
          x="196"
          y="164"
          width="29"
          height="26"
          rx="6"
          transform="rotate(-16 210 177)"
        />
      </g>
      {hero && (
        <g fill="none" stroke="#fff" strokeWidth="1.3" opacity=".55">
          <circle cx="68" cy="194" r="7" />
          <circle cx="310" cy="101" r="5" />
          <path d="M300 240v17m-8-8h16M83 66v14m-7-7h14" />
        </g>
      )}
    </svg>
  );
}
