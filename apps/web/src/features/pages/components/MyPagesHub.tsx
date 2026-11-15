import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BarChart3, Eye, LayoutDashboard, Loader2, Megaphone, Plus, RefreshCw, Settings2, Sparkles, Users } from 'lucide-react'
import { TopBar } from '@/components/ui/TopBar'
import { SafeImage } from '@/components/shared/SafeImage'
import { pagesApi, Page } from '../api'
import { pageCategoryLabel } from '../categories'

/** Hub « Mes pages » (depuis Paramètres) : les pages que je gère + création. */
export function MyPagesHub() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const nf = new Intl.NumberFormat(i18n.language || 'fr')

  // Même clé que PagesHub → cache partagé, invalidé à la création d'une page
  const { data: pages, isLoading, isError, refetch } = useQuery({
    queryKey: ['pages', 'me'],
    queryFn: () => pagesApi.getMyPages(),
  })

  const goCreate = () => navigate('/pages/create')

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden">
      <TopBar
        title={t('myPages.title')}
        onBack={() => navigate(-1)}
        containerClassName="pt-safe-4 pt-4 shrink-0 border-b border-gray-100 dark:border-gray-800"
        rightAction={
          pages && pages.length > 0 ? (
            <button
              type="button"
              onClick={goCreate}
              className="flex items-center gap-1 bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all shrink-0 shadow-sm shadow-[#FF7A00]/20"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('myPages.create')}</span>
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-6">
        {isLoading ? (
          <div className="flex justify-center py-20" role="status">
            <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" aria-hidden="true" />
            <span className="sr-only">{t('myPages.loading')}</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-[14px] text-gray-500 dark:text-gray-400"><span>{t('myPages.loadError')}</span></p>
            <button type="button" onClick={() => refetch()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF7A00] text-white text-[13px] font-semibold">
              <RefreshCw className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.retry')}</span>
            </button>
          </div>
        ) : !pages || pages.length === 0 ? (
          <EmptyState onCreate={goCreate} />
        ) : (
          <div className="flex flex-col gap-3 max-w-xl mx-auto">
            <p className="text-[13px] text-gray-500 dark:text-gray-400"><span>{t('myPages.count', { count: pages.length })}</span></p>
            {pages.map((p) => <PageCard key={p.id} page={p} nf={nf} />)}
            <button
              type="button"
              onClick={goCreate}
              className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-[#FF7A00]/40 text-[#E06C00] dark:text-[#FF7A00] text-[14px] font-semibold active:scale-[0.99] transition-transform"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.createAnother')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PageCard({ page, nf }: { page: Page; nf: Intl.NumberFormat }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const followers = page._count?.followers ?? 0
  const posts = page._count?.posts ?? 0

  return (
    <article className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#111111] overflow-hidden">
      <button type="button" onClick={() => navigate(`/pages/${page.id}/manage`)} className="w-full flex items-center gap-3 p-4 text-left">
        {page.avatarUrl ? (
          <SafeImage src={page.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-[#FFF2D3] dark:bg-[#FF7A00]/15 text-[#E06C00] dark:text-[#FF7A00] text-[20px] font-bold flex items-center justify-center shrink-0">
            <span>{page.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold truncate"><span>{page.name}</span></p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate"><span>{pageCategoryLabel(page.category)}</span></p>
          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('myPages.followersCount', { count: followers, formatted: nf.format(followers) })}</span></span>
            <span className="flex items-center gap-1"><Megaphone className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('myPages.postsCount', { count: posts, formatted: nf.format(posts) })}</span></span>
          </div>
        </div>
      </button>
      <div className="grid grid-cols-3 border-t border-gray-100 dark:border-gray-800 text-[12px] font-semibold">
        <button type="button" onClick={() => navigate(`/pages/${page.id}/manage`)} className="flex items-center justify-center gap-1.5 py-2.5 text-[#E06C00] dark:text-[#FF7A00]">
          <Settings2 className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.manage')}</span>
        </button>
        <button type="button" onClick={() => navigate(`/pages/${page.id}/manage`, { state: { section: 'stats' } })} className="flex items-center justify-center gap-1.5 py-2.5 border-x border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200">
          <BarChart3 className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.stats')}</span>
        </button>
        <button type="button" onClick={() => navigate(`/pages/${page.id}`)} className="flex items-center justify-center gap-1.5 py-2.5 text-gray-700 dark:text-gray-200">
          <Eye className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.view')}</span>
        </button>
      </div>
    </article>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  const perks = [
    { icon: Sparkles, title: t('myPages.perkIdentityTitle'), desc: t('myPages.perkIdentityDesc') },
    { icon: Megaphone, title: t('myPages.perkReachTitle'), desc: t('myPages.perkReachDesc') },
    { icon: BarChart3, title: t('myPages.perkStatsTitle'), desc: t('myPages.perkStatsDesc') },
  ]
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto pt-6">
      <div className="w-20 h-20 rounded-3xl bg-[#FFF2D3] dark:bg-[#FF7A00]/15 flex items-center justify-center mb-5">
        <LayoutDashboard className="w-10 h-10 text-[#E06C00] dark:text-[#FF7A00]" aria-hidden="true" />
      </div>
      <h2 className="text-[20px] font-bold mb-2"><span>{t('myPages.emptyTitle')}</span></h2>
      <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6"><span>{t('myPages.emptyDesc')}</span></p>
      <ul className="w-full flex flex-col gap-2.5 mb-7 text-left">
        {perks.map(({ icon: Icon, title, desc }) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-gray-50 dark:bg-[#111111] p-3.5">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-black flex items-center justify-center shrink-0">
              <Icon className="w-[18px] h-[18px] text-[#E06C00] dark:text-[#FF7A00]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[14px] font-semibold"><span>{title}</span></p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400"><span>{desc}</span></p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCreate}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FF7A00] hover:bg-[#E06C00] text-white text-[15px] font-bold shadow-lg shadow-[#FF7A00]/25 active:scale-[0.98] transition-transform"
      >
        <Plus className="w-5 h-5" aria-hidden="true" /><span>{t('myPages.create')}</span>
      </button>
    </div>
  )
}
