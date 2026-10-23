// ─── Gamificação — Trilha do Cultivador (API_CONTRACTS §5, §6 e §4) ─────────
// Contrato fonte de verdade: specs/API_CONTRACTS.md (não traduzir payloads).

export type EstagioCiclo =
  | 'Semente'
  | 'Germinacao'
  | 'Muda'
  | 'Vegetativo'
  | 'Floracao'
  | 'Frutificacao'
  | 'Colheita';

export type TierConquista = 'Facil' | 'Medio' | 'Dificil' | 'MuitoDificil' | 'Epico' | 'Lendario';

export type TipoConquista = 'Jornada' | 'Saude' | 'Manejo' | 'Colecao' | 'Transplante' | 'Personalizada';

export type StatusConquista = 'Bloqueada' | 'Concluida';

export type StatusVida = 'Ativa' | 'Arquivada';

/** Item da trilha de ciclo de vida (contrato §5.1). */
export interface TrilhaEstagioItem {
  estagio: EstagioCiclo;
  concluido: boolean;
  atual?: boolean;
  podeTransicionarEm?: string | null;
}

/** Faixa ideal da espécie para uma métrica (contrato §5.1). */
export interface FaixaIdealItem {
  min: number;
  max: number;
}

/** Leituras de saúde por métrica (contrato §5.1 — vazio quando sensorVinculado=false). */
export interface SaudeMetricaItem {
  naFaixaIdeal: boolean;
  valorAtual?: number | null;
  faixaIdeal?: FaixaIdealItem | null;
}

/** Largura proporcional da barra (0–100%): posição do valorAtual dentro da faixa, saturado fora dela. */
export function larguraBarraSaude(metrica: SaudeMetricaItem): number {
  const { valorAtual, faixaIdeal } = metrica;
  if (
    typeof valorAtual !== 'number' ||
    !faixaIdeal ||
    typeof faixaIdeal.min !== 'number' ||
    typeof faixaIdeal.max !== 'number' ||
    faixaIdeal.max <= faixaIdeal.min
  ) {
    return 100; // sem dados numéricos: mantém a barra cheia (cor carrega o estado)
  }
  const posicao = ((valorAtual - faixaIdeal.min) / (faixaIdeal.max - faixaIdeal.min)) * 100;
  return Math.min(100, Math.max(0, posicao));
}

export interface SaudePorMetrica {
  umidadeSolo?: SaudeMetricaItem | null;
  temperatura?: SaudeMetricaItem | null;
  luminosidade?: SaudeMetricaItem | null;
}

export interface ConquistasResumo {
  total: number;
  concluidas: number;
  porTier: Partial<Record<TierConquista, number>>;
}

/** Cuidados manuais dos últimos 7 dias (contrato §5.1 — Modo Manual CR-001; dias[0] = hoje). */
export interface CuidadosSemana {
  confirmados: number;
  dias: boolean[];
}

/** Estado completo da gamificação da planta (contrato §5.1 — GET). */
export interface GamificacaoPlantaResponse {
  plantaId: string;
  xpTotal: number;
  nivel: number;
  streakDiasAtual: number;
  multiplicadorStreak?: number | null;
  estagioCiclo: EstagioCiclo;
  statusVida?: StatusVida;
  dataTransicaoEstagio?: string | null;
  trilha: TrilhaEstagioItem[];
  saudePorMetrica: SaudePorMetrica | null;
  sensorVinculado: boolean;
  cuidadosSemana?: CuidadosSemana | null;
  conquistasResumo: ConquistasResumo | null;
}

/** XP ganho em estágio (base/multiplicadorStreak) ou manejo (base/bonusJanela). */
export interface XpGanho {
  base: number;
  multiplicadorStreak?: number;
  bonusJanela?: number;
  total: number;
}

/** Response do registro de cuidado manual do dia (contrato §5.8 — idempotente por dia). */
export interface RegistroCuidadoResponse {
  registrouHoje: boolean;
  streakDiasAtual: number;
  xpGanho: XpGanho;
}

// ─── Helpers do Modo Manual de Saúde (CR-001 — RN-023/024) ──────────────────

const DIAS_NA_SEMANA = 7;

/** Normaliza cuidadosSemana para exatamente 7 booleanos (hoje → -6), faltantes = false. */
export function normalizarDiasCuidados(cuidados?: CuidadosSemana | null): boolean[] {
  const dias = cuidados?.dias ?? [];
  return Array.from({ length: DIAS_NA_SEMANA }, (_, i) => dias[i] === true);
}

