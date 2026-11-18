/**
 * =====================================================
 * MAPEAMENTO DE FROTAS POR CATEGORIA - EDITÁVEL
 * =====================================================
 * Classificação automática de equipamentos ao importar.
 * Frotas importadas do PIMS são casadas com sua categoria.
 * Editável pelo usuário via interface.
 */

export interface FrotaCategoria {
  id: string;
  categoria: string;
  frotas: string[];
  cor: string;
  icone: string;
  imagem?: string;
  subtitulo?: string;
}

const CATEGORIAS_STORAGE_KEY = 'bp_manutencao_categorias';

export const CATEGORIAS_PADRAO: FrotaCategoria[] = [
  {
    id: 'carretas_canavieiras',
    categoria: 'CARRETAS CANAVIEIRAS',
    imagem: '/equipamentos/carretas_canavieiras.png',
    subtitulo: 'TRANSPORTE DE CANA',
    frotas: [
      '23677', '23676', '23675', '23674', '23673', '23672', '23671', '23670', '23669', '23668',
      '23667', '23666', '23665', '23664', '23663', '23662', '23661', '23660', '23659', '23658',
      '23657', '23656', '23655', '23654', '23653', '23652', '23651', '23650', '23649', '23648',
      '23647', '23646', '23645', '23644', '23643', '23642', '23641', '23637', '23636', '23635',
      '23634', '23633', '23632', '23631', '23630', '23629', '23628', '23627', '23626', '23616',
      '23610', '23607', '23604', '23603', '23602', '23601', '23600', '22067', '22066', '22065',
      '22064', '22063', '22062', '22061', '22060', '22059', '22058', '22057', '22056', '22055',
      '22054', '22053', '22052', '22051', '22050', '22049', '22048', '22047', '22046', '22045',
      '22044', '22043', '22042', '22041', '22040', '22039', '22038', '22037', '22036', '22035',
      '22034', '22033', '22032', '22031', '22030', '22029', '22028', '22027', '22026', '22025',
      '22024', '22023', '22022', '22021', '22020', '22019', '22017', '22012', '22011', '22003', '22001'
    ],
    cor: '#F97316',
    icone: '🚜',
  },
  {
    id: 'colhedoras_cana',
    categoria: 'COLHEDORAS DE CANA',
    imagem: '/equipamentos/colhedoras_cana.png',
    subtitulo: 'COLHEITA MECANIZADA',
    frotas: [
      '57839', '57838', '57837', '57836', '57835', '57834', '57833', '57832', '57831', '57830',
      '57829', '57827'
    ],
    cor: '#10B981',
    icone: '🌾',
  },
  {
    id: 'trator_geral',
    categoria: 'TRATOR GERAL',
    imagem: '/equipamentos/trator_geral.png',
    subtitulo: 'TERRAPLANAGEM E APOIO',
    frotas: [
      '32308', '32307', '32306', '32305', '32304', '32303', '32302', '32299', '32298', '32297',
      '32296', '32295', '32294', '32293', '32292', '32291', '32290', '32289', '32288', '32287',
      '32286', '32285', '32284', '32283', '32282', '32280', '32279', '32278', '32277', '32276',
      '32275', '32274', '32273', '32272', '32271', '32270', '32269', '32268', '32267', '32263',
      '32262', '32256', '32255', '32254', '32253', '32251', '32250', '32249', '32248', '32246',
      '32245', '32244', '32243', '32242', '32240', '32239', '32238', '32237', '32236', '32234',
      '32233', '32232', '32231', '32230', '32229', '32228', '32227', '32225', '32224', '32210', '32209'
    ],
    cor: '#3B82F6',
    icone: '🚜',
  },
  {
    id: 'carretas_rodomuda',
    categoria: 'CARRETAS RODOMUDA',
    imagem: '/equipamentos/carretas_rodomuda.png',
    subtitulo: 'TRANSPORTE RODOVIARIO',
    frotas: [
      '30953', '30952', '30951', '30950', '30949', '30948', '30947', '30946', '30945', '30944',
      '30943', '30942', '30941', '30940', '30939', '30938', '30937', '30936', '30935', '30934',
      '30933', '30932'
    ],
    cor: '#8B5CF6',
    icone: '🚛',
  },
  {
    id: 'munck',
    categoria: 'CAMINHÃO MUNCK',
    imagem: '/equipamentos/munck.png',
    subtitulo: 'ICAMENTO E CARGAS',
    frotas: ['4568', '4569', '4582', '4585', '4614', '4583', '4588', '4508', '4509'],
    cor: '#FF6B6B',
    icone: '🏗️',
  },
  {
    id: 'pipa',
    categoria: 'CAMINHÃO PIPA',
    imagem: '/equipamentos/pipa.png',
    subtitulo: 'AGUA E TRANSPORTE',
    frotas: ['4581', '4574', '4627', '4624', '4575', '4628', '4625', '4576', '4594', '4626', '4579', '4584', '4580', '4570'],
    cor: '#4ECDC4',
    icone: '💧',
  },
  {
    id: 'cacambas',
    categoria: 'CAMINHÃO CAÇAMBAS',
    imagem: '/equipamentos/cacambas.png',
    subtitulo: 'MOVIMENTACAO DE TERRA',
    frotas: ['4571', '4587', '4566', '4620', '4567', '4621'],
    cor: '#FFE66D',
    icone: '🚚',
  },
  {
    id: 'cavalo',
    categoria: 'CAMINHÃO CAVALO',
    imagem: '/equipamentos/cavalo.png',
    subtitulo: 'TRACAO E REBOQUE',
    frotas: ['4605', '4601', '4611', '4615', '4619', '4608', '4616', '4609', '4617', '4610', '4618'],
    cor: '#95E1D3',
    icone: '🚛',
  },
  {
    id: 'coleta',
    categoria: 'CAMINHÃO COLETA',
    imagem: '/equipamentos/coleta.png',
    subtitulo: 'COLETA E RESIDUOS',
    frotas: ['4591', '4597', '4604', '6597', '6598', '6607'],
    cor: '#F38181',
    icone: '🗑️',
  },
  {
    id: 'veiculos',
    categoria: 'VEÍCULOS',
    imagem: '/equipamentos/veiculos.png',
    subtitulo: 'APOIO E LOGISTICA',
    frotas: ['8825', '8826', '8827', '8828', '8829', '8830', '8831', '8832', '8833', '6595', '6596', '6592', '6601', '8846', '8847', '8848', '8849', '8800', '8801', '8775', '8803', '8802', '6603'],
    cor: '#AA96DA',
    icone: '🚗',
  },
  {
    id: 'pranchas',
    categoria: 'PRANCHAS IMPLEMENTO',
    imagem: '/equipamentos/pranchas.png',
    subtitulo: 'TRANSPORTE PESADO',
    frotas: ['93155', '93156', '93157'],
    cor: '#FCBAD3',
    icone: '📦',
  },
  {
    id: 'vivencia',
    categoria: 'ÁREA DE VIVÊNCIA',
    imagem: '/equipamentos/vivencia.png',
    subtitulo: 'ALOJAMENTO E APOIO',
    frotas: ['15101', '15102', '15103', '15104', '15105', '15106', '15107', '15108', '15109', '15110', '15111', '15112', '15114', '15115', '15116', '15117', '15118', '15119'],
    cor: '#A8D8EA',
    icone: '🏠',
  },
];

