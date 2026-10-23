// ─── Plantas Existentes, Recuperação e Assistência IA (API_CONTRACTS §7 e §4) ─
// Contrato fonte de verdade: specs/API_CONTRACTS.md (não traduzir payloads).

// ─── Enums (contrato §7 — Value Objects) ─────────────────────────────────────

export type TipoIntervencao =
  | 'Poda'
  | 'Transplante'
  | 'TratamentoFitossanitario'
  | 'Adubacao'
  | 'Aclimatacao'
  | 'Outro';

export type StatusPlanoRecuperacao = 'Ativo' | 'Concluido' | 'Cancelado';

export type StatusEtapaPlano = 'Pendente' | 'Concluida';

export type OrigemEtapas = 'SugeridaIa' | 'Manual';

export type ContextoRecomendacaoIa =
  | 'Intervencao'
  | 'EstadoFisico'
  | 'TelemetriaForaFaixa'
  | 'EtapaPlano';

export type PartePlanta = 'folhas' | 'caule' | 'raizes' | 'pragas';

// ─── Contratos §7.1 — POST /api/plantas/existente ────────────────────────────

export interface CreatePlantaExistenteRequest {
  apelidoLote: string;
  especieId: string;
  estagioAtual: string;
  dispositivoId?: string | null;
}

/** Response 201 do cadastro de planta existente (contrato §7.1). */
export interface PlantaExistenteResponse {
  id: string;
  apelidoLote: string;
  estagioCiclo: string;
  origemDesconhecida: boolean;
  statusVida: string;
  dataCadastro: string;
}

// ─── Contratos §7.2/§7.3 — Avaliações de estado físico ──────────────────────

/** Sintomas por parte da planta (contrato §7.2 — JSON checklist). */
export interface ChecklistEstadoFisico {
  folhas: string[];
  caule: string[];
  raizes: string[];
  pragas: string[];
}

export interface RegistrarAvaliacaoRequest {
  checklist: ChecklistEstadoFisico;
  observacoesLivres?: string;
  fotos?: string[];
}

export interface AvaliacaoEstadoItem {
  id: string;
  dataAvaliacao: string;
  checklist: ChecklistEstadoFisico;
  observacoesLivres?: string | null;
  interpretacaoIa?: string | null;
  fotos?: string[];
}

// ─── Contratos §7.4/§7.5 — Intervenções de manejo ────────────────────────────

export interface RegistrarIntervencaoRequest {
  tipo: TipoIntervencao;
  dataEvento: string;
  dataAproximada: boolean;
  detalhesLivres?: string;
}

/** Janela de verificação pós-transplante — presente somente para tipo=Transplante (§7.4). */
export interface JanelaTransplanteInfo {
  iniciada: boolean;
  verificacaoAte: string;
  seloPrevisto: string;
}

/** Resumo do plano embutido na lista de intervenções (§7.5). */
export interface PlanoResumoItem {
  id: string;
  status: StatusPlanoRecuperacao;
  progresso: PlanoProgresso;
}

export interface IntervencaoItem {
  id: string;
  tipo: TipoIntervencao;
  dataEvento: string;
  dataAproximada: boolean;
  detalhesLivres?: string | null;
  estruturaIa?: string | null;
  criadoEm: string;
  janelaTransplante?: JanelaTransplanteInfo | null;
  plano?: PlanoResumoItem | null;
}

// ─── Contratos §7.6 — Planos de recuperação ─────────────────────────────────

export interface PlanoProgresso {
  concluidas: number;
  total: number;
}

export interface EtapaPlanoItem {
  id: string;
  ordem: number;
  descricao: string;
  duracaoDias: number;
  statusEtapa: StatusEtapaPlano;
  concluidaEm?: string | null;
}

export interface SugestaoEtapasResponse {
  origemEtapas: OrigemEtapas;
  etapas: EtapaSugeridaItem[];
}

/** Etapa de sugestão (sem id — ainda não persistida, §7.6.1). */
export interface EtapaSugeridaItem {
  ordem: number;
  descricao: string;
  duracaoDias: number;
}

export interface CriarPlanoRequest {
  origemEtapas: OrigemEtapas;
  etapas: EtapaSugeridaItem[];
}

export interface PlanoRecuperacaoItem {
  id: string;
  intervencaoId: string;
  origemEtapas: OrigemEtapas;
  status: StatusPlanoRecuperacao;
  etapas: EtapaPlanoItem[];
  progresso: PlanoProgresso;
}

export interface ConcluirEtapaResponse {
  etapaId: string;
  statusEtapa: StatusEtapaPlano;
  concluidaEm: string | null;
  jaConcluida: boolean;
  planoStatus: StatusPlanoRecuperacao;
  progresso: PlanoProgresso;
}

// ─── Contratos §7.7 — Assistente IA ─────────────────────────────────────────

export interface ConsultarAssistenteRequest {
  pergunta: string;
}

export interface FontesConsideradas {
  telemetria: boolean;
  avaliacoesEstado: number;
  intervencoes: number;
  planoRecuperacao: boolean;
  perfilEspecie: boolean;
}

export interface ConsultaAssistenteResponse {
  resposta: string;
  fontesConsideradas: FontesConsideradas;
  geradaEm: string;
}

