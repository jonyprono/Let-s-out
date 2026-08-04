# Let s Out - Terminology Reference

> This file is the **single source of truth** for approved translations.
> Consult it before any new i18n work and before running translate.mjs.
> Update it whenever a new term is validated.

---

## FINANCIAL TERMS

| Concept | FR Francais | EN English | Notes |
|---|---|---|---|
| Retrait d argent (action) | Retrait | Withdrawal | Never "removal" |
| Bouton de retrait | Retirer | Withdraw | Never "Remove" -- DeepL error caught |
| Portefeuille / espace argent | Portefeuille | Wallet | Never "Portfolio" -- DeepL error caught |
| Cagnotte (pool d evenement) | Cagnotte | Pool | Never "pot", "fund" or "prize pool" |
| Cagnotte debloquee | Cagnotte debloquee | Unlocked pool | |
| Solde disponible | Solde disponible | Available balance | |
| Solde total | Solde total | Total balance | |
| Disponible pour retrait | Disponible pour retrait | Available for withdrawal | Never "for collection" -- DeepL error caught |
| Total gagne | Total gagne | Total earned | Never "Total won" -- DeepL error caught |
| Securite du portefeuille | Securite du portefeuille | Wallet security | Never "Portfolio security" |
| Parametres du portefeuille | Parametres du portefeuille | Wallet settings | Never "Portfolio settings" |
| Code PIN | Code PIN | PIN | Acronym, always uppercase |
| Verifier (PIN/identite) | Verifier | Verify | Never "Check" in security context |
| Frais | Frais | Fees | |
| Operateur mobile money | Operateur | Operator | |
| Depuis (origine des fonds) | Depuis | From | Never "Since" -- DeepL error caught |
| Vers (destination) | Vers | To | Never "Towards" -- DeepL error caught |
| Transaction echouee | Echoue | Failed | Never "Stranded" -- DeepL error caught |
| Transaction terminee | Termine | Completed | "Done" acceptable in informal context |
| Transaction en cours | En cours | Pending | |
| Depot | Depot | Deposit | |
| Remboursement | Remboursement | Refund | |

---

## SOCIAL / PROFILE TERMS

| Concept | FR Francais | EN English | Notes |
|---|---|---|---|
| Abonnes (recus) | Abonnes | Followers | Standard social network term -- never "Subscribers" |
| Abonnements (envoyes) | Abonnements | Following | Standard social network term -- never "Subscriptions" |
| Statut abonne | Abonne(e) | Following | Never "Subscriber" |
| Bouton suivre | + Suivre | + Follow | |
| Ami(s) | Ami(e)s | Friends | Keep English "Friends" not "Mates" |
| Prix libre | Libre | Flexible | Never "Free" -- would clash with profile.free |
| Gratuit | Gratuit | Free | Used for 0-price events |
| Ticket (mode de paiement) | Ticket | Ticket | Unchanged in both languages |
| Entree (mode de paiement) | Entree | Entry | |
| Brouillon | Brouillon | Draft | |
| Reprendre un brouillon | Reprendre le brouillon | Resume draft | |

---

## NAVIGATION TERMS

| Concept | FR Francais | EN English | Notes |
|---|---|---|---|
| Accueil | Accueil | Home | |
| Explorer | Explorer | Explore | |
| Messages | Messages | Messages | Unchanged |
| Compte | Compte | Account | |
| Profil | Profil | Profile | |

---

## MESSAGES / CHAT TERMS

| Concept | FR Francais | EN English | Notes |
|---|---|---|---|
| Tout (filtre) | Tout | All | Never "Everything" -- DeepL error caught |
| Epingler | Epingler | Pin | |
| Desepingler | Desepingler | Unpin | |
| Mettre en sourdine | Mettre en sourdine | Mute | |
| Reactiver le son | Reactiver le son | Unmute | |
| Marquer comme lu | Marquer comme lu | Mark as read | |
| Marquer comme non lu | Marquer comme non lu | Mark as unread | |
| Nouvelle conversation | Nouvelle conversation | New conversation | |

---

## UI / GENERAL TERMS

| Concept | FR Francais | EN English | Notes |
|---|---|---|---|
| Enregistrement en cours | Enregistrement... | Saving... | Never "Recording..." -- DeepL error caught |
| En cours (evenement actif) | En cours | Ongoing | Never "In progress" for time filter |
| En cours (transaction) | En cours | Pending | Use "Pending" for transaction status |
| Actualisation | Actualisation... | Refreshing... | |
| Reessayer | Reessayer | Retry | |
| Securite | Securite | Security | Never "Safety" in account context |

---

## TRANSLATION WORKFLOW

### Generating a new language
```
node scripts/translate.mjs --lang es
node scripts/translate.mjs --lang pt
node scripts/translate.mjs --lang de
```

### After each DeepL run - mandatory checks
1. Search for "Portfolio" in the output JSON -> replace with "Wallet"
2. Search for "Subscribers" -> replace with "Followers"
3. Search for "Recording" -> replace with "Saving"
4. Search for "Towards" / "Since" in wallet context -> replace with "To" / "From"
5. Check all financial buttons (withdrawBtn, confirmWithdraw) for accuracy
6. Run: npx tsc --noEmit

### Characters consumed per run
- FR to EN : ~7,852 chars (357 keys)
- DeepL Free quota : 500,000 chars/month
- Headroom : ~63 full runs remaining on free tier

---

Last updated: 2026-08-04 -- EN validated after DeepL run + manual corrections