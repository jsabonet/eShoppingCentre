export interface Category {
  id: string;
  slug: string;
  name: string;
  image: string;
  description: string;
  productCount: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  stock: number;
  image: string | null;
  attributes: Record<string, string>;
  is_active: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  image: string;
  images?: string[];
  category: string;
  rating: number;
  reviewCount: number;
  badge?: 'sale' | 'new';
  inStock: boolean;
  featured?: boolean;
  brand?: string;
  condition?: string;
  warrantyDays?: number;
  videoUrl?: string;
  variants?: ProductVariant[];
  // Extended fields
  sku?: string;
  barcode?: string;
  weight?: string;
  height?: string;
  width?: string;
  length?: string;
  tags?: string[];
  specifications?: Record<string, string>;
  salesCount?: number;
  storeName?: string;
  storeSlug?: string;
  storeId?: string;
  // Digital product fields
  productType?: 'physical' | 'digital' | 'course';
  digitalFormat?: string;
  digitalVersion?: string;
  digitalLicense?: string;
  digitalCompatibility?: string;
  digitalFileSize?: string;
  downloadLimit?: number;
  downloadExpiryDays?: number;
  // Affiliate fields
  affiliateEnabled?: boolean;
  affiliateCommission?: number;
  affiliateCookieDays?: number | null;
  affiliateTerms?: string;
  // Course product fields
  course?: {
    course_id: string;
    instructor_name: string;
    level: string;
    level_display: string;
    duration: string;
    total_lessons: number;
    certificate_enabled: boolean;
    preview_video_url: string;
    modules_count: number;
    curriculum?: {
      id: string;
      title: string;
      description: string;
      sort_order: number;
      lessons: {
        id: string;
        title: string;
        duration: string;
        is_free_preview: boolean;
        sort_order: number;
      }[];
    }[];
  };
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
}

export const categories: Category[] = [
  {
    id: '1',
    slug: 'eletronicos',
    name: 'Eletrônicos',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/56e72244-7e6e-11f1-aa5b-0242ac110002-yjXh3bREw9gkkGKl4Y0go.jpg',
    description: 'Smartphones, laptops, tablets e acessórios tech',
    productCount: 1250
  },
  {
    id: '2',
    slug: 'moda',
    name: 'Moda',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573236fc-7e6e-11f1-b28a-0242ac110002-Mx9rZvBhnQsQIHRgeCPAG.jpg',
    description: 'Roupas, calçados e acessórios',
    productCount: 3420
  },
  {
    id: '3',
    slug: 'casa-jardim',
    name: 'Casa & Jardim',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/56e3e86a-7e6e-11f1-9b16-0242ac110002-lV9iFfIRaKz-QW2YWUhD6.jpg',
    description: 'Móveis, decoração e eletrodomésticos',
    productCount: 2180
  },
  {
    id: '4',
    slug: 'esportes',
    name: 'Esportes & Lazer',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573c246b-7e6e-11f1-83ef-0242ac110002-LfqQWIttrFF90TjHS8m0X.jpg',
    description: 'Equipamentos esportivos e fitness',
    productCount: 890
  },
  {
    id: '5',
    slug: 'livros',
    name: 'Livros & Papelaria',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5729da18-7e6e-11f1-8959-0242ac110002-u74DnDEIKmnEx7YezLu3D.jpg',
    description: 'Livros, e-books e material escolar',
    productCount: 1560
  },
  {
    id: '6',
    slug: 'beleza',
    name: 'Beleza & Saúde',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/572ee84c-7e6e-11f1-b4a2-0242ac110002-aHyApdhI4PA2HgkYDy9bm.jpg',
    description: 'Cosméticos, perfumes e cuidados pessoais',
    productCount: 2340
  },
  {
    id: '7',
    slug: 'brinquedos-games',
    name: 'Brinquedos & Games',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/56f16496-7e6e-11f1-ba4d-0242ac110002-yb6diz5VOKRw_738iE_Ss.jpg',
    description: 'Jogos, brinquedos e consoles',
    productCount: 1120
  },
  {
    id: '8',
    slug: 'automotivo',
    name: 'Automotivo',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5728e905-7e6e-11f1-ad3e-0242ac110002-x7OsBWD9e3MKvKurFhLQP.jpg',
    description: 'Peças, acessórios e ferramentas',
    productCount: 780
  }
];

