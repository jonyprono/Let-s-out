// ─── Shared types used by both apps/web and apps/api ─────────────────────────

export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN'
export type AuthProvider = 'PHONE' | 'EMAIL' | 'GOOGLE' | 'APPLE'
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
export type EventCategory =
  | 'SPORT' | 'CULTURE' | 'FOOD' | 'NIGHTLIFE'
  | 'TRAVEL' | 'GAMING' | 'WELLNESS' | 'ART' | 'MUSIC' | 'OTHER'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED'
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM'
export type NotifType =
  | 'EVENT_INVITE' | 'EVENT_UPDATE' | 'EVENT_CANCELLED'
  | 'JOIN_REQUEST' | 'JOIN_ACCEPTED' | 'JOIN_CONFIRMED' | 'NEW_MESSAGE'
  | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED'
  | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'SYSTEM'
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'
export type FriendStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED'

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface Profile {
  id: string
  userId: string
  username: string
  displayName: string
  bio?: string
  avatarUrl?: string
  coverUrl?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  birthDate?: string
  kycStatus?: string
  interests: string[]
  isPublic: boolean
  followersCount: number
  followingCount: number
  eventsCount: number
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  phone?: string
  email?: string
  role: UserRole
  isVerified: boolean
  isActive: boolean
  provider: AuthProvider
  createdAt: string
  updatedAt: string
  lastSeenAt?: string
  profile?: Profile
}

// ─── Event ────────────────────────────────────────────────────────────────────

export interface Event {
  id: string
  creatorId: string
  title: string
  description: string
  category: EventCategory
  status: EventStatus
  coverUrl?: string
  mediaUrls: string[]
  maxAttendees?: number
  currentAttendees: number
  price: number
  currency: string
  isPrivate: boolean
  requiresApproval: boolean
  address?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  startAt: string
  endAt: string
  tags: string[]
  viewCount: number
  createdAt: string
  updatedAt: string
  creator: Pick<User, 'id'> & { profile?: Pick<Profile, 'username' | 'displayName' | 'avatarUrl'> }
  _count?: { bookings: number }
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export interface Booking {
  id: string
  userId: string
  eventId: string
  status: BookingStatus
  quantity: number
  totalPaid: number
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── Message / Conversation ───────────────────────────────────────────────────

export interface Message {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  content?: string
  mediaUrl?: string
  replyToId?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  sender?: { profile?: Pick<Profile, 'username' | 'displayName' | 'avatarUrl'> }
  replyTo?: Pick<Message, 'id' | 'content'>
}

export interface Conversation {
  id: string
  name?: string
  isGroup: boolean
  avatarUrl?: string
  eventId?: string
  lastMessageAt?: string
  createdAt: string
  updatedAt: string
  members?: ConversationMember[]
  messages?: Message[]
}

export interface ConversationMember {
  id: string
  conversationId: string
  userId: string
  isAdmin: boolean
  joinedAt: string
  lastReadAt?: string
  user?: { profile?: Pick<Profile, 'username' | 'displayName' | 'avatarUrl'> }
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  userId: string
  type: NotifType
  title: string
  body: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface Payment {
  id: string
  userId: string
  bookingId?: string
  stripePaymentId?: string
  amount: number
  currency: string
  status: PaymentStatus
  createdAt: string
  updatedAt: string
}

// ─── WebSocket messages ───────────────────────────────────────────────────────

export type WsIncoming =
  | { type: 'message'; conversationId: string; content: string; messageType?: MessageType }
  | { type: 'typing'; conversationId: string }
  | { type: 'read'; conversationId: string; messageId: string }

export type WsOutgoing =
  | { type: 'new_message'; message: Message }
  | { type: 'typing'; userId: string; conversationId: string }
  | { type: 'read'; userId: string; conversationId: string; messageId: string }
