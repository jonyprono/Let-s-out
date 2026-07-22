import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, UserCircle, Calendar, ShieldCheck, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [sort, setSort] = useState('newest');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, kycStatus, sort],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', {
        params: { page, limit: 20, search, kycStatus, sort }
      });
      return res.data;
    }
  });

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Utilisateurs</h1>
          <p className="text-white/50 text-sm mt-1">Gérez tous les utilisateurs inscrits ({data?.total || 0} au total)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher (nom, email, tel...)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#222] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-action-primary outline-none transition-all"
          />
        </div>
        
        <select
          value={kycStatus}
          onChange={(e) => { setKycStatus(e.target.value); setPage(1); }}
          className="bg-[#222] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
        >
          <option value="">Tous les statuts KYC</option>
          <option value="pending">En attente</option>
          <option value="verified">Vérifié</option>
          <option value="rejected">Rejeté</option>
        </select>

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="bg-[#222] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
        >
          <option value="newest">Plus récents d'abord</option>
          <option value="oldest">Plus anciens d'abord</option>
          <option value="lastActive">Dernière activité</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="bg-[#222] text-xs uppercase text-white/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Utilisateur</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Statut KYC</th>
                <th className="px-6 py-4 font-semibold">Inscription</th>
                <th className="px-6 py-4 font-semibold">Dernière act.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/50">Chargement...</td>
                </tr>
              ) : data?.data?.map((user: any) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#333] overflow-hidden flex-shrink-0">
                        {user.profile?.avatarUrl ? (
                          <img src={user.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle className="w-full h-full text-white/20" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white">{user.profile?.displayName || 'Sans nom'}</div>
                        <div className="text-xs text-white/40">@{user.profile?.username || 'inconnu'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-white">{user.phone || 'Pas de tel'}</div>
                    <div className="text-xs text-white/40">{user.email || 'Pas d\'email'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {user.profile?.kycStatus === 'verified' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" /> Vérifié
                      </span>
                    )}
                    {user.profile?.kycStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">
                        <Calendar className="w-3.5 h-3.5" /> En attente
                      </span>
                    )}
                    {user.profile?.kycStatus === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-bold border border-red-500/20">
                        <ShieldAlert className="w-3.5 h-3.5" /> Rejeté
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {format(new Date(user.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </td>
                  <td className="px-6 py-4">
                    {user.lastSeenAt ? format(new Date(user.lastSeenAt), 'dd MMM yyyy', { locale: fr }) : '-'}
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