export const products: Product[] = [
  // Eletrônicos
  {
    id: '1',
    slug: 'smartphone-pro-max',
    name: 'Smartphone Pro Max 256GB',
    description: 'Smartphone de última geração com câmera tripla, tela AMOLED 6.7", processador octa-core e bateria de longa duração. Design premium em vidro e metal.',
    price: 4999.99,
    originalPrice: 5999.99,
    discount: 17,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg',
    category: 'eletronicos',
    rating: 4.8,
    reviewCount: 342,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '2',
    slug: 'laptop-ultrabook-15',
    name: 'Laptop Ultrabook 15" Intel i7',
    description: 'Laptop ultraleve com processador Intel Core i7, 16GB RAM, SSD 512GB, tela Full HD IPS. Perfeito para trabalho e entretenimento.',
    price: 6499.00,
    originalPrice: 7299.00,
    discount: 11,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg',
    category: 'eletronicos',
    rating: 4.7,
    reviewCount: 189,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '3',
    slug: 'fone-bluetooth-premium',
    name: 'Fone de Ouvido Bluetooth Premium',
    description: 'Fone over-ear com cancelamento de ruído ativo, bateria de 30 horas, driver de 40mm e conexão Bluetooth 5.0. Som Hi-Fi excepcional.',
    price: 899.90,
    originalPrice: 1199.90,
    discount: 25,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa9c9ce-7e6e-11f1-8ce3-0242ac110002-0DDwAGMnksgDjeC51LGtD.jpg',
    category: 'eletronicos',
    rating: 4.9,
    reviewCount: 567,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '4',
    slug: 'smartwatch-sport',
    name: 'Smartwatch Sport GPS',
    description: 'Smartwatch com GPS integrado, monitor cardíaco, mais de 100 modos esportivos, resistência à água 5ATM e bateria de 14 dias.',
    price: 1299.00,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5ab63e1b-7e6e-11f1-9a5a-0242ac110002-oi7Qh0RDrE8nvf9Gqxvfb.jpg',
    category: 'eletronicos',
    rating: 4.6,
    reviewCount: 234,
    badge: 'new',
    inStock: true,
    featured: true
  },
  {
    id: '5',
    slug: 'tablet-10-pol',
    name: 'Tablet 10" com Stylus',
    description: 'Tablet com tela de 10.4", processador octa-core, 128GB armazenamento, inclui caneta stylus. Ideal para estudo e criatividade.',
    price: 2199.00,
    originalPrice: 2599.00,
    discount: 15,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b46db3a-7e6e-11f1-98fb-0242ac110002-yUsdDCiNGkUXvIXwHDkP9.jpg',
    category: 'eletronicos',
    rating: 4.5,
    reviewCount: 156,
    inStock: true
  },
  {
    id: '6',
    slug: 'caixa-som-bluetooth',
    name: 'Caixa de Som Bluetooth Portátil',
    description: 'Caixa de som portátil com 20W de potência, Bluetooth 5.0, resistência à água IPX7 e bateria de 12 horas. Som 360° imersivo.',
    price: 449.90,
    originalPrice: 599.90,
    discount: 25,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5ab2c8b3-7e6e-11f1-abb5-0242ac110002-lhtmOS_6GhLkNyuDZwvsL.jpg',
    category: 'eletronicos',
    rating: 4.7,
    reviewCount: 423,
    badge: 'sale',
    inStock: true
  },

  // Moda
  {
    id: '7',
    slug: 'vestido-floral-verao',
    name: 'Vestido Floral Verão',
    description: 'Vestido leve e elegante com estampa floral, tecido viscose, comprimento midi. Perfeito para occasions casuais e verão.',
    price: 189.90,
    originalPrice: 259.90,
    discount: 27,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5abe023d-7e6e-11f1-9595-0242ac110002-dxVBGr4YM-xy9YdhWhKow.jpg',
    category: 'moda',
    rating: 4.6,
    reviewCount: 89,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '8',
    slug: 'tenis-corrida-profissional',
    name: 'Tênis de Corrida Profissional',
    description: 'Tênis de corrida com amortecimento avançado, solado de borracha antiderrapante, cabedal em mesh respirável. Ideal para runners.',
    price: 399.90,
    originalPrice: 499.90,
    discount: 20,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b154d0b-7e6e-11f1-bca9-0242ac110002-nAjo4_7u67NfjVAmJIJAP.jpg',
    category: 'moda',
    rating: 4.8,
    reviewCount: 234,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '9',
    slug: 'bolsa-couro-marrom',
    name: 'Bolsa de Couro Marrom',
    description: 'Bolsa estruturada em couro legítimo, acabamento premium, compartimentos internos, alça transversal ajustável. Elegância atemporal.',
    price: 599.00,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b18ae0f-7e6e-11f1-8401-0242ac110002-T3RXMk0NeSJPk9JjIbelV.jpg',
    category: 'moda',
    rating: 4.9,
    reviewCount: 167,
    badge: 'new',
    inStock: true,
    featured: true
  },

  // Casa & Jardim
  {
    id: '10',
    slug: 'liquidificador-power-1200w',
    name: 'Liquidificador Power 1200W',
    description: 'Liquidificador de alta potência com 12 velocidades, jarra de vidro 3L, lâminas em aço inoxidável. Função pulsar e triturar gelo.',
    price: 349.90,
    originalPrice: 449.90,
    discount: 22,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5abcaf38-7e6e-11f1-926e-0242ac110002-mAcCILjnsQjjtTct-oTGQ.jpg',
    category: 'casa-jardim',
    rating: 4.7,
    reviewCount: 312,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '11',
    slug: 'abajur-moderno-brass',
    name: 'Abajur Moderno Brass',
    description: 'Abajur de mesa com base em latão escovado e cúpula em tecido branco. Design minimalista e elegante para sala ou quarto.',
    price: 279.00,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b414c9e-7e6e-11f1-ba7c-0242ac110002-D6wUWvmNuLdB-CNC8oozs.jpg',
    category: 'casa-jardim',
    rating: 4.5,
    reviewCount: 78,
    badge: 'new',
    inStock: true
  },
  {
    id: '12',
    slug: 'kit-almofadas-decorativas',
    name: 'Kit 4 Almofadas Decorativas',
    description: 'Conjunto de 4 almofadas decorativas 45x45cm com capas removíveis, estampas geométricas modernas, enchimento em fibra siliconada.',
    price: 199.90,
    originalPrice: 279.90,
    discount: 29,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5aaa7a70-7e6e-11f1-9018-0242ac110002-4Rd8xIvDAA18urOueGtC6.jpg',
    category: 'casa-jardim',
    rating: 4.6,
    reviewCount: 145,
    badge: 'sale',
    inStock: true
  },

  // Esportes
  {
    id: '13',
    slug: 'tapete-yoga-premium',
    name: 'Tapete de Yoga Premium 6mm',
    description: 'Tapete de yoga em TPE ecológico, antiderrapante, 183x61cm, espessura 6mm. Inclui alça de transporte. Ideal para yoga e pilates.',
    price: 149.90,
    originalPrice: 199.90,
    discount: 25,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b150b15-7e6e-11f1-adaf-0242ac110002-cVTD6ImYlbT-JTkO_V1Mk.jpg',
    category: 'esportes',
    rating: 4.8,
    reviewCount: 267,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '14',
    slug: 'halteres-ajustaveis-20kg',
    name: 'Halteres Ajustáveis 20kg',
    description: 'Par de halteres ajustáveis de 2 a 20kg cada, sistema de ajuste rápido, pegadura ergonômica. Perfeito para treino em casa.',
    price: 899.00,
    originalPrice: 1199.00,
    discount: 25,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14ef95-7e6e-11f1-a3c4-0242ac110002-j_j5c1jfrhJ0gQLGZCtbn.jpg',
    category: 'esportes',
    rating: 4.9,
    reviewCount: 189,
    badge: 'sale',
    inStock: true,
    featured: true
  },

  // Livros
  {
    id: '15',
    slug: 'colecao-bestsellers-2024',
    name: 'Coleção Bestsellers 2024 - 5 Livros',
    description: 'Coleção com os 5 livros mais vendidos do ano, capa dura, edição especial. Inclui títulos de ficção, negócios e desenvolvimento pessoal.',
    price: 249.90,
    originalPrice: 349.90,
    discount: 29,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b15e515-7e6e-11f1-bc20-0242ac110002-zvprB4Dor_luGHH2u24Xi.jpg',
    category: 'livros',
    rating: 4.9,
    reviewCount: 423,
    badge: 'sale',
    inStock: true,
    featured: true
  },

  // Beleza
  {
    id: '16',
    slug: 'perfume-luxo-100ml',
    name: 'Perfume Luxo Eau de Parfum 100ml',
    description: 'Fragrância sofisticada com notas de bergamota, jasmim e sândalo. Longa duração, frasco elegante. Para occasions especiais.',
    price: 459.00,
    originalPrice: 599.00,
    discount: 23,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b1487fe-7e6e-11f1-b8de-0242ac110002-peXTtPHxqlWoL-9LD2m-A.jpg',
    category: 'beleza',
    rating: 4.8,
    reviewCount: 312,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '17',
    slug: 'kit-skincare-completo',
    name: 'Kit Skincare Completo 5 Produtos',
    description: 'Kit completo de cuidados com a pele: limpeza, tônico, sérum, hidratante e protetor solar. Fórmula vegana e cruelty-free.',
    price: 329.90,
    originalPrice: 429.90,
    discount: 23,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b3d4eeb-7e6e-11f1-a4fd-0242ac110002-Laj5wp2staB6CEmJSAMHj.jpg',
    category: 'beleza',
    rating: 4.7,
    reviewCount: 198,
    badge: 'sale',
    inStock: true,
    featured: true
  },

  // Brinquedos
  {
    id: '18',
    slug: 'blocos-construcao-500pecas',
    name: 'Blocos de Construção 500 Peças',
    description: 'Kit com 500 blocos de construção em cores variadas, compatível com marcas líderes. Inclui ideias de construção. Para crianças 4+.',
    price: 199.90,
    originalPrice: 279.90,
    discount: 29,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b17718e-7e6e-11f1-ae69-0242ac110002-EPmGQGbQeAYOSfzvKTVZ2.jpg',
    category: 'brinquedos-games',
    rating: 4.9,
    reviewCount: 267,
    badge: 'sale',
    inStock: true,
    featured: true
  },
  {
    id: '19',
    slug: 'ursinho-pelucia-gigante',
    name: 'Ursinho de Pelúcia Gigante 1m',
    description: 'Ursinho de pelúcia gigante com 1 metro de altura, super macio, enchimento em fibra siliconada. Presente perfeito para todas as idades.',
    price: 249.90,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5ac17a2f-7e6e-11f1-a83b-0242ac110002-bOksqJd_xDsuGrpAWs3Wv.jpg',
    category: 'brinquedos-games',
    rating: 4.8,
    reviewCount: 156,
    badge: 'new',
    inStock: true
  },

  // Automotivo
  {
    id: '20',
    slug: 'kit-acessorios-carro',
    name: 'Kit Acessórios para Carro',
    description: 'Kit completo com capa de volante, suporte para celular, aromatizante e organizador de banco. Universal, fácil instalação.',
    price: 179.90,
    originalPrice: 249.90,
    discount: 28,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5abd3c79-7e6e-11f1-9e2e-0242ac110002-Gxlfnqta9iRma31iRsKvy.jpg',
    category: 'automotivo',
    rating: 4.5,
    reviewCount: 134,
    badge: 'sale',
    inStock: true
  }
];

