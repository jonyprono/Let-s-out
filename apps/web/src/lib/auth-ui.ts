/**
 * Classes auth — couleurs sémantiques (foreground / muted / card)
 * Ne pas utiliser dark:text-white : --color-white était inversé en .dark.
 */

export const authShell = 'auth-flow w-full h-full bg-background text-foreground flex flex-col transition-colors'

export const authTitle = 'text-[22px] font-bold text-foreground leading-tight'
export const authTitleLg = 'text-[26px] font-bold text-center text-foreground leading-tight'
export const authHeader = 'text-[15px] font-semibold text-foreground'
export const authSubtitle = 'text-[13px] text-muted-foreground leading-relaxed'
export const authLabel = 'text-[13px] text-muted-foreground font-medium'

export const authInput =
  'w-full px-4 py-3.5 border border-border rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-card text-foreground placeholder:text-muted-foreground'

export const authInputFlex =
  'flex-1 min-w-0 px-4 py-3.5 border border-border rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-card text-foreground placeholder:text-muted-foreground'

export const authGhostBtn =
  'w-full bg-card border border-border text-foreground py-[17px] rounded-full font-semibold text-[15px] tracking-wide active:opacity-80 transition-colors'

export const authChannelBtn =
  'flex-1 flex items-center px-4 py-3.5 border border-border rounded-xl bg-card transition-colors gap-2'

export const authChannelLabel = 'flex-1 text-left text-[15px] font-medium text-foreground'