/** Cuidado de hoje já confirmado? (dias[0]=true ⇒ botão "Registrar cuidado" desabilitado — §5.8). */
export function cuidadoHojeRegistrado(cuidados?: CuidadosSemana | null): boolean {
  return normalizarDiasCuidados(cuidados)[0];
}

/** Rótulo do indicador circular pelo índice (0 = hoje). */
export function rotuloDiaCuidado(indice: number): string {
  if (indice <= 0) return 'Hoje';
  if (indice === 1) return 'Ontem';
  return `${indice} dias atrás`;
}

export interface SeloConquistado {
  id: string;
  titulo: string;
  tier: TierConquista;
  xpRecompensa: number;
}

/** Response da transição de estágio (contrato §5.3 — POST). */
export interface TransicaoEstagioResponse {
  estagioAnterior: EstagioCiclo;
  estagioAtual: EstagioCiclo;
  dataTransicaoEstagio: string;
  xpGanho: XpGanho;
  selosConquistados: SeloConquistado[];
}

export interface ConquistaProgressoInfo {
  atual: number;
  necessario: number;
}

/** Conquista (planta ou coleção) — contrato §5.2 e §6.1. */
export interface ConquistaItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  tier: TierConquista;
  tipo: TipoConquista;
  xpRecompensa: number;
  status: StatusConquista;
  geradaPorIa?: boolean;
  progresso?: ConquistaProgressoInfo | null;
  dataDesbloqueio?: string | null;
}

/** Response da geração de conquistas (contrato §5.2 — POST, IA ou fallback). */
export interface GerarGamificacaoResponse {
  geradaPorIa: boolean;
  totalConquistas: number;
  conquistas: ConquistaItem[];
}

/** Item da lista de conquistas da planta (contrato §5.7 — GET; mesma forma de ConquistaItem). */
export type ConquistaLista = ConquistaItem;

/** Response da confirmação de manejo (contrato §5.4 — POST). */
export interface ManejoResponse {
  alertaId: number;
  dentroDaJanela: boolean;
  xpGanho: XpGanho;
}

/** Response do registro de transplante (contrato §5.5 — POST). */
export interface TransplanteResponse {
  dataUltimoTransplante: string;
  verificacaoAte: string;
  seloPrevisto: string;
}

/** Gamificação do jardim — XP do Cultivador + conquistas de coleção (contrato §6.1). */
export interface JardimGamificacaoResponse {
  xpTotalCultivador: number;
  totalPlantas: number;
  plantasAtivas: number;
  conquistasColecao: ConquistaItem[];
}

/** Evento SignalR ConquistaDesbloqueada do hub /hubs/telemetria (contrato §4). */
export interface ConquistaDesbloqueadaEvento {
  plantaId: string;
  plantaApelido?: string | null;
  conquista: {
    id: string;
    titulo: string;
    tier: TierConquista;
    tipo: TipoConquista;
    xpRecompensa: number;
  };
  xpTotalCultivador: number;
  desbloqueadoEm: string;
}

/** Alerta de manejo ativo (contrato §3.1 — alertaAtivo no GET /api/plantas). */
export interface AlertaAtivoItem {
  id?: number | null;
  tipo: string;
  mensagem: string;
}

/** Envelope padrão de erro da API (contrato — Convenções Gerais). */
export interface ApiErroEnvelopeItem {
  id?: string | null;
  message?: string | null;
  field?: string | null;
  detail?: string | null;
}

// ─── Constantes visuais (const RECORD — AGENTS.md regra 16) ─────────────────

export interface TierVisual {
  label: string;
  cor: string;
  icone: string;
}

/** Cores fixas por tier — UI_SPEC §6: Fácil cinza, Médio verde, Difícil azul, Muito Difícil roxo, Épico laranja, Lendário dourado. Facil escurecido (#6b7580) para contraste AA com texto branco. */
export const TIER_VISUAL: Record<TierConquista, TierVisual> = {
  Facil: { label: 'Fácil', cor: '#6b7580', icone: 'fa-star' },
  Medio: { label: 'Médio', cor: '#198754', icone: 'fa-medal' },
  Dificil: { label: 'Difícil', cor: '#0d6efd', icone: 'fa-award' },
  MuitoDificil: { label: 'Muito Difícil', cor: '#6f42c1', icone: 'fa-gem' },
  Epico: { label: 'Épico', cor: '#fd7e14', icone: 'fa-fire' },
  Lendario: { label: 'Lendário', cor: '#d4a017', icone: 'fa-crown' }
};

