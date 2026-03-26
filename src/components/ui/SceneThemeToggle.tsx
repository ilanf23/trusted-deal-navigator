import { useId } from 'react';
import { useTheme } from 'next-themes';

const SceneThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const svgId = useId();

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative rounded-full cursor-pointer overflow-hidden transition-shadow duration-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{ width: 120, height: 48 }}
    >
      <svg
        viewBox="0 0 120 48"
        width={120}
        height={48}
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <defs>
          {/* Sky gradients */}
          <linearGradient id={`sky-light-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id={`sky-dark-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
          <clipPath id={`scene-clip-${svgId}`}>
            <rect width="120" height="48" rx="24" />
          </clipPath>
        </defs>

        {/* Sky background */}
        <rect
          width="120"
          height="48"
          rx="24"
          fill={`url(#sky-light-${svgId})`}
          className="transition-opacity duration-700"
          style={{ opacity: isDark ? 0 : 1 }}
        />
        <rect
          width="120"
          height="48"
          rx="24"
          fill={`url(#sky-dark-${svgId})`}
          className="transition-opacity duration-700"
          style={{ opacity: isDark ? 1 : 0 }}
        />

        {/* Clouds - visible in light mode */}
        <g
          className="transition-opacity duration-700"
          style={{ opacity: isDark ? 0 : 1 }}
        >
          <g className="scene-cloud-drift" style={{ animationDelay: '0s' }}>
            <ellipse cx="55" cy="14" rx="10" ry="4" fill="white" opacity="0.8" />
            <ellipse cx="50" cy="15" rx="6" ry="3" fill="white" opacity="0.6" />
          </g>
          <g className="scene-cloud-drift" style={{ animationDelay: '2s' }}>
            <ellipse cx="85" cy="20" rx="8" ry="3" fill="white" opacity="0.7" />
            <ellipse cx="80" cy="21" rx="5" ry="2.5" fill="white" opacity="0.5" />
          </g>
          <g className="scene-cloud-drift" style={{ animationDelay: '4s' }}>
            <ellipse cx="30" cy="22" rx="7" ry="2.5" fill="white" opacity="0.6" />
          </g>
        </g>

        {/* Stars - visible in dark mode */}
        <g
          className="transition-opacity duration-700"
          style={{ opacity: isDark ? 1 : 0 }}
        >
          <circle cx="15" cy="10" r="1" fill="white" className="scene-twinkle" style={{ animationDelay: '0s' }} />
          <circle cx="35" cy="8" r="0.8" fill="white" className="scene-twinkle" style={{ animationDelay: '0.5s' }} />
          <circle cx="50" cy="14" r="1.2" fill="white" className="scene-twinkle" style={{ animationDelay: '1s' }} />
          <circle cx="70" cy="6" r="0.7" fill="white" className="scene-twinkle" style={{ animationDelay: '1.5s' }} />
          <circle cx="90" cy="12" r="1" fill="white" className="scene-twinkle" style={{ animationDelay: '0.3s' }} />
          <circle cx="105" cy="8" r="0.6" fill="white" className="scene-twinkle" style={{ animationDelay: '2s' }} />
          <circle cx="25" cy="18" r="0.8" fill="white" className="scene-twinkle" style={{ animationDelay: '0.8s' }} />
          <circle cx="60" cy="10" r="0.9" fill="white" className="scene-twinkle" style={{ animationDelay: '1.3s' }} />
        </g>

        {/* Sun - slides down and fades when dark */}
        <g
          className="transition-all duration-700 ease-in-out"
          style={{
            transform: isDark ? 'translateY(39px)' : 'translateY(0px)',
            opacity: isDark ? 0 : 1,
          }}
        >
          <circle cx="30" cy="16" r="10" fill="#fbbf24" />
          {/* Sun glow */}
          <circle cx="30" cy="16" r="14" fill="#fbbf24" opacity="0.2" />
        </g>

        {/* Moon - slides up and fades in when dark */}
        <g
          className="transition-all duration-700 ease-in-out"
          style={{
            transform: isDark ? 'translateY(0px)' : 'translateY(40px)',
            opacity: isDark ? 1 : 0,
          }}
        >
          <circle cx="90" cy="16" r="9" fill="#e2e8f0" />
          {/* Moon craters */}
          <circle cx="87" cy="13" r="2" fill="#cbd5e1" opacity="0.5" />
          <circle cx="93" cy="17" r="1.5" fill="#cbd5e1" opacity="0.4" />
          <circle cx="89" cy="19" r="1" fill="#cbd5e1" opacity="0.3" />
        </g>

        {/* Rolling hills */}
        <g clipPath={`url(#scene-clip-${svgId})`}>
          {/* Back hill */}
          <ellipse
            cx="40"
            cy="52"
            rx="55"
            ry="18"
            className="transition-all duration-700"
            style={{ fill: isDark ? '#1e293b' : '#4ade80' }}
          />
          {/* Front hill */}
          <ellipse
            cx="90"
            cy="54"
            rx="50"
            ry="18"
            className="transition-all duration-700"
            style={{ fill: isDark ? '#0f172a' : '#22c55e' }}
          />
        </g>
      </svg>
    </button>
  );
};

export default SceneThemeToggle;
