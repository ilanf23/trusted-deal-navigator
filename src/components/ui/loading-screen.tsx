/**
 * Full-screen loading animation for route transitions.
 * Clean single-ring spinner with CLX brand mark — professional finance aesthetic.
 */

const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-8">
      {/* Spinner container */}
      <div className="relative h-36 w-36">
        {/* Static track ring */}
        <div className="absolute inset-0 rounded-full border-[2.5px] border-muted" />
        {/* Rotating arc */}
        <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-primary animate-[loader-orbit_1.6s_ease-in-out_infinite]" />

        {/* Center logo mark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-semibold tracking-wide text-primary select-none">
            CLX
          </span>
        </div>
      </div>

      {/* Subtle loading text */}
      <span className="text-xs font-medium text-muted-foreground tracking-wider uppercase animate-pulse">
        Loading
      </span>
    </div>
  );
};

export default LoadingScreen;
