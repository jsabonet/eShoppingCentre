export const STORE_CATEGORIES_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  physical: [
    { value: 'eletronicos', label: '📱 Electrónicos & Tecnologia' },
    { value: 'moda', label: '👗 Moda, Roupa & Calçado' },
    { value: 'casa-jardim', label: '🏠 Casa, Decoração & Jardim' },
    { value: 'esportes', label: '⚽ Desporto & Lazer' },
    { value: 'livros', label: '📚 Livros Físicos & Papelaria' },
    { value: 'beleza', label: '💄 Beleza, Saúde & Bem-Estar' },
    { value: 'brinquedos', label: '🎮 Brinquedos & Jogos' },
    { value: 'automotivo', label: '🚗 Automóvel & Acessórios' },
    { value: 'artesanato', label: '🎨 Artesanato & Cultura' },
    { value: 'alimentacao', label: '🍽️ Alimentação & Bebidas' },
  ],
  digital: [
    { value: 'ebooks', label: '📖 Ebooks & Livros Digitais' },
    { value: 'software', label: '💻 Software & Aplicações' },
    { value: 'musica', label: '🎵 Música & Áudio' },
    { value: 'templates', label: '📋 Templates & Recursos' },
    { value: 'arte-digital', label: '🖼️ Arte Digital & NFTs' },
    { value: 'planilhas', label: '📊 Planilhas & Ferramentas' },
  ],
  course: [
    { value: 'programacao', label: '💻 Programação & Tecnologia' },
    { value: 'design', label: '🎨 Design & Criatividade' },
    { value: 'marketing', label: '📈 Marketing & Vendas' },
    { value: 'negocios', label: '💼 Negócios & Empreendedorismo' },
    { value: 'financas', label: '💰 Finanças & Investimentos' },
    { value: 'idiomas', label: '🌍 Idiomas & Comunicação' },
    { value: 'culinaria', label: '🍳 Culinária & Gastronomia' },
    { value: 'bem-estar', label: '🧘 Saúde & Bem-Estar' },
  ],
};

export const STORE_LOCATIONS = [
  'Maputo', 'Beira', 'Nampula', 'Pemba', 'Quelimane', 'Tete',
  'Lichinga', 'Xai-Xai', 'Inhambane', 'Matola', 'Chimoio',
];

export const STORE_THEME_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Roxo', value: '#9333ea' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Ciano', value: '#0891b2' },
  { name: 'Âmbar', value: '#d97706' },
  { name: 'Vermelho', value: '#dc2626' },
];
