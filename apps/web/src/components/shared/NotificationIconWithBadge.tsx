import React from 'react';

interface NotificationIconWithBadgeProps extends React.SVGProps<SVGSVGElement> {
  unreadCount?: number;
}

export function NotificationIconWithBadge({ unreadCount = 0, className, ...props }: NotificationIconWithBadgeProps) {
  return (
    <svg 
      width="32" 
      height="32" 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path 
        d="M19.3333 21C19.3333 22.8409 17.8409 24.3333 16 24.3333C14.159 24.3333 12.6667 22.8409 12.6667 21" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M9.69711 21.0001H22.3021C22.9086 21.0001 23.2118 21.0001 23.3873 20.9127C23.7283 20.7428 23.9107 20.3633 23.8303 19.9909C23.789 19.7992 23.5995 19.5625 23.2207 19.0889L23.0792 18.9121C22.6993 18.4372 22.5094 18.1998 22.3487 17.9508C21.8489 17.1767 21.5397 16.2951 21.4463 15.3784C21.4162 15.0836 21.4162 14.7795 21.4162 14.1714V13.0834C21.4162 12.6965 21.4162 12.5031 21.4056 12.3397C21.2415 9.83595 19.2471 7.84156 16.7433 7.67746C16.58 7.66675 16.3865 7.66675 15.9996 7.66675C15.6127 7.66675 15.4192 7.66675 15.2559 7.67746C12.7521 7.84156 10.7577 9.83595 10.5936 12.3397C10.5829 12.5031 10.5829 12.6965 10.5829 13.0834V14.1714C10.5829 14.7795 10.5829 15.0836 10.5529 15.3784C10.4595 16.2951 10.1503 17.1767 9.65055 17.9508C9.48982 18.1998 9.29987 18.4372 8.92 18.9121L8.77855 19.0889C8.39969 19.5625 8.21027 19.7992 8.16889 19.9909C8.0885 20.3633 8.2709 20.7428 8.61192 20.9127C8.78741 21.0001 9.09064 21.0001 9.69711 21.0001Z" 
        stroke="currentColor" 
        strokeWidth="1.5"
      />
      
      {unreadCount > 0 && (
        <g>
          {/* Badge Background */}
          <circle cx="22" cy="10" r="7" fill="#FF991C" />
          
          {/* Dynamic Number */}
          <text 
            x="22" 
            y="10" 
            fill="white" 
            fontSize={unreadCount > 9 ? (unreadCount > 99 ? "5.5" : "7.5") : "9.5"} 
            fontWeight="bold" 
            fontFamily="Inter, sans-serif"
            textAnchor="middle" 
            dominantBaseline="central"
            dy="0.5"
          >
            {unreadCount}
          </text>
        </g>
      )}
    </svg>
  );
}
