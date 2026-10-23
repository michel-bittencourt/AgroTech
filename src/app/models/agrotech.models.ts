export interface EspecieSugestao {
  nomePopular: string;
  nomeCientifico: string;
}

/** Valida faixa opcional: válida quando ambos vazios ou Min <= Max (UI_SPEC §3.3 — RN-005/RN-008). */
export function faixaOpcionalValida(min?: number | null, max?: number | null): boolean {
  if (min == null || max == null) {
    return true;
  }
  return min <= max;
}

export interface CultivoContexto {
  regiaoUf?: string;
  mesPlantio?: number;
  localPlantio?: string;
  tamanhoRecipiente?: string;
  areaCoberta?: boolean;
}

export interface EventoCalendarioItem {
  id: string;
  ordem: number;
  chaveEtapa: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  dataPrevista: string;
  dataRealizada?: string | null;
  concluido: boolean;
  observacoes?: string | null;
  origem: string;
  recorrenciaDias?: number | null;
}

export interface ConquistaProgresso {
  chave: string;
  titulo: string;
  descricao: string;
  icone: string;
  categoria: string;
  conquistada: boolean;
  conquistadaEm?: string | null;
  progressoAtual: number;
  progressoAlvo: number;
}

export interface PlantaFotoItem {
  id: string;
  url: string;
  dataFoto: string;
  legenda?: string | null;
}

export interface NotificacaoItem {
  eventoId: string;
  plantaId: string;
  apelidoLote: string;
  titulo: string;
  dataPrevista: string;
  status: 'atrasado' | 'hoje' | 'proximo';
}

export interface ClimaDia {
  data: string;
  tempMax: number;
  tempMin: number;
  probChuva: number;
}

export interface ClimaPlantaResponse {
  disponivel: boolean;
  mensagem?: string;
  uf?: string;
  areaCoberta?: boolean | null;
  dias?: ClimaDia[];
  alertas?: string[];
}

export interface FonteColetaStatus {
  nome: string;
  tipo: string;
  sucesso: boolean;
  detalhe: string;
  caracteres?: number | null;
  duracaoMs: number;
}

export interface ScrapingProgresso {
  percentual: number;
  etapa: string;
  mensagem: string;
  concluido: boolean;
  erro: boolean;
  mensagemErro?: string | null;
  tempoEstimadoSegundos: number;
  fontesConcluidas: number;
  totalFontes: number;
  decorridoSegundos: number;
  fontes?: FonteColetaStatus[];
}

export interface EspecieScraped {
  nomePopular: string;
  nomeCientifico?: string;
  imagemUrl?: string;
  umidadeSoloMin?: number | null;
  umidadeSoloMax?: number | null;
  temperaturaMin?: number | null;
  temperaturaMax?: number | null;
  luminosidadeMin?: number | null;
  luminosidadeMax?: number | null;
  fonteDadosScraping: string;
  instrucoesManejo?: string;
  passo1PreparoSemente?: string;
  passo2PreparoSolo?: string;
  passo3SemeaduraGerminacao?: string;
  passo4CuidadosBrotoDesbaste?: string;
  passo5AclimatizacaoVasoDefinitivo?: string;
  passo6TransplanteMudas?: string;
  passo7NutricaoPoda?: string;
  passo8FloracaoColheita?: string;
  // Aliases legados de 6 etapas
  passo4TransplanteMudas?: string;
  passo5CrescimentoManejo?: string;
  passo6FloracaoColheita?: string;
  cuidadosDiaADia?: string;
  isGeradoPorIa?: boolean;
  camposOrigemIa?: { [key: string]: boolean };
}

export interface Especie {
  id: string;
  nomePopular: string;
  nomeCientifico?: string;
  imagemUrl?: string;
  umidadeSoloMin?: number | null;
  umidadeSoloMax?: number | null;
  temperaturaMin?: number | null;
  temperaturaMax?: number | null;
  luminosidadeMin?: number | null;
  luminosidadeMax?: number | null;
  fonteDadosScraping?: string;
  instrucoesManejo?: string;
  passo1PreparoSemente?: string;
  passo2PreparoSolo?: string;
  passo3SemeaduraGerminacao?: string;
  passo4CuidadosBrotoDesbaste?: string;
  passo5AclimatizacaoVasoDefinitivo?: string;
  passo6TransplanteMudas?: string;
  passo7NutricaoPoda?: string;
  passo8FloracaoColheita?: string;
  // Aliases legados de 6 etapas
  passo4TransplanteMudas?: string;
  passo5CrescimentoManejo?: string;
  passo6FloracaoColheita?: string;
  cuidadosDiaADia?: string;
  isGeradoPorIa?: boolean;
  criadoEm: string;
}

export interface Planta {
  id: string;
  apelidoLote: string;
  especieId: string;
  especieNomePopular: string;
  especieNomeCientifico?: string;
  imagemUrl?: string;
  dispositivoId?: string;
  dispositivoHardwareId?: string;
  ufCultivo?: string | null;
  areaCoberta?: boolean | null;
  umidadeSoloMin?: number | null;
  umidadeSoloMax?: number | null;
  temperaturaMin?: number | null;
  temperaturaMax?: number | null;
  luminosidadeMin?: number | null;
  luminosidadeMax?: number | null;
  instrucoesManejo?: string;
  passo1PreparoSemente?: string;
  passo2PreparoSolo?: string;
  passo3SemeaduraGerminacao?: string;
  passo4CuidadosBrotoDesbaste?: string;
  passo5AclimatizacaoVasoDefinitivo?: string;
  passo6TransplanteMudas?: string;
  passo7NutricaoPoda?: string;
  passo8FloracaoColheita?: string;
  // Aliases legados de 6 etapas
  passo4TransplanteMudas?: string;
  passo5CrescimentoManejo?: string;
  passo6FloracaoColheita?: string;
  cuidadosDiaADia?: string;
  fonteDadosScraping?: string;
  isGeradoPorIa?: boolean;
  criadoEm: string;
  // Alerta de manejo ativo (API_CONTRACTS §3.1 — usado pelo botão "Confirmar ação", RN-013)
  alertaAtivo?: import('./gamificacao.models').AlertaAtivoItem | null;
  // Ciclo de vida (API_CONTRACTS §3.1 — "Histórico" para plantas Arquivadas, RN-021)
  statusVida?: import('./gamificacao.models').StatusVida | null;
}

export interface CreatePlantaRequest {
  apelidoLote: string;
  especieId: string;
  dispositivoId?: string;
  ufCultivo?: string;
  areaCoberta?: boolean;
}

export interface DiarioNotaItem {
  id: string;
  plantaId: string;
  etapaNumero: number;
  textoNota: string;
  criadoEm: string;
  isIa?: boolean;
}

export interface CriarDiarioNotaRequest {
  etapaNumero: number;
  textoNota: string;
  criadoEm?: string;
  isIa?: boolean;
}

export interface AnaliseSaudeIaResponse {
  statusSaude: 'EXCELENTE' | 'ATENCAO' | 'ALERTA' | string;
  diagnosticoTexto: string;
  observacoes: string[];
  recomendacoes: string[];
  dataAnalise: string;
}

export interface DiarioBordoEtapaResponse {
  notas: DiarioNotaItem[];
  diagnosticoIa: AnaliseSaudeIaResponse | null;
}
