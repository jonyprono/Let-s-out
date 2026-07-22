import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Calendar, Users, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminEventsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'events', page, search, status],
    queryFn: async () => {
      const res = await apiClient.get('/admin/events', {
        params: { page, limit: 20, search, status }
      });
      return res.data;
    }
  });

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Événements</h1>
          <p className="text-white/50 text-sm mt-1">Tous les événements créés sur la plateforme ({data?.total || 0})</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher (titre, code...)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#222] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-action-primary outline-none transition-all"
          />
        </div>
        
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#222] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="CANCELLED">Annulé</option>
          <option value="COMPLETED">Terminé</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="bg-[#222] text-xs uppercase text-white/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Titre & Organisateur</th>
                <th className="px-6 py-4 font-semibold">Détails</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4 font-semibold">Prix</th>
                <th className="px-6 py-4 font-semibold">Création</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/50">Chargement...</td>
                </tr>
              ) : data?.data?.map((event: any) => (
                <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#333] overflow-hidden flex-shrink-0">
                        {event.coverUrl ? (
                          <img src={event.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <Calendar className="w-full h-full p-3 text-white/20" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white max-w-[200px] truncate" title={event.title}>{event.title}</div>
                        <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                          Par <span className="font-medium text-white/70">{event.creator?.profile?.displayName}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-white">
                      <Calendar className="w-3.5 h-3.5 text-white/40" />
                      {format(new Date(event.startAt), 'dd/MM/yy HH:mm')}
                    </div>
                    {event.city && (
                      <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.city}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                      <Users className="w-3 h-3" />
                      {event.currentAttendees} / {event.maxAttendees || '∞'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      event.status === 'PUBLISHED' ? 'bg-green-500/10 text-green-500' :
                      event.status === 'DRAFT' ? 'bg-white/10 text-white/60' :
                      event.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-white">
                    {event.price === 0 ? 'Gratuit' : `${event.price} F`}
                  </td>
                  <td className="px-6 py-4 text-white/50">
                    {format(new Date(event.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-sm text-white/50">Page {data.page} sur {data.pages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={data.page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 bg-[#222] rounded-lg text-white hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                disabled={data.page === data.pages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 bg-[#222] rounded-lg text-white hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
