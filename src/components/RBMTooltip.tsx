import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export type TooltipAccent = "blue" | "green" | "amber" | "red" | "slate";

interface RBMTooltipProps {
  content: React.ReactNode;
  title?: string;
  badgeText?: string;
  accent?: TooltipAccent;
  children: React.ReactNode;
  widthClass?: string;
  className?: string;
}

const ACCENT_STYLES: Record<
  TooltipAccent,
  {
    topBorder: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
  }
> = {
  blue: {
    topBorder: "#4bc2e7",
    badgeBg: "bg-[#2563eb]/30",
    badgeText: "text-[#7dd3fc]",
    badgeBorder: "border-[#38bdf8]/40",
    dotColor: "#4bc2e7",
  },
  green: {
    topBorder: "#16a34a",
    badgeBg: "bg-[#16a34a]/25",
    badgeText: "text-[#86efac]",
    badgeBorder: "border-[#22c55e]/40",
    dotColor: "#22c55e",
  },
  amber: {
    topBorder: "#f59e0b",
    badgeBg: "bg-[#f59e0b]/25",
    badgeText: "text-[#fde68a]",
    badgeBorder: "border-[#f59e0b]/50",
    dotColor: "#f59e0b",
  },
  red: {
    topBorder: "#dc2626",
    badgeBg: "bg-[#dc2626]/25",
    badgeText: "text-[#fca5a5]",
    badgeBorder: "border-[#ef4444]/40",
    dotColor: "#ef4444",
  },
  slate: {
    topBorder: "#94a3b8",
    badgeBg: "bg-slate-700/60",
    badgeText: "text-slate-200",
    badgeBorder: "border-slate-500/40",
    dotColor: "#cbd5e1",
  },
};

export const RBMTooltip: React.FC<RBMTooltipProps> = ({
  content,
  title,
  badgeText,
  accent = "blue",
  children,
  widthClass = "w-72",
  className = "inline-flex items-center",
}) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    const tipWidth = tooltipEl ? tooltipEl.offsetWidth : 288;
    const tipHeight = tooltipEl ? tooltipEl.offsetHeight : 160;
    const margin = 12;
    const gap = 8;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal clamping within viewport
    const centerX = triggerRect.left + triggerRect.width / 2;
    let left = centerX - tipWidth / 2;
    if (left < margin) left = margin;
    if (left + tipWidth > vw - margin) {
      left = Math.max(margin, vw - tipWidth - margin);
    }

    // Vertical placement: prefer above trigger if there is room, otherwise below, then clamp
    let top = triggerRect.top - tipHeight - gap;
    if (top < margin) {
      // Place below trigger
      top = triggerRect.bottom + gap;
    }
    // Final clamp so bottom never overflows viewport
    if (top + tipHeight > vh - margin) {
      top = Math.max(margin, vh - tipHeight - margin);
    }

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition, content, title, badgeText]);

  const theme = ACCENT_STYLES[accent];

  return (
    <span
      ref={triggerRef}
      className={className}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`fixed pointer-events-none ${widthClass} max-w-[calc(100vw-24px)] bg-[#152243] text-white rounded-lg border border-[#2a437e] shadow-[0_14px_34px_-6px_rgba(9,16,36,0.55)] overflow-hidden transition-opacity duration-150`}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              borderTopWidth: "3px",
              borderTopColor: theme.topBorder,
              zIndex: 999999,
            }}
          >
            {(title || badgeText) && (
              <div className="px-3 py-2 bg-[#1c2d57] border-b border-white/10 flex items-center justify-between gap-2">
                {title && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: theme.dotColor }}
                    />
                    <span className="font-sans text-[11px] font-bold tracking-tight text-white truncate">
                      {title}
                    </span>
                  </div>
                )}
                {badgeText && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border shrink-0 ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                  >
                    {badgeText}
                  </span>
                )}
              </div>
            )}
            <div className="p-3 text-[11px] font-sans text-blue-50/95 leading-relaxed space-y-2">
              {content}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
};

interface InfoIconButtonProps {
  tooltipContent: React.ReactNode;
  tooltipTitle?: string;
  tooltipBadge?: string;
  accent?: TooltipAccent;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  ariaLabel?: string;
  widthClass?: string;
  size?: "xs" | "sm";
}

export const InfoIconButton: React.FC<InfoIconButtonProps> = ({
  tooltipContent,
  tooltipTitle,
  tooltipBadge,
  accent = "blue",
  onClick,
  active = false,
  ariaLabel = "More information",
  widthClass = "w-72",
  size = "sm",
}) => {
  const sizeClasses =
    size === "xs"
      ? "w-3.5 h-3.5 text-[9.5px]"
      : "w-4 h-4 text-[10.5px]";

  return (
    <RBMTooltip
      content={tooltipContent}
      title={tooltipTitle}
      badgeText={tooltipBadge}
      accent={accent}
      widthClass={widthClass}
      className="inline-flex items-center align-middle shrink-0"
    >
      <button
        type="button"
        onClick={(e) => {
          if (onClick) {
            e.stopPropagation();
            onClick(e);
          }
        }}
        aria-label={ariaLabel}
        className={`${sizeClasses} rounded-full inline-flex items-center justify-center font-serif italic font-black leading-none transition-all select-none cursor-pointer border ${
          active
            ? "bg-[#152243] text-white border-[#152243] shadow-2xs"
            : "bg-[#F2F8FF] hover:bg-[#152243] text-[#2563eb] hover:text-white border-blue-200 hover:border-[#152243]"
        }`}
      >
        i
      </button>
    </RBMTooltip>
  );
};
