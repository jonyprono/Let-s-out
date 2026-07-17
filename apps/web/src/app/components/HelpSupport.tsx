import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { chatApi } from '@/features/chat/api';
import { toast } from 'sonner';
import {
  ArrowLeft01Icon,
  HelpCircleIcon,
  Call02Icon,
  Alert01Icon,
  Message01Icon,
  ArrowRight01Icon,
  Clock01Icon
} from 'hugeicons-react';

export default function HelpSupport() {
  const navigate = useNavigate();
  const user = useAuthStore((s: any) => s.user);
  const displayName = user?.profile?.displayName?.split(' ')[0] || 'Utilisateur';

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const supportAgents = [
    { id: 'bot_armand', name: 'Armand', role: 'Support Client', rating: '4.8', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Armand&backgroundColor=b6e3f4' },
    { id: 'bot_estelle', name: 'Estelle', role: 'Support Technique', rating: '4.9', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Estelle&backgroundColor=ffdfbf' },
    { id: 'bot_brice', name: 'Brice', role: 'Support Paiements', rating: '4.7', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Brice&backgroundColor=c0aede' },
    { id: 'bot_aicha', name: 'Aïcha', role: 'Support Général', rating: '4.8', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aicha&backgroundColor=ffb8b8' },
  ];

  const handleStartChat = async (botId: string) => {
    try {
      setIsStartingChat(true);
      const conversation = await chatApi.createDM(botId);
      navigate(`/chat/${conversation.id}`);
    } catch (e) {
      toast.error('Erreur lors de la création de la discussion');
    } finally {
      setIsStartingChat(false);
    }
  };

  const faqs = [
    {
      id: 1,
      question: "Comment retirer mes fonds d'un événement ?",
      answer: "Rendez-vous dans la section Portefeuille de votre compte, sélectionnez l'événement terminé et cliquez sur 'Retirer les fonds'. Assurez-vous d'avoir validé votre profil KYC au préalable."
    },
    {
      id: 2,
      question: "Quels sont les moyens de retrait disponibles ?",
      answer: "Nous prenons en charge les transferts via Mobile Money (MoMo, Flooz, Wave, Orange Money) et les virements bancaires locaux selon votre pays."
    },
    {
      id: 3,
      question: "Comment créer un événement ?",
      answer: "Cliquez sur l'icône '+' au milieu de la barre de navigation en bas de l'écran. Laissez-vous guider par les étapes de création de l'événement."
    },
    {
      id: 4,
      question: "Comment inviter mes amis à un événement ?",
      answer: "Sur la page de l'événement, utilisez le bouton 'Partager' pour envoyer le lien de l'événement ou le QR code à vos amis."
    }
  ];

  const toggleFaq = (id: number) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black overflow-hidden relative pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-safe-3 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 border border-gray-100 dark:border-gray-800 rounded-2xl flex items-center justify-center bg-white dark:bg-black active:scale-95 transition-transform shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            <ArrowLeft01Icon size={20} className="text-gray-900 dark:text-white" />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight">
              Aide & Support
            </h1>
            <p className="text-[12px] text-gray-500 font-medium">
              Nous sommes là pour vous aider 👋
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 h-9 px-3 border border-gray-200 dark:border-gray-800 rounded-full active:scale-95 transition-transform bg-white dark:bg-black shadow-sm">
          <Clock01Icon size={16} className="text-gray-700 dark:text-gray-300" strokeWidth={1.8} />
          <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Historique</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* ── Banner ── */}
        <div className="px-4 mb-6">
          <div className="w-full bg-gradient-to-r from-[#FFF5ED] to-[#FFE8D6] dark:from-[#2A180C] dark:to-[#381F0E] rounded-3xl p-5 flex items-center justify-between relative overflow-hidden h-[160px]">
            <div className="z-10 w-2/3">
              <h2 className="text-[20px] font-bold text-gray-900 dark:text-white leading-tight mb-2">
                Bonjour {displayName} !
              </h2>
              <p className="text-[13px] text-gray-600 dark:text-gray-300 font-medium leading-snug pr-4">
                Comment pouvons-nous vous aider aujourd'hui ?
              </p>
            </div>
            {/* 3D Agent Illustration */}
            <div className="absolute right-[-10px] bottom-[-10px] w-48 h-48 opacity-90">
               {/* This is a generated image path */}
               <img src="file:///C:/Users/carlo/.gemini/antigravity/brain/678878aa-6c39-419b-b318-5e5a151da00d/support_agent_3d_1784250905491.jpg" alt="Support Agent" className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-lighten" style={{ maskImage: 'linear-gradient(to top, transparent 10%, black 50%)', WebkitMaskImage: 'linear-gradient(to top, transparent 10%, black 50%)' }} />
            </div>
          </div>
        </div>

        {/* ── Quick Help Grid ── */}
        <div className="px-4 mb-8">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-4">
            Besoin d'aide rapidement ?
          </h3>
          <div className="flex justify-between gap-2">
            {/* Card 1 */}
            <button className="flex-1 flex flex-col items-center p-2.5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111] shadow-sm active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-[#FF7A00]/10 flex items-center justify-center mb-2">
                <HelpCircleIcon size={18} className="text-[#FF7A00]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white mb-0.5 whitespace-nowrap">Centre d'aide</span>
              <span className="text-[8px] text-center text-gray-500 dark:text-gray-400 font-medium leading-[1.1]">
                Trouvez des<br/>réponses
              </span>
            </button>
            {/* Card 2 */}
            <button className="flex-1 flex flex-col items-center p-2.5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111] shadow-sm active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-[#FF7A00]/10 flex items-center justify-center mb-2">
                <Message01Icon size={18} className="text-[#FF7A00]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white mb-0.5 whitespace-nowrap">Nous écrire</span>
              <span className="text-[8px] text-center text-gray-500 dark:text-gray-400 font-medium leading-[1.1]">
                Démarrez une<br/>conversation
              </span>
            </button>
            {/* Card 3 */}
            <button className="flex-1 flex flex-col items-center p-2.5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111] shadow-sm active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-[#FF7A00]/10 flex items-center justify-center mb-2">
                <Call02Icon size={18} className="text-[#FF7A00]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white mb-0.5 whitespace-nowrap">Nous appeler</span>
              <span className="text-[8px] text-center text-gray-500 dark:text-gray-400 font-medium leading-[1.1]">
                Lun - Ven<br/>8h00 - 18h00
              </span>
            </button>
            {/* Card 4 */}
            <button className="flex-1 flex flex-col items-center p-2.5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111] shadow-sm active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-[#FF7A00]/10 flex items-center justify-center mb-2">
                <Alert01Icon size={18} className="text-[#FF7A00]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white mb-0.5 whitespace-nowrap">Signaler bug</span>
              <span className="text-[8px] text-center text-gray-500 dark:text-gray-400 font-medium leading-[1.1]">
                Signalez un bug<br/>ou problème
              </span>
            </button>
          </div>
        </div>

        {/* ── Discussion avec l'assistance ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between px-4 mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">
                Discussion avec l'assistance
              </h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                Nos agents sont prêts à vous aider
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></div>
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">En ligne</span>
            </div>
          </div>

          <div className="flex gap-3 px-4 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {supportAgents.map((agent) => (
              <div key={agent.id} className="shrink-0 w-[110px] border border-gray-100 dark:border-gray-800 rounded-[20px] p-3 flex flex-col items-center bg-white dark:bg-[#111] shadow-sm">
                <div className="relative mb-2">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                    <img src={agent.img} alt={agent.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#22C55E] border-2 border-white dark:border-[#111] rounded-full"></div>
                </div>
                <span className="text-[14px] font-bold text-gray-900 dark:text-white">{agent.name}</span>
                <span className="text-[10px] text-gray-500 font-medium mt-0.5 whitespace-nowrap">{agent.role}</span>
                <div className="flex items-center gap-1 mt-1 mb-3">
                  <span className="text-[#FF7A00]">⭐</span>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{agent.rating}</span>
                </div>
                <button 
                  onClick={() => handleStartChat(agent.id)}
                  disabled={isStartingChat}
                  className="w-full h-8 flex items-center justify-center gap-1.5 bg-transparent border border-orange-200 dark:border-[#FF7A00]/30 text-[#FF7A00] rounded-full active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Message01Icon size={14} strokeWidth={2} />
                  <span className="text-[11px] font-bold">Discuter</span>
                </button>
              </div>
            ))}
          </div>

          <div className="px-4">
            <div className="w-full bg-orange-50 dark:bg-[#FF7A00]/10 rounded-xl py-3 flex items-center justify-center gap-2">
              <Clock01Icon size={16} className="text-[#FF7A00]" strokeWidth={2} />
              <span className="text-[12px] font-bold text-[#FF7A00]">Délai de réponse moyen : 2 minutes</span>
            </div>
          </div>
        </div>

        {/* ── Questions Fréquentes ── */}
        <div className="px-4 pb-28">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Questions fréquentes</h3>
            <button className="text-[12px] font-semibold text-[#FF7A00]">Voir tout &gt;</button>
          </div>

          <div className="flex flex-col">
            {faqs.map((faq) => {
              const isExpanded = expandedFaq === faq.id;
              return (
                <div key={faq.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full py-4 flex items-center justify-between text-left active:bg-gray-50 dark:active:bg-[#111] transition-colors"
                  >
                    <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 pr-4">
                      {faq.question}
                    </span>
                    <ArrowRight01Icon 
                      size={18} 
                      className={`text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                  </button>
                  {isExpanded && (
                    <div className="pb-4 pr-4">
                      <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
