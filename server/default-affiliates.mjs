export const DEFAULT_AFFILIATE_PARTNERS = [
  {
    id: 'coupang',
    enabled: true,
    order: 10,
    locales: ['ko'],
    icon: '🚀',
    url: 'https://link.coupang.com/a/iSnsj2FEfk',
    name: {
      ko: '쿠팡',
      en: 'Coupang'
    },
    badge: {
      ko: '파트너스',
      en: 'Partners'
    },
    desc: {
      ko: '로켓배송 · 홈술 안주·제빙기·하이볼 잔·칵테일 쉐이커',
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
    url: 'https://ozip.me/u15xC78?af',
    name: {
      ko: '오늘의집',
      en: 'Ohouse'
    },
    badge: {
      ko: '큐레이터',
      en: 'Curator'
    },
    desc: {
      ko: '오늘의집 베스트 · 홈술 잔·인테리어·리빙 아이템 (큐레이터 ID: 49696)',
      en: 'Home bar glassware, interior & living picks'
    },
    disclosure: {
      ko: '이 포스팅은 오늘의집 큐레이터 활동의 일환으로, 구매시 이에 따른 일정액의 수수료를 제공받습니다.'
    }
  },
  {
    id: 'amazon-us',
    enabled: true,
    order: 30,
    locales: ['en'],
    icon: '📦',
    url: 'https://www.amazon.com/gp/bestsellers/?tag=ksool-20',
    name: {
      en: 'Amazon US',
      ko: '아마존 US'
    },
    badge: {
      en: 'Associate',
      ko: '제휴'
    },
    desc: {
      en: 'Amazon Bestsellers · Home-bar glassware, ice makers & cocktail essentials',
      ko: '아마존 베스트셀러 · 홈바 글라스·제빙기·칵테일 용품'
    },
    disclosure: {
      en: 'As an Amazon Associate I earn from qualifying purchases.'
    }
  },
  {
    id: 'amazon-jp',
    enabled: true,
    order: 40,
    locales: ['ja'],
    icon: '📦',
    url: 'https://www.amazon.co.jp/gp/bestsellers/?tag=ksool-22',
    name: {
      ja: 'Amazon.co.jp',
      en: 'Amazon JP'
    },
    badge: {
      ja: 'アソシエイト',
      en: 'Associate'
    },
    desc: {
      ja: 'Amazon 売れ筋ランキング · 宅飲みグラス・シェイカー・おつまみアイテム',
      en: 'Amazon JP Bestsellers · Glassware, shakers & home-bar picks'
    },
    disclosure: {
      ja: 'Amazonのアソシエイトとして、適格販売により収入を得ています。'
    }
  },
  {
    id: 'rakuten',
    enabled: true,
    order: 50,
    locales: ['ja'],
    icon: '🛍️',
    url: 'https://search.rakuten.co.jp/search/mall/%E9%9F%93%E5%9B%BD%E9%85%92/',
    name: {
      ja: '楽天市場',
      en: 'Rakuten'
    },
    badge: {
      ja: 'アフィリエイト',
      en: 'Affiliate'
    },
    desc: {
      ja: '焼酎・マッコリ・おうち居酒屋にぴったりの酒器とおつまみ',
      en: 'Soju, makgeolli & izakaya barware'
    },
    disclosure: {
      ja: '本リンクは楽天アフィリエイトプログラムを利用しており、購入により紹介料を受け取る場合があります。'
    }
  },
  {
    id: 'amazon-fr',
    enabled: true,
    order: 60,
    locales: ['fr'],
    icon: '📦',
    url: 'https://www.amazon.fr/s?k=verre+cocktail+shaker+bar',
    name: {
      fr: 'Amazon France',
      en: 'Amazon FR'
    },
    badge: {
      fr: 'Partenaire',
      en: 'Partner'
    },
    desc: {
      fr: 'Verres à cocktail, shakers et accessoires de bar coréen à la maison',
      en: 'Cocktail glasses, shakers & home-bar accessories'
    },
    disclosure: {
      fr: 'En tant que Partenaire Amazon, ce site réalise un bénéfice sur les achats remplissant les conditions requises.'
    }
  },
  {
    id: 'aliexpress',
    enabled: true,
    order: 70,
    locales: ['en', 'zh-CN', 'zh-TW', 'fr'],
    icon: '🌏',
    url: 'https://www.aliexpress.com/wholesale?SearchText=cocktail+barware+soju+glass',
    name: {
      en: 'AliExpress',
      'zh-CN': '速卖通 AliExpress',
      'zh-TW': '全球速賣通 AliExpress',
      fr: 'AliExpress'
    },
    badge: {
      en: 'Affiliate',
      'zh-CN': '联盟推荐',
      'zh-TW': '聯盟推薦',
      fr: 'Affilié'
    },
    desc: {
      en: 'Global barware, novelty shot glasses & party drinking props',
      'zh-CN': '全球精选调酒器具、创意酒杯与聚会酒桌道具',
      'zh-TW': '全球精選調酒器具、創意酒杯與聚會酒桌道具',
      fr: 'Accessoires de bar, verres à shot originaux et jeux de soirée'
    },
    disclosure: {
      en: 'This link is part of an affiliate program and may earn a commission at no extra cost to you.',
      'zh-CN': '本链接包含联盟推广信息，通过该链接购买可能会为本站带来一定比例的佣金收入。',
      'zh-TW': '本連結包含聯盟推廣資訊，透過該連結購買可能會為本站帶來一定比例的佣金收入。',
      fr: 'Ce lien fait partie d’un programme d’affiliation et peut générer une commission sans coût supplémentaire pour vous.'
    }
  },
  {
    id: 'amazon-global',
    enabled: true,
    order: 80,
    locales: ['zh-CN', 'zh-TW'],
    icon: '🌐',
    url: 'https://www.amazon.com/gp/bestsellers/?tag=ksool-20',
    name: {
      en: 'Amazon Global',
      'zh-CN': '亚马逊海外购',
      'zh-TW': 'Amazon 全球購'
    },
    badge: {
      en: 'Associate',
      'zh-CN': '全球购',
      'zh-TW': '全球購'
    },
    desc: {
      en: 'Amazon Bestsellers & international shipping for home-bar essentials',
      'zh-CN': 'Amazon 畅销榜单 · 支持跨境直邮的调酒套装与特色酒具',
      'zh-TW': 'Amazon 熱銷榜單 · 支援跨境直郵的調酒套裝與特色酒具'
    },
    disclosure: {
      en: 'As an Amazon Associate I earn from qualifying purchases.',
      'zh-CN': 'As an Amazon Associate I earn from qualifying purchases.',
      'zh-TW': 'As an Amazon Associate I earn from qualifying purchases.'
    }
  }
];
