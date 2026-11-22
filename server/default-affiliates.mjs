export const DEFAULT_AFFILIATE_PARTNERS = [
  {
    id: 'coupang',
    enabled: true,
    order: 10,
    locales: ['ko'],
    icon: '🚀',
    url: 'https://link.coupang.com/a/iSnsj2FEfk',
    name: {
      ko: '쿠팡 (Coupang)',
      en: 'Coupang'
    },
    badge: {
      ko: '로켓배송',
      en: 'Rocket'
    },
    desc: {
      ko: '평소 사던 생필품·안주·전자기기 최저가 검색',
      en: 'Fast delivery for barware, ice makers & snacks'
    },
    disclosure: {
      ko: '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'
    }
  },
  {
    id: 'ohouse',
    enabled: true,
    order: 20,
    locales: ['ko'],
    icon: '🏠',
    url: 'https://ozip.me/uf9thsP?af',
    name: {
      ko: '오늘의집',
      en: 'Ohouse'
    },
    badge: {
      ko: '큐레이터',
      en: 'Curator'
    },
    desc: {
      ko: '오늘의집 베스트 · 홈술 잔·인테리어·리빙 아이템',
      en: 'Home bar glassware, interior & living picks'
    },
    disclosure: {
      ko: '이 포스팅은 오늘의집 큐레이터 활동의 일환으로, 구매시 이에 따른 일정액의 수수료를 제공받습니다.'
    }
  },
  {
    id: 'amazon-us',
    enabled: true,
    order: 10,
    locales: ['en'],
    icon: '📦',
    url: 'https://www.amazon.com/gp/bestsellers/?tag=ksool-20',
    name: {
      en: 'Amazon',
      ko: '아마존 US'
    },
    badge: {
      en: 'Prime Deals',
      ko: '제휴'
    },
    desc: {
      en: 'Everyday essentials, gaming gear & snacks',
      ko: '아마존 베스트셀러 · 홈바 글라스·제빙기·칵테일 용품'
    },
    disclosure: {
      en: 'As an Amazon Associate I earn from qualifying purchases.'
    }
  },
  {
    id: 'amazon-jp',
    enabled: true,
    order: 10,
    locales: ['ja'],
    icon: '📦',
    url: 'https://www.amazon.co.jp/gp/bestsellers/?tag=ksool-22',
    name: {
      ja: 'Amazon.co.jp',
      en: 'Amazon JP'
    },
    badge: {
      ja: '定番',
      en: 'Associate'
    },
    desc: {
      ja: '日用品・ガジェット・おつまみのお買い物に',
      en: 'Amazon JP Bestsellers · Glassware, shakers & home-bar picks'
    },
    disclosure: {
      ja: 'Amazonのアソシエイトとして、適格販売により収入を得ています。'
    }
  },
  {
    id: 'rakuten',
    enabled: true,
    order: 20,
    locales: ['ja'],
    icon: '🛒',
    url: 'https://www.rakuten.co.jp/',
    name: {
      ja: '楽天市場 (Rakuten)',
      en: 'Rakuten'
    },
    badge: {
      ja: 'ポイント',
      en: 'Affiliate'
    },
    desc: {
      ja: 'いつものお買い物で楽天ポイントもそのまま',
      en: 'Soju, makgeolli & izakaya barware'
    },
    disclosure: {
      ja: '※ 本リンクにはアフィリエイト広告（PR）が含まれています。'
    }
  },
  {
    id: 'amazon-fr',
    enabled: true,
    order: 10,
    locales: ['fr'],
    icon: '📦',
    url: 'https://www.amazon.fr/gp/bestsellers/?tag=ksool-21',
    name: {
      fr: 'Amazon.fr',
      en: 'Amazon FR'
    },
    badge: {
      fr: 'Populaire',
      en: 'Partner'
    },
    desc: {
      fr: 'Faites vos achats habituels sur Amazon France via ce passage secret',
      en: 'Cocktail glasses, shakers & home-bar accessories'
    },
    disclosure: {
      fr: 'En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.'
    }
  },
  {
    id: 'amazon-es',
    enabled: true,
    order: 10,
    locales: ['es'],
    icon: '📦',
    url: 'https://www.amazon.es/gp/bestsellers/?tag=ksool0b-21',
    name: {
      es: 'Amazon.es',
      en: 'Amazon ES'
    },
    badge: {
      es: 'Popular',
      en: 'Affiliate'
    },
    desc: {
      es: 'Haz tus compras habituales en Amazon España por este pasaje',
      en: 'Amazon Spain Bestsellers · Home-bar & everyday essentials'
    },
    disclosure: {
      es: 'En calidad de Afiliado de Amazon, obtengo ingresos por las compras adscritas que cumplen los requisitos aplicables.'
    }
  },
  {
    id: 'amazon-global',
    enabled: true,
    order: 15,
    locales: ['zh-CN', 'zh-TW'],
    icon: '🌐',
    url: 'https://www.amazon.com/gp/bestsellers/?tag=ksool-20',
    name: {
      en: 'Amazon Global',
      'zh-CN': '亚马逊海外购',
      'zh-TW': 'Amazon 全球購'
    },
    badge: {
      en: 'Worldwide',
      'zh-CN': '全球购',
      'zh-TW': '全球購'
    },
    desc: {
      en: 'International shipping for tech & daily essentials',
      'zh-CN': 'Amazon 畅销榜单 · 支持跨境直邮的调酒套装与特色酒具',
      'zh-TW': 'Amazon 熱銷榜單 · 支援跨境直郵的調酒套裝與特色酒具'
    },
    disclosure: {
      en: 'As an Amazon Associate I earn from qualifying purchases.',
      'zh-CN': 'As an Amazon Associate I earn from qualifying purchases.',
      'zh-TW': 'As an Amazon Associate I earn from qualifying purchases.'
    }
  },
  {
    id: 'ebay',
    enabled: true,
    order: 20,
    locales: ['en', 'fr', 'es', 'zh-CN', 'zh-TW'],
    icon: '🏷️',
    url: 'https://www.ebay.com/deals?mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339257555&customid=ksool&toolid=10001&mkevt=1',
    name: {
      en: 'eBay',
      fr: 'eBay',
      es: 'eBay',
      'zh-CN': 'eBay 全球特惠',
      'zh-TW': 'eBay 全球特惠'
    },
    badge: {
      en: 'Daily Deals',
      fr: 'Offres du jour',
      es: 'Ofertas',
      'zh-CN': '每日特惠',
      'zh-TW': '每日特惠'
    },
    desc: {
      en: 'Daily tech drops, collectibles & global deals',
      fr: 'Offres tech quotidiennes, objets de collection et promotions mondiales',
      es: 'Ofertas diarias de tecnología, coleccionables y envíos globales',
      'zh-CN': '全球精选数码、收藏品与每日特惠折扣',
      'zh-TW': '全球精選數位、收藏品與每日特惠折扣'
    },
    disclosure: {
      en: 'When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the eBay Partner Network.',
      fr: 'When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the eBay Partner Network.',
      es: 'When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the eBay Partner Network.',
      'zh-CN': 'When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the eBay Partner Network.',
      'zh-TW': 'When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the eBay Partner Network.'
    }
  },
  {
    id: 'aliexpress',
    enabled: true,
    order: 25,
    locales: ['zh-CN', 'zh-TW', 'fr', 'es'],
    icon: '🛍️',
    url: 'https://www.aliexpress.com/',
    name: {
      en: 'AliExpress',
      'zh-CN': '速卖通 AliExpress',
      'zh-TW': '全球速賣通 AliExpress',
      fr: 'AliExpress',
      es: 'AliExpress'
    },
    badge: {
      en: 'Best Value',
      'zh-CN': '超值精选',
      'zh-TW': '超值精選',
      fr: 'Bon plan',
      es: 'Ofertas'
    },
    desc: {
      en: 'Worldwide deals on accessories & collectibles',
      'zh-CN': '全球精选调酒器具、创意酒杯与聚会酒桌道具',
      'zh-TW': '全球精選調酒器具、創意酒杯與聚會酒桌道具',
      fr: 'Accessoires de bar, verres à shot originaux et jeux de soirée',
      es: 'Accesorios de bar, vasos originales y artículos para fiestas'
    },
    disclosure: {
      en: 'Affiliate link: we may earn a small commission at no extra cost to you.',
      'zh-CN': '本链接包含联盟推广信息，通过该链接购买可能会为本站带来一定比例的佣金收入。',
      'zh-TW': '本連結包含聯盟推廣資訊，透過該連結購買可能會為本站帶來一定比例的佣金收入。',
      fr: 'Lien affilié : nous pouvons percevoir une petite commission sans frais supplémentaires pour vous.',
      es: 'Enlace de afiliado: podemos recibir una pequeña comisión sin costo adicional para ti.'
    }
  },
  {
    id: 'temu',
    enabled: true,
    order: 30,
    locales: ['*'],
    icon: '🛍️',
    url: 'https://temu.to/k/gyzx2roqsct',
    name: {
      ko: 'Temu',
      en: 'Temu',
      ja: 'Temu',
      'zh-CN': 'Temu',
      'zh-TW': 'Temu',
      fr: 'Temu',
      es: 'Temu'
    },
    badge: {
      ko: 'rfa543944',
      en: 'rfa543944',
      ja: 'rfa543944',
      'zh-CN': 'rfa543944',
      'zh-TW': 'rfa543944',
      fr: 'rfa543944',
      es: 'rfa543944'
    },
    desc: {
      ko: '글로벌 특가 · 추천 코드 rfa543944 적용 가능',
      en: 'Global deals · Referral/discount code rfa543944 available',
      ja: 'グローバル特価 · 紹介コード rfa543944 利用可能',
      'zh-CN': '全球特惠 · 可使用推荐码 rfa543944',
      'zh-TW': '全球特惠 · 可使用推薦碼 rfa543944',
      fr: 'Offres mondiales · Code promo rfa543944 disponible',
      es: 'Ofertas globales · Código de descuento rfa543944 disponible'
    },
    disclosure: {
      ko: '이 콘텐츠는 제휴 마케팅 활동의 일환으로, 구매 시 일정액의 수수료를 제공받습니다.',
      en: 'Affiliate disclosure: We may earn a commission from qualifying purchases.',
      ja: 'Affiliate disclosure: We may earn a commission from qualifying purchases.',
      'zh-CN': 'Affiliate disclosure: We may earn a commission from qualifying purchases.',
      'zh-TW': 'Affiliate disclosure: We may earn a commission from qualifying purchases.',
      fr: 'Affiliate disclosure: We may earn a commission from qualifying purchases.',
      es: 'Affiliate disclosure: We may earn a commission from qualifying purchases.'
    }
  }
];
