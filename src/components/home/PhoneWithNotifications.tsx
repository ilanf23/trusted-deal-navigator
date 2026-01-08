import { useEffect, useState } from "react";

interface Notification {
  id: number;
  timestamp: number;
}

interface PhoneWithNotificationsProps {
  dotCount: number;
}

const PhoneWithNotifications = ({ dotCount }: PhoneWithNotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (dotCount > 0) {
      const newNotification: Notification = {
        id: dotCount,
        timestamp: Date.now(),
      };
      
      setNotifications((prev) => {
        // Keep only the last 4 notifications
        const updated = [...prev, newNotification].slice(-4);
        return updated;
      });

      // Remove notification after 2 seconds
      const timeout = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== dotCount));
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [dotCount]);

  return (
    <div className="relative">
      {/* Phone Outline */}
      <svg 
        width="120" 
        height="240" 
        viewBox="0 0 120 240" 
        fill="none" 
        className="opacity-80"
      >
        <rect 
          x="4" 
          y="4" 
          width="112" 
          height="232" 
          rx="20" 
          stroke="currentColor" 
          strokeWidth="3" 
          className="text-primary-foreground"
        />
        <rect 
          x="45" 
          y="12" 
          width="30" 
          height="6" 
          rx="3" 
          fill="currentColor" 
          className="text-primary-foreground/50"
        />
        <circle 
          cx="60" 
          cy="224" 
          r="8" 
          stroke="currentColor" 
          strokeWidth="2" 
          className="text-primary-foreground/50"
        />
      </svg>

      {/* Notifications Container */}
      <div className="absolute top-8 left-3 right-3 flex flex-col gap-1.5 overflow-hidden">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className="bg-primary-foreground/20 backdrop-blur-sm rounded-md px-2 py-1.5 animate-fade-in"
            style={{
              opacity: 1 - index * 0.15,
            }}
          >
            <p className="text-primary-foreground text-[8px] font-medium truncate">
              ✓ Deal closed
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhoneWithNotifications;