export interface RecomendacaoIaItem {
  id: string;
  titulo: string;
  mensagem: string;
  contexto: ContextoRecomendacaoIa;
  geradaEm: string;
}

// ─── Evento SignalR RecomendacaoIa (contrato §4 — RN-034) ───────────────────

export interface RecomendacaoIaEvento {
  plantaId: string;
  plantaApelido?: string | null;
  recomendacao: {
    id: string;
    titulo: string;
    mensagem: string;
    contexto: ContextoRecomendacaoIa;
  };
  geradaEm: string;
}

/** Dispositivo IoT ativo para o vínculo opcional do cadastro (UI_SPEC §5.3). */
export interface DispositivoItem {
  id: string;
  identificadorHardware: string;
  status: string;
}

// ─── Constantes visuais (const RECORD — AGENTS.md regra 16) ─────────────────

export interface TipoIntervencaoVisual {
  label: string;
  icone: string;
}

export const TIPO_INTERVENCAO_VISUAL: Record<TipoIntervencao, TipoIntervencaoVisual> = {
  Poda: { label: 'Poda', icone: 'fa-scissors' },
  Transplante: { label: 'Transplante', icone: 'fa-shuffle' },
  TratamentoFitossanitario: { label: 'Tratamento fitossanitário', icone: 'fa-prescription-bottle-medical' },
  Adubacao: { label: 'Adubação', icone: 'fa-flask' },
  Aclimatacao: { label: 'Aclimatação', icone: 'fa-cloud-sun' },
  Outro: { label: 'Outro', icone: 'fa-circle-info' }
};

export const ORDEM_TIPOS_INTERVENCAO: TipoIntervencao[] = [
  'Poda',
  'Transplante',
  'TratamentoFitossanitario',
  'Adubacao',
  'Aclimatacao',
  'Outro'
];

export const CONTEXTO_RECOMENDACAO_LABEL: Record<ContextoRecomendacaoIa, string> = {
  Intervencao: 'Nova intervenção',
  EstadoFisico: 'Novo estado físico',
  TelemetriaForaFaixa: 'Telemetria fora da faixa',
  EtapaPlano: 'Etapa do plano concluída'
};

/** Partes do checklist de estado físico com chips sugeridos (valores dos exemplos do contrato §7.2). */
export const PARTES_CHECKLIST: { parte: PartePlanta; label: string; icone: string; opcoes: string[] }[] = [
  { parte: 'folhas', label: 'Folhas', icone: 'fa-leaf', opcoes: ['Comidas', 'Secas', 'Murchas'] },
  { parte: 'caule', label: 'Caule', icone: 'fa-tree', opcoes: ['Galhos expostos'] },
  { parte: 'raizes', label: 'Raízes', icone: 'fa-spa', opcoes: ['Enoveladas', 'Apodrecidas'] },
  { parte: 'pragas', label: 'Pragas visíveis', icone: 'fa-bug', opcoes: ['Caramujos'] }
];

// ─── Helpers puros (testáveis) ───────────────────────────────────────────────

/** Checklist válido quando ao menos uma parte da planta tem seleção (RN-028 — ERR-REC-002). */
export function checklistTemSelecao(checklist: ChecklistEstadoFisico): boolean {
  return (
    checklist.folhas.length > 0 ||
    checklist.caule.length > 0 ||
    checklist.raizes.length > 0 ||
    checklist.pragas.length > 0
  );
}

/** Toggle imutável de um sintoma dentro do checklist. */
export function checklistComToggle(
  checklist: ChecklistEstadoFisico,
  parte: PartePlanta,
  valor: string
): ChecklistEstadoFisico {
  const atual = checklist[parte];
  const lista = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
  return { ...checklist, [parte]: lista };
}

/** true quando dataEvento (YYYY-MM-DD) é anterior à data do registro (RN-031 — retroativo). */
export function intervencaoRetroativa(dataEvento: string, criadoEm: string): boolean {
  if (!dataEvento || !criadoEm) return false;
  return dataEvento.slice(0, 10) < criadoEm.slice(0, 10);
}

/** Valida data de evento: não vazia e não futura (RN-031 — ERR-REC-003). */
export function dataEventoValida(dataEvento: string, hoje: Date = new Date()): boolean {
  if (!dataEvento) return false;
  const alvo = new Date(`${dataEvento}T12:00:00`);
  if (isNaN(alvo.getTime())) return false;
  const hojeMeioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0);
  return alvo.getTime() <= hojeMeioDia.getTime();
}

/** Etapa editável do editor de plano (ajuste antes de ativar — RN-033). */
export interface EtapaEditorItem {
  descricao: string;
  duracaoDias: number;
}

/** Normaliza etapas do editor: descrições trimmed não-vazias e duração >= 1. */
export function etapasEditorValidas(etapas: EtapaEditorItem[]): EtapaSugeridaItem[] {
  return etapas
    .filter((e) => e.descricao.trim().length > 0)
    .map((e, i) => ({ ordem: i + 1, descricao: e.descricao.trim(), duracaoDias: Math.max(1, Math.floor(e.duracaoDias || 1)) }));
}