export const ORDEM_TIERS: TierConquista[] = ['Facil', 'Medio', 'Dificil', 'MuitoDificil', 'Epico', 'Lendario'];

export interface EstagioVisual {
  label: string;
  icone: string;
}

export const ESTAGIO_VISUAL: Record<EstagioCiclo, EstagioVisual> = {
  Semente: { label: 'Semente', icone: 'fa-seedling' },
  Germinacao: { label: 'Germinação', icone: 'fa-sprout' },
  Muda: { label: 'Muda', icone: 'fa-leaf' },
  Vegetativo: { label: 'Vegetativo', icone: 'fa-tree' },
  Floracao: { label: 'Floração', icone: 'fa-spa' },
  Frutificacao: { label: 'Frutificação', icone: 'fa-apple-whole' },
  Colheita: { label: 'Colheita', icone: 'fa-basket-shopping' }
};

export const ORDEM_ESTAGIOS: EstagioCiclo[] = [
  'Semente',
  'Germinacao',
  'Muda',
  'Vegetativo',
  'Floracao',
  'Frutificacao',
  'Colheita'
];

// ─── Helpers puros (testáveis) ───────────────────────────────────────────────

/** Próximo estágio da sequência do ciclo de vida; null no fim da trilha. */
export function proximoEstagio(atual: EstagioCiclo): EstagioCiclo | null {
  const indice = ORDEM_ESTAGIOS.indexOf(atual);
  if (indice < 0 || indice >= ORDEM_ESTAGIOS.length - 1) {
    return null;
  }
  return ORDEM_ESTAGIOS[indice + 1];
}

/** Transição liberada quando podeTransicionarEm está vazio ou já passou (RN-010). */
export function transicaoDisponivel(podeTransicionarEm?: string | null, agora: Date = new Date()): boolean {
  if (!podeTransicionarEm) {
    return true;
  }
  const alvo = new Date(podeTransicionarEm);
  if (isNaN(alvo.getTime())) {
    return true;
  }
  return alvo.getTime() <= agora.getTime();
}

/** Contagem regressiva no formato "Disponível em Xd Yh" (UI_SPEC §6); vazio quando liberado. */
export function formatarContagemRegressiva(podeTransicionarEm?: string | null, agora: Date = new Date()): string {
  if (!podeTransicionarEm) {
    return '';
  }
  const alvo = new Date(podeTransicionarEm);
  if (isNaN(alvo.getTime())) {
    return '';
  }
  const restanteMs = alvo.getTime() - agora.getTime();
  if (restanteMs <= 0) {
    return '';
  }
  const horasTotais = Math.floor(restanteMs / 3_600_000);
  const dias = Math.floor(horasTotais / 24);
  const horas = horasTotais % 24;
  if (dias > 0) {
    return `Disponível em ${dias}d ${horas}h`;
  }
  return `Disponível em ${horas}h`;
}

/** Formata timestamp ISO em DD/MM/AAAA HH:mm (UI_SPEC §6). */
export function formatarDataHora(iso?: string | null): string {
  if (!iso) {
    return '—';
  }
  const data = new Date(iso);
  if (isNaN(data.getTime())) {
    return '—';
  }
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const aaaa = String(data.getFullYear());
  const hh = String(data.getHours()).padStart(2, '0');
  const mi = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${aaaa} ${hh}:${mi}`;
}

/** Extrai a primeira mensagem do envelope de erro da API (array padrão). */
export function extrairMensagemErro(corpoErro: unknown, fallback: string): string {
  if (Array.isArray(corpoErro) && corpoErro.length > 0) {
    const primeiro = corpoErro[0] as ApiErroEnvelopeItem | undefined;
    if (primeiro && typeof primeiro.message === 'string' && primeiro.message.trim().length > 0) {
      return primeiro.message;
    }
  }
  if (typeof corpoErro === 'object' && corpoErro !== null) {
    const mensagem = (corpoErro as ApiErroEnvelopeItem).message;
    if (typeof mensagem === 'string' && mensagem.trim().length > 0) {
      return mensagem;
    }
  }
  return fallback;
}
