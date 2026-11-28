/**
 * Conversation actuellement ouverte à l'écran (ChatDetails).
 * Sert à ne PAS afficher de notification (locale, toast, OneSignal au premier plan) pour un message
 * de la discussion que l'utilisateur est déjà en train de lire.
 */
let activeConversationId: string | null = null

export function setActiveConversation(id: string | null): void {
  activeConversationId = id
}

/** La conversation `conversationId` est-elle ouverte à l'écran en ce moment ? */
export function isConversationOpen(conversationId: unknown): boolean {
  if (typeof conversationId !== 'string' || !conversationId) return false
  if (conversationId === activeConversationId) return true
  // Filet de sécurité : route /chat/:id affichée (ex. avant le montage complet de ChatDetails)
  return typeof window !== 'undefined' && window.location.pathname === `/chat/${conversationId}`
}
