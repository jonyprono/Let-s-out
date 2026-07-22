import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid, Legend 
} from 'recharts';
import { 
  Users, Calendar, CreditCard, ShieldCheck, 
  Download, RefreshCw, Activity, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fetchAdminStats } from '@/features/admin/api/stats-admin.api';

const COLORS = ['#FF4D4D', '#4ADE80', '#60A5FA', '#FBBF24', '#A78BFA'];

export function AdminStatsDashboard() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-stats', period],
    queryFn: () => fetchAdminStats(period),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-white/50">
        <RefreshCw className="w-8 h-8 animate-spin mr-3 text-action-primary" />
        <span className="text-lg">Calcul des métriques...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl">
        <p className="text-red-400 mb-4">Erreur lors du chargement des statistiques.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-red-500/20 rounded-xl text-red-300">
          Réessayer
        </button>
      </div>
    );
  }

  const { users, events, payments, engagement, computedAt } = data;

  const kycData = (Array.isArray(users?.kyc) ? users.kyc : []).map(k => ({ name: k.kycStatus, value: k._count }));
  const eventStatusData = (Array.isArray(events?.byStatus) ? events.byStatus : []).map(e => ({ name: e.status, value: e._count }));
  const eventCategoryData = (Array.isArray(events?.byCategory) ? events.byCategory : []).map(e => ({ name: e.category, value: e._count }));

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Audit & Statistiques</h1>
          <p className="text-white/50 text-sm mt-1 flex items-center gap-2">
            Calculé le {format(new Date(computedAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
            {isFetching && <RefreshCw className="w-3 h-3 animate-spin" />}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-1 rounded-xl border border-white/10 flex">
            {(['today', '7d', '30d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  period === p 
                  ? 'bg-action-primary text-white shadow-md' 
                  : 'text-white/40 hover:text-white/80'
                }`}
              >
                {p === 'today' ? "Aujourd'hui" : p === '7d' ? '7 Jours' : p === '30d' ? '30 Jours' : 'Tout'}
              </button>
            ))}
          </div>
          <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors tooltip-trigger" title="Exporter en CSV (Bientôt)">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* SECTION 1: GLOBAL KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Utilisateurs" value={users.total.toLocaleString()} icon={<Users />} color="text-blue-400" />
        <KpiCard title="Total Événements" value={events.total.toLocaleString()} icon={<Calendar />} color="text-green-400" />
        <KpiCard title="Volume Paiements" value={`€${(payments.volume / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={<CreditCard />} color="text-amber-400" />
        <KpiCard title="Total Badges" value={engagement.totalBadges.toLocaleString()} icon={<ShieldCheck />} color="text-purple-400" />
      </div>

      <hr className="border-white/5" />

      {/* SECTION 2: UTILISATEURS */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-action-primary" /> Utilisateurs & Rétention
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Actifs (Unique)</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-white/70">Aujourd'hui (DAU)</span>
                <span className="text-2xl font-bold text-white">{users.dau.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-white/70">7 Derniers Jours (WAU)</span>
                <span className="text-2xl font-bold text-white">{users.wau.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-white/70">30 Derniers Jours (MAU)</span>
                <span className="text-2xl font-bold text-action-primary">{users.mau.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Acquisition & Rétention</h3>
            <div className="flex items-center gap-4 mb-6">
              <div>
                <p className="text-3xl font-bold text-white">+{users.newPeriod.toLocaleString()}</p>
                <p className="text-sm text-white/40">Inscrits sur la période</p>
              </div>
              <div className={`px-2 py-1 rounded-md text-xs font-bold ${users.deltaPercentage >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {users.deltaPercentage >= 0 ? '+' : ''}{users.deltaPercentage.toFixed(1)}% vs préc.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-3 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Rétention 7j</p>
                <p className="text-lg font-bold text-white">{users.retention7d.toFixed(1)}%</p>
              </div>
              <div className="bg-black/20 p-3 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Rétention 30j</p>
                <p className="text-lg font-bold text-white">{users.retention30d.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Statut KYC</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={kycData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                    {kycData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* SECTION 3: EVENEMENTS */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-action-primary" /> Événements
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Statut global</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                  <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="value" fill="#4ADE80" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Répartition Catégories</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={eventCategoryData} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: '10px', fill: '#fff' }}>
                    {eventCategoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 flex flex-col justify-center gap-4">
            <div className="bg-black/20 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-white/50">Créés sur la période</p>
                <p className="text-2xl font-bold text-white">{events.period}</p>
              </div>
              <Activity className="w-8 h-8 text-white/10" />
            </div>
            <div className="flex gap-4">
              <div className="bg-black/20 p-4 rounded-xl flex-1">
                <p className="text-xs text-white/50 uppercase">Gratuits</p>
                <p className="text-xl font-bold text-white">{events.free}</p>
              </div>
              <div className="bg-black/20 p-4 rounded-xl flex-1">
                <p className="text-xs text-white/50 uppercase">Payants (Cagnotte)</p>
                <p className="text-xl font-bold text-white">{events.paid}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* SECTION 4: PAIEMENTS & VALIDATIONS */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-action-primary" /> Finances & Sécurité
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
            <p className="text-sm text-white/50 mb-1">Volume sur période</p>
            <p className="text-2xl font-bold text-white">€{(payments.volume / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-white/40 mt-2">{payments.transactions} transactions</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
            <p className="text-sm text-white/50 mb-1">Cagnottes Actives</p>
            <p className="text-2xl font-bold text-white">{payments.activePoolsCount}</p>
            <p className="text-xs text-white/40 mt-2">Fonds en attente de déblocage</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 border-l-4 border-l-amber-500">
            <p className="text-sm text-amber-500/80 mb-1">Votes Validateurs en cours</p>
            <p className="text-2xl font-bold text-white">{payments.openValidatorVotes}</p>
            <p className="text-xs text-white/40 mt-2">Nécessite attention si bloqué</p>
          </div>
          <div className="bg-action-primary/10 rounded-2xl p-5 border border-action-primary/20">
            <p className="text-sm text-action-primary mb-1">Commission Plateforme</p>
            <p className="text-xl font-bold text-white mt-1">N/A — à configurer</p>
            <p className="text-xs text-white/50 mt-2">Taux non défini en base</p>
          </div>
        </div>
      </div>

      {/* SECTION 5: ENGAGEMENT */}
      <div className="pb-10">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-action-primary" /> Engagement & Modération
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Messages envoyés</p>
              <p className="text-lg font-bold text-white">{engagement.messagesPeriod.toLocaleString()}</p>
            </div>
            <MessageSquare className="text-white/10 w-6 h-6" />
          </div>
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Moy. Amis/User</p>
              <p className="text-lg font-bold text-white">{engagement.avgFriendsPerUser.toFixed(1)}</p>
            </div>
            <Users className="text-white/10 w-6 h-6" />
          </div>
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Signalements PENDING</p>
              <p className="text-lg font-bold text-red-400">{engagement.pendingReports}</p>
            </div>
            <ShieldCheck className="text-red-500/20 w-6 h-6" />
          </div>
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Utilisateurs bloqués</p>
              <p className="text-lg font-bold text-white">{engagement.blockedUsers}</p>
            </div>
            <ShieldCheck className="text-white/10 w-6 h-6" />
          </div>
        </div>
      </div>

    </div>
  );
}

function KpiCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
      <div>
        <p className="text-sm font-medium text-white/50">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-xl bg-white/5 ${color} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
    </div>
  );
}
