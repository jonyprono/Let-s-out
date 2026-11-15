// 15 Catégories (12 existantes + 3 nouvelles) — source unique pour la création, la gestion et « Mes pages »
export const PAGE_CATEGORIES = [
  { label: 'Art et culture',               value: 'CULTURE'   },
  { label: 'Comédie',                      value: 'GAMING'    },
  { label: 'Sport',                        value: 'SPORT'     },
  { label: 'Santé et bien-être',           value: 'WELLNESS'  },
  { label: 'Cuisine et gastronomie',       value: 'FOOD'      },
  { label: 'Boissons',                     value: 'LIFESTYLE' },
  { label: 'Réseautage professionnel',     value: 'SOCIAL'    },
  { label: 'Fêtes',                        value: 'NIGHTLIFE' },
  { label: 'Religion',                     value: 'OTHER'     },
  { label: 'Shopping',                     value: 'TECH'      },
  { label: 'Musique et son',               value: 'MUSIC'     },
  { label: 'Télévision et cinéma',         value: 'ART'       },
  { label: 'Jeux vidéos & jeux de société', value: 'GAMING'    },
  { label: 'Concerts & festivals',         value: 'CONCERTS'  },
  { label: 'Voyages et découverte',        value: 'TRAVEL'    },
]

export const pageCategoryLabel = (value: string) =>
  PAGE_CATEGORIES.find((c) => c.value === value)?.label ?? value
