/**
 * AUTH-UI TOKENS — Design System Let's Out
 * ─────────────────────────────────────────
 * Grille mobile 4 colonnes :
 *   - Margin latérale : 16px (space.200 = 1rem) → px-200
 *   - Gutter : 16px
 *   - Base unité : 8px
 *
 * Input uniforme :
 *   - Hauteur : 52px (var --input-height)
 *   - Padding interne : 0 16px (px-200)
 *   - Border : 1px solid neutral/gray/300
 *   - Border-radius : 12px
 *   - Font-size : 15px
 *
 * Bouton Principal (filled) :
 *   - Fond : brand/orange/500 (#FF7A00)
 *   - Texte : white, centré, font-semibold 15px
 *   - Hauteur : 52px
 *   - Border-radius : 100px (pill)
 *   - Disabled : brand/orange/100 (#FFF9EC), texte atténué
 *
 * Bouton Secondaire (outline) :
 *   - Fond : white
 *   - Bordure : 1px solid neutral/gray/300
 *   - Texte : neutral/gray/900
 *   - Hauteur : 52px
 *   - Border-radius : 100px (pill)
 */

/** Wrapper de page auth complet */
export const authShell =
  'auth-flow w-full h-full flex flex-col bg-background-default text-foreground transition-colors overflow-hidden relative'

/** Conteneur scrollable avec marges latérales strictes de 16px */
export const authScrollArea =
  'flex-1 overflow-y-auto px-200 pt-300 pb-200'

/** Titre principal de l'écran (gauche, grand, gras) */
export const authTitle =
  'text-[22px] font-bold text-foreground leading-tight tracking-tight'

/** Titre très grand pour les écrans Welcome/choix */
export const authTitleLg =
  'text-[26px] font-bold text-center text-foreground leading-tight tracking-tight'

/** Titre de header centré (Inscription, Connexion) */
export const authHeader =
  'text-[15px] font-semibold text-foreground'

/** Sous-titre / description sous le titre */
export const authSubtitle =
  'text-[13px] leading-relaxed text-text-secondary mt-150'

/** Label de champ de formulaire */
export const authLabel =
  'block text-[13px] font-medium text-text-secondary mb-100'

/**
 * INPUT UNIFORME — toutes saisies auth identiques :
 * h-[44px], px-[12px], border-[1.25px], rounded-[8px], text-[15px]
 */
export const authInput =
  'w-full h-[44px] px-[12px] border-[1.25px] border-[#E0E0E0] rounded-[8px] text-[15px] font-normal bg-background-white text-foreground placeholder:text-neutral-gray-400 focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-inset focus:ring-action-primary transition-all duration-200'

/** Input en flex (avec composant à gauche) */
export const authInputFlex =
  'flex-1 min-w-0 h-[44px] px-[12px] border-[1.25px] border-[#E0E0E0] rounded-[8px] text-[15px] font-normal bg-background-white text-foreground placeholder:text-neutral-gray-400 focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-inset focus:ring-action-primary transition-all duration-200'

/**
 * Input téléphone en flex — comme authInputFlex mais SANS text-[15px] ni font-normal
 * pour que la classe CSS `auth-phone-input` (Poppins 14px Medium) s'applique sans conflit.
 */
export const authPhoneInputFlex =
  'flex-1 min-w-0 h-[52px] px-200 border border-border-primary rounded-[12px] bg-background-white text-foreground focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-inset focus:ring-action-primary transition-all duration-200'

/**
 * BOUTON PRINCIPAL — filled orange pill
 * brand/orange/500, texte blanc, h-[52px], rounded-full
 */
export const authPrimaryBtn =
  'w-full min-h-[52px] h-auto py-3 rounded-full bg-action-primary text-text-inverse font-semibold text-[15px] flex flex-col sm:flex-row items-center justify-center gap-150 active:scale-[0.98] transition-all disabled:bg-brand-orange-100 disabled:text-brand-orange-400 disabled:cursor-not-allowed text-center break-words max-w-full px-4'

/**
 * BOUTON SECONDAIRE — outline blanc
 * fond blanc, bordure neutral/gray/300, texte neutre, h-[52px]
 */
export const authSecondaryBtn =
  'w-full min-h-[52px] h-auto py-3 rounded-full bg-background-white border border-border-primary text-foreground font-semibold text-[15px] flex flex-col sm:flex-row items-center justify-center gap-150 active:scale-[0.98] transition-all text-center break-words max-w-full px-4'

/** Bouton ghost (sans fond, sans bordure, juste texte) */
export const authGhostBtn =
  'w-full min-h-[52px] h-auto py-3 rounded-full text-foreground font-semibold text-[15px] flex flex-col sm:flex-row items-center justify-center active:opacity-70 transition-all text-center break-words max-w-full px-4'

/** Bouton canal (SMS / WhatsApp) — card avec radio interne */
export const authChannelBtn =
  'flex-1 flex items-center px-200 h-[52px] border border-border-primary rounded-[12px] bg-background-white transition-colors gap-100'

/** Label du bouton canal */
export const authChannelLabel =
  'flex-1 text-left text-[15px] font-medium text-foreground'

/** Séparateur horizontal avec texte ("ou") */
export const authDivider =
  'flex items-center gap-150 my-300'

/** Texte secondaire dans un séparateur */
export const authDividerText =
  'text-[12px] text-text-secondary whitespace-nowrap'

/** Lien orange (ex: "Mot de passe oublié ?", "Inscrivez-vous") */
export const authLink =
  'text-action-primary font-semibold hover:text-action-primary-hover transition-colors'
