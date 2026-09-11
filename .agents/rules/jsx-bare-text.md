# Regle : Encapsulation des textes dynamiques en JSX

## Contexte

Ce projet utilise React 18. Les extensions de traduction (Google Translate, DeepL, etc.) peuvent manipuler le DOM directement en enveloppant des noeuds texte nus dans une balise <font>. Lors d'un re-rendu rapide (ex. changement d'etat isPending, ouverture/fermeture d'une modale), React perd la reference du noeud modifie et leve :

  NotFoundError: Cannot execute 'insertBefore' on 'Node'

Ce bug a ete rencontre sur plusieurs pages de l'administration (AdminSupportChats.tsx, /admin/settings, /admin/kyc).

## Regle obligatoire

> **Tout texte dynamique ou texte nu adjacent a un element conditionnel ou a une icone DOIT etre encapsule dans une balise <span>.**

## Correct

  // Texte adjacent a une icone -> encapsuler le texte
  <button>
    <CheckCircle />
    <span>Approuver</span>
  </button>

  // Texte conditionnel adjacent a un loader -> encapsuler
  <button>
    {isPending ? <Loader2 /> : <span>Confirmer</span>}
  </button>

## Incorrect (risque de crash)

  // Texte nu adjacent a une icone -> INTERDIT
  <button>
    <CheckCircle />
    Approuver
  </button>

  // Texte conditionnel retournant une string nue -> INTERDIT
  <button>
    {isPending ? <Loader2 /> : 'Confirmer'}
  </button>

## Cas particuliers a toujours verifier

- Boutons avec {isPending ? <Loader/> : 'Texte'} -> Le texte string doit etre un <span>
- Libelles de statuts (badges) avec une icone : <ShieldCheck /> Verifie -> Entourer le texte d'un <span>
- Pagination : Page {current} sur {total} -> Entourer les textes statiques de <span>
- Raisons/motifs dynamiques : Raison: {reason} -> Deux <span> separes
