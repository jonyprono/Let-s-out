import re

with open("apps/web/src/app/components/EventDetails.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add `delegationsMap` memoization
imports_search = "import { Heart, Upload, AlertTriangle, ArrowRight, Share2, MapPin, Calendar, Clock, DollarSign, Users, CheckCircle, Ticket, LogOut, MessageCircle, MoreVertical, X, Lock, FileText, BadgeCheck, Camera, Check, Link, Briefcase, Info, Copy, Loader2 } from 'lucide-react'"
imports_inject = "import { Heart, Upload, AlertTriangle, ArrowRight, Share2, MapPin, Calendar, Clock, DollarSign, Users, CheckCircle, Ticket, LogOut, MessageCircle, MoreVertical, X, Lock, FileText, BadgeCheck, Camera, Check, Link, Briefcase, Info, Copy, Loader2, Shield } from 'lucide-react'"
content = content.replace(imports_search, imports_inject)

if "import { useMemo" not in content:
    content = content.replace("import { useState", "import { useState, useMemo")

memo_search = "  const isParticipating = Array.isArray(attendeesData) ? attendeesData.some((a: any) => a.userId === user?.id) : attendeesData?.data?.some((a: any) => a.userId === user?.id)"
memo_inject = """  const isParticipating = Array.isArray(attendeesData) ? attendeesData.some((a: any) => a.userId === user?.id) : attendeesData?.data?.some((a: any) => a.userId === user?.id)

  const delegationsMap = useMemo(() => {
    const map: Record<string, any[]> = {}
    const list = Array.isArray(attendeesData) ? attendeesData : (attendeesData?.data || [])
    list.forEach((b: any) => {
      if (b.delegatedToId && b.poolValidationStatus === 'DELEGATED') {
        if (!map[b.delegatedToId]) map[b.delegatedToId] = []
        map[b.delegatedToId].push(b)
      }
    })
    return map
  }, [attendeesData])

  const myDelegatedBookings = delegationsMap[user?.id || ''] || []
  const totalDelegatedAmount = myDelegatedBookings.reduce((sum: number, b: any) => sum + b.totalPaid, 0)
  const isNegligentValidator = myDelegatedBookings.length > 0 && myBooking?.poolValidationStatus === 'PENDING' && event?.poolClosedAt;
"""
content = content.replace(memo_search, memo_inject)

# 2. Add negligent validator alert below the cover image (around the general actions area)
# Let's find a good spot, e.g., right before `{/* ── Status Banner (Si complet ou passé) ── */}`
banner_search = "      {/* ── Status Banner (Si complet ou passé) ── */}"
banner_inject = """      {/* ── Negligent Validator Alert ── */}
      {isNegligentValidator && (
        <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[16px] flex gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[14px] font-bold text-red-900 dark:text-red-200 mb-1">Action urgente requise !</h4>
            <p className="text-[13px] text-red-700 dark:text-red-300">
              La cagnotte est en cours de décaissement, mais vous n'avez pas encore validé !
              Vous représentez <strong>{myDelegatedBookings.length}</strong> personne(s) pour un total de <strong>{totalDelegatedAmount.toLocaleString()} F CFA</strong>. 
              Validez rapidement pour ne pas bloquer les fonds et subir une forte pénalité.
            </p>
          </div>
        </div>
      )}

      {/* ── Status Banner (Si complet ou passé) ── */}"""
content = content.replace(banner_search, banner_inject)

# 3. Add badges to the ParticipantsModal
participant_search = """                        <div className="flex items-center gap-1 flex-1">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{name}</p>
                          {isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                        </div>
                      </button>"""
participant_inject = """                        <div className="flex flex-col flex-1 items-start">
                          <div className="flex items-center gap-1">
                            <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{name}</p>
                            {isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                          </div>
                          {delegationsMap[booking.user.id] && delegationsMap[booking.user.id].length > 0 && (
                            <div className="flex items-center gap-1 mt-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                              <Shield className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                                Validateur ({delegationsMap[booking.user.id].length} personne{delegationsMap[booking.user.id].length > 1 ? 's' : ''})
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                      {delegationsMap[booking.user.id] && delegationsMap[booking.user.id].length > 0 && (
                        <div className="px-5 pb-3 pt-1">
                          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-2">A reçu les délégations de :</p>
                          <div className="flex flex-wrap gap-2">
                            {delegationsMap[booking.user.id].map((delBooking: any) => (
                              <div key={delBooking.id} className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#333] px-2 py-1 rounded-full">
                                <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-200">
                                  <img src={delBooking.user?.profile?.avatarUrl || ''} className="w-full h-full object-cover" />
                                </div>
                                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                                  {delBooking.user?.profile?.displayName || 'Anonyme'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}"""
content = content.replace(participant_search, participant_inject)

with open("apps/web/src/app/components/EventDetails.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched EventDetails.tsx")