export const banners: Banner[] = [
  {
    id: '1',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5783f32a-7e6e-11f1-a05c-0242ac110002-gL5f6HGZjVLK9tX7ZtneG.jpg',
    title: 'Ofertas em Eletrônicos',
    subtitle: 'Até 30% OFF em smartphones, laptops e acessórios',
    cta: 'Comprar Agora',
    link: '/category/eletronicos'
  },
  {
    id: '2',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573d35e0-7e6e-11f1-a56d-0242ac110002-m84D8GY8ROKweXe5v3qi3.jpg',
    title: 'Nova Coleção de Moda',
    subtitle: 'As últimas tendências com preços imperdíveis',
    cta: 'Ver Coleção',
    link: '/category/moda'
  },
  {
    id: '3',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573f0734-7e6e-11f1-8673-0242ac110002-PN8pzNbMQkB30y18CiMkY.jpg',
    title: 'Transforme seu Lar',
    subtitle: 'Tudo para casa e jardim com frete grátis',
    cta: 'Explorar',
    link: '/category/casa-jardim'
  }
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find(c => c.slug === slug);
}

export function getProductsByCategory(categorySlug: string): Product[] {
  return products.filter(p => p.category === categorySlug);
}

export function getFeaturedProducts(): Product[] {
  return products.filter(p => p.featured);
}

export function getProductsOnSale(): Product[] {
  return products.filter(p => p.badge === 'sale' && p.discount);
}

// Função auxiliar para normalizar texto (remover acentos)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

export function searchProducts(query: string): Product[] {
  if (!query || query.trim() === '') return [];
  
  const normalizedQuery = normalizeText(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0);
  
  return products.filter(p => {
    const normalizedName = normalizeText(p.name);
    const normalizedDescription = normalizeText(p.description);
    const normalizedCategory = normalizeText(p.category);
    const normalizedSlug = normalizeText(p.slug);
    
    // Pesquisa por correspondência exata ou parcial em qualquer campo
    const searchText = `${normalizedName} ${normalizedDescription} ${normalizedCategory} ${normalizedSlug}`;
    
    // Verifica se a query completa está presente
    if (searchText.includes(normalizedQuery)) {
      return true;
    }
    
    // Verifica se todas as palavras da query estão presentes (pesquisa mais flexível)
    return queryWords.every(word => searchText.includes(word));
  });
}