export function carregarCategorias(): FrotaCategoria[] {
  try {
    const saved = localStorage.getItem(CATEGORIAS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [...CATEGORIAS_PADRAO];
}

export function salvarCategorias(categorias: FrotaCategoria[]): void {
  localStorage.setItem(CATEGORIAS_STORAGE_KEY, JSON.stringify(categorias));
}

export function resetarCategorias(): FrotaCategoria[] {
  localStorage.removeItem(CATEGORIAS_STORAGE_KEY);
  return [...CATEGORIAS_PADRAO];
}

export function obterCategoriaFrota(numeroFrota: string, categoriasExternas?: FrotaCategoria[]): string {
  const categorias = categoriasExternas || carregarCategorias();
  const frotaLimpa = numeroFrota.trim();
  const cat = categorias.find(c => c.frotas.includes(frotaLimpa));
  return cat?.categoria || 'SEM CATEGORIA';
}

export function obterCorCategoria(categoria: string, categoriasExternas?: FrotaCategoria[]): string {
  const categorias = categoriasExternas || carregarCategorias();
  const cat = categorias.find(c => c.categoria === categoria);
  return cat?.cor || '#6B7280';
}

export function obterIconeCategoria(categoria: string, categoriasExternas?: FrotaCategoria[]): string {
  const categorias = categoriasExternas || carregarCategorias();
  const cat = categorias.find(c => c.categoria === categoria);
  return cat?.icone || '⚙️';
}

export function obterTodasCategorias(categoriasExternas?: FrotaCategoria[]): string[] {
  const categorias = categoriasExternas || carregarCategorias();
  return categorias.map(c => c.categoria);
}

export function obterImagemCategoria(categoria: string, categoriasExternas?: FrotaCategoria[]): string {
  const categorias = categoriasExternas || carregarCategorias();
  const cat = categorias.find(c => c.categoria === categoria);
  return cat?.imagem || '';
}

export function obterSubtituloCategoria(categoria: string, categoriasExternas?: FrotaCategoria[]): string {
  const categorias = categoriasExternas || carregarCategorias();
  const cat = categorias.find(c => c.categoria === categoria);
  return cat?.subtitulo || '';
}
