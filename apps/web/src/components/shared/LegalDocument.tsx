import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { currentLang } from '@/lib/locale'

/**
 * Rendu des documents légaux (CGU = Partie I, Politique de confidentialité = Partie II).
 * Le contenu (Version 2.0) vit dans `src/content/legal/{fr,en,es}.json` — la version française fait foi.
 * Chargé à la demande selon la langue active, pour ne pas alourdir le bundle principal.
 */

type Block =
  | { p: string }
  | { h: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } }

interface Article { n: number; title: string; blocks: Block[] }

interface LegalContent {
  keyPoints: { title: string; intro: string; table: { head: string[]; rows: string[][] } }
  cgu: Article[]
  privacy: Article[]
}

const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  fr: () => import('@/content/legal/fr.json'),
  en: () => import('@/content/legal/en.json'),
  es: () => import('@/content/legal/es.json'),
}

/** Rend les emails et le numéro de contact cliquables dans le texte. */
const LINK_RE = /([\w.+-]+@[\w-]+\.[\w.]+|\+229 01 66 65 23 13)/g
function linkify(text: string): ReactNode {
  const parts = text.split(LINK_RE)
  return parts.map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>
    const href = part.includes('@') ? `mailto:${part.replace(/\.$/, '')}` : `tel:${part.replace(/\s/g, '')}`
    return <a key={i} href={href} className="text-[#FF7A00] font-medium hover:underline">{part}</a>
  })
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-[#2A2A2A]">
      <table className="w-full text-[13px] text-left">
        <thead className="bg-[#FFF3E6] dark:bg-[#FF7A00]/10">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-semibold text-gray-900 dark:text-white align-top"><span>{h}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-gray-100 dark:border-[#2A2A2A]">
              {row.map((cell, c) => (
                <td key={c} className={`px-3 py-2 align-top ${c === 0 ? 'font-medium text-gray-800 dark:text-gray-200' : ''}`}>
                  <span>{linkify(cell)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ArticleView({ article, label }: { article: Article; label: string }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="text-[17px] font-bold font-poppins text-gray-900 dark:text-white mb-4 border-l-4 border-[#FF7A00] pl-3">
        <span>{label}</span>
      </h2>
      <div className="text-[14px] text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
        {article.blocks.map((b, i) => {
          if ('h' in b) return <h3 key={i} className="text-[15px] font-semibold font-poppins text-gray-800 dark:text-gray-200 pt-2"><span>{b.h}</span></h3>
          if ('p' in b) return <p key={i}><span>{linkify(b.p)}</span></p>
          if ('ul' in b) {
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5">
                {b.ul.map((li, j) => <li key={j}><span>{linkify(li)}</span></li>)}
              </ul>
            )
          }
          return <Table key={i} head={b.table.head} rows={b.table.rows} />
        })}
      </div>
    </section>
  )
}

export function LegalDocument({ part }: { part: 'terms' | 'privacy' }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = currentLang()
  const [content, setContent] = useState<LegalContent | null>(null)

  useEffect(() => {
    let alive = true
    const load = LOADERS[lang] ?? LOADERS.fr
    load()
      .then((m) => { if (alive) setContent(m.default as LegalContent) })
      .catch(() => { LOADERS.fr().then((m) => { if (alive) setContent(m.default as LegalContent) }) })
    return () => { alive = false }
    // i18n.language : recharge si l'utilisateur change de langue
  }, [lang, i18n.language])

  const isTerms = part === 'terms'
  const articles = content ? (isTerms ? content.cgu : content.privacy) : []

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#F5F5F5] dark:bg-[#111111] font-inter">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center gap-3 sticky top-0 z-10 border-b border-gray-100 dark:border-[#2A2A2A] flex-shrink-0">
        <button
          type="button"
          onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/settings')}
          aria-label={t('common.back')}
          className="w-9 h-9 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
        </button>
        <h1 className="text-[20px] font-bold font-poppins text-gray-900 dark:text-white leading-tight">
          <span>{isTerms ? t('legal.termsTitle') : t('legal.privacyTitle')}</span>
        </h1>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        <div className="max-w-[760px] mx-auto bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-8 border-b border-gray-100 dark:border-[#2A2A2A] pb-5">
            <h2 className="text-[14px] font-bold uppercase tracking-wider text-[#FF7A00] mb-2 font-poppins">
              <span>{isTerms ? t('legal.partI') : t('legal.partII')}</span>
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <strong className="text-gray-700 dark:text-gray-300"><span>{t('legal.versionLabel')}</span></strong> <span>{t('legal.versionValue')}</span><br />
              <strong className="text-gray-700 dark:text-gray-300"><span>{t('legal.publisherLabel')}</span></strong> <span>{t('legal.publisherValue')}</span><br />
              <strong className="text-gray-700 dark:text-gray-300"><span>{t('legal.headOfficeLabel')}</span></strong> <span>{t('legal.headOfficeValue')}</span><br />
              <span>{t('legal.registration')}</span><br />
              <a href="mailto:fihodecorp@gmail.com" className="text-[#FF7A00] font-medium hover:underline">fihodecorp@gmail.com</a>
              {' | '}
              <a href="tel:+2290166652313" className="text-[#FF7A00] font-medium hover:underline">+229 01 66 65 23 13</a>
            </p>
            {lang !== 'fr' && (
              <p className="mt-3 text-[12px] italic text-gray-500 dark:text-gray-400"><span>{t('legal.frenchPrevails')}</span></p>
            )}
          </div>

          {!content ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" aria-hidden="true" />
            </div>
          ) : (
            <>
              {isTerms && (
                <section className="mb-10 p-4 rounded-2xl bg-[#F9F9F9] dark:bg-[#222222] border border-gray-100 dark:border-[#2A2A2A]">
                  <h2 className="text-[17px] font-bold font-poppins text-gray-900 dark:text-white mb-2">
                    <span>{content.keyPoints.title}</span>
                  </h2>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3"><span>{content.keyPoints.intro}</span></p>
                  <div className="text-gray-600 dark:text-gray-300">
                    <Table head={content.keyPoints.table.head} rows={content.keyPoints.table.rows} />
                  </div>
                </section>
              )}
              {articles.map((a) => (
                <ArticleView key={a.n} article={a} label={t('legal.articleTitle', { n: a.n, title: a.title })} />
              ))}
            </>
          )}

          <div className="mt-10 pt-6 border-t border-gray-100 dark:border-[#2A2A2A] text-[13px] flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="text-[#FF7A00] font-medium hover:underline"><span>{t('legal.backHome')}</span></Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link
              to={isTerms ? '/privacy' : '/terms'}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <span>{isTerms ? t('legal.privacyTitle') : t('legal.termsTitle')}</span>
            </Link>
          </div>
          <p className="mt-4 text-center text-[11px] text-gray-400"><span>{t('legal.footer')}</span></p>
        </div>
      </div>
    </div>
  )
}
