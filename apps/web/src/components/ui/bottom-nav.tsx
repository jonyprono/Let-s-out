import * as React from "react"
import { cn } from "@/lib/utils"
import { Home, Search, Plus, MessageSquare, User } from "lucide-react"

export interface BottomNavProps {
  activeTab: "home" | "explore" | "messages" | "profile";
  onTabChange: (tab: "home" | "explore" | "messages" | "profile") => void;
  onAddClick: () => void;
  className?: string;
}

export function BottomNav({ activeTab, onTabChange, onAddClick, className }: BottomNavProps) {
  const tabs = [
    { id: "home", label: "Accueil", icon: Home },
    { id: "explore", label: "Explorer", icon: Search },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "profile", label: "Profil", icon: User },
  ] as const;

  return (
    <div className={cn("flex h-[72px] w-full items-center justify-between border-t border-[var(--border-default)] bg-[var(--color-background-primary)] px-[var(--spacing-300)] pb-safe", className)}>
      <div className="flex w-full items-center justify-between">
        {/* First two tabs */}
        <NavItem tab={tabs[0]} isActive={activeTab === tabs[0].id} onClick={() => onTabChange(tabs[0].id as any)} />
        <NavItem tab={tabs[1]} isActive={activeTab === tabs[1].id} onClick={() => onTabChange(tabs[1].id as any)} />
        
        {/* Center Add Button */}
        <button
          onClick={onAddClick}
          className="flex h-[48px] w-[48px] items-center justify-center rounded-[var(--radius-large)] bg-[var(--color-action-primary)] text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* Last two tabs */}
        <NavItem tab={tabs[2]} isActive={activeTab === tabs[2].id} onClick={() => onTabChange(tabs[2].id as any)} />
        <NavItem tab={tabs[3]} isActive={activeTab === tabs[3].id} onClick={() => onTabChange(tabs[3].id as any)} />
      </div>
    </div>
  )
}

function NavItem({ tab, isActive, onClick }: { tab: any, isActive: boolean, onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-[var(--spacing-050)] focus:outline-none">
      <Icon
        className={cn(
          "h-6 w-6 transition-colors",
          isActive ? "text-[var(--color-icon-brand-primary)]" : "text-[var(--color-icon-secondary)]"
        )}
      />
      <span
        className={cn(
          "font-poppins text-[var(--font-size-body-xsmall)] font-medium transition-colors",
          isActive ? "text-[var(--color-text-brand-primary)]" : "text-[var(--color-text-secondary)]"
        )}
      >
        {tab.label}
      </span>
    </button>
  )
}
