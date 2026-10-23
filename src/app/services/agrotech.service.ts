import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Especie, EspecieScraped, EspecieSugestao, Planta, CreatePlantaRequest, DiarioNotaItem, CriarDiarioNotaRequest, AnaliseSaudeIaResponse, DiarioBordoEtapaResponse, ScrapingProgresso, CultivoContexto, EventoCalendarioItem, ConquistaProgresso, PlantaFotoItem, NotificacaoItem, ClimaPlantaResponse } from '../models/agrotech.models';
import {
  ConquistaLista,
  EstagioCiclo,
  GamificacaoPlantaResponse,
  GerarGamificacaoResponse,
  JardimGamificacaoResponse,
  ManejoResponse,
  RegistroCuidadoResponse,
  TransicaoEstagioResponse,
  TransplanteResponse
} from '../models/gamificacao.models';
import {
  AvaliacaoEstadoItem,
  ConcluirEtapaResponse,
  ConsultaAssistenteResponse,
  ConsultarAssistenteRequest,
  CriarPlanoRequest,
  CreatePlantaExistenteRequest,
  DispositivoItem,
  IntervencaoItem,
  PlantaExistenteResponse,
  PlanoRecuperacaoItem,
  RecomendacaoIaItem,
  RegistrarAvaliacaoRequest,
  RegistrarIntervencaoRequest,
  SugestaoEtapasResponse
} from '../models/recuperacao.models';

@Injectable({
  providedIn: 'root'
})
export class AgroTechService {
  get apiUrl(): string {
    const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('AGROTECH_API_URL') : null;
    if (custom && custom.trim().length > 0) {
      return custom.trim().replace(/\/$/, '');
    }
    return environment.apiUrl;
  }

  private get defaultHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('AGROTECH_API_URL') : null;
    if (custom && custom.trim().length > 0) {
      // Modo túnel local (localtunnel/ngrok): header obrigatório para bypass da página de aviso do localtunnel.
      // Aplicado SOMENTE no modo túnel para não alterar o comportamento em produção (evita preflight global).
      headers = headers.set('bypass-tunnel-reminder', '1');
    }
    return headers;
  }

  constructor(private http: HttpClient) {}

  getSugestoes(query: string): Observable<EspecieSugestao[]> {
    console.log(`[AgroTechService] 🔍 Solicitando sugestões para query="${query}" -> ${this.apiUrl}/especies/sugestoes`);
    const params = new HttpParams().set('query', query);
    return this.http.get<EspecieSugestao[]>(`${this.apiUrl}/especies/sugestoes`, { params, headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Sugestões recebidas:`, res))
    );
  }

  scrapeEspecie(nomeBusca: string, nomeCientifico?: string, contexto?: CultivoContexto): Observable<EspecieScraped> {
    console.log(`[AgroTechService] 🤖 Solicitando scraping botânico para "${nomeBusca}" (${nomeCientifico || 'sem nome científico'}) -> ${this.apiUrl}/especies/scraping`);
    const body = { nomeBusca, nomeCientifico, ...(contexto || {}) };
    return this.http.post<EspecieScraped>(`${this.apiUrl}/especies/scraping`, body, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Dados de scraping recebidos:`, res))
    );
  }

  iniciarScrapingComProgresso(nomeBusca: string, nomeCientifico?: string, contexto?: CultivoContexto): Observable<{ sessaoId: string; tempoEstimadoSegundos: number }> {
    console.log(`[AgroTechService] 🚀 Iniciando coleta profunda com progresso para "${nomeBusca}" -> ${this.apiUrl}/especies/scraping/iniciar`);
    const body = { nomeBusca, nomeCientifico, ...(contexto || {}) };
    return this.http.post<{ sessaoId: string; tempoEstimadoSegundos: number }>(`${this.apiUrl}/especies/scraping/iniciar`, body, { headers: this.defaultHeaders });
  }

  getProgressoScraping(sessaoId: string): Observable<ScrapingProgresso> {
    return this.http.get<ScrapingProgresso>(`${this.apiUrl}/especies/scraping/progresso/${sessaoId}`, { headers: this.defaultHeaders });
  }

  getResultadoScraping(sessaoId: string): Observable<EspecieScraped | { pronto: false }> {
    return this.http.get<EspecieScraped | { pronto: false }>(`${this.apiUrl}/especies/scraping/resultado/${sessaoId}`, { headers: this.defaultHeaders });
  }

  getEspecies(): Observable<Especie[]> {
    console.log(`[AgroTechService] 📋 Carregando catálogo de espécies -> ${this.apiUrl}/especies`);
    return this.http.get<Especie[]>(`${this.apiUrl}/especies`, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Total espécies recebidas: ${res.length}`))
    );
  }

  createEspecie(especie: Partial<Especie>): Observable<Especie> {
    console.log(`[AgroTechService] ➕ Criando nova espécie no banco:`, especie);
    return this.http.post<Especie>(`${this.apiUrl}/especies`, especie, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Espécie criada com ID=${res.id}`))
    );
  }

  updateEspecie(id: string, especie: Partial<Especie>): Observable<Especie> {
    console.log(`[AgroTechService] ✏️ Atualizando espécie ID=${id}:`, especie);
    return this.http.put<Especie>(`${this.apiUrl}/especies/${id}`, especie, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Espécie atualizada com sucesso!`))
    );
  }

  uploadEspecieImagem(file: File): Observable<{ url: string }> {
    console.log(`[AgroTechService] 🖼️ Enviando imagem da espécie para -> ${this.apiUrl}/uploads/especie-imagem`);
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/uploads/especie-imagem`, formData, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Imagem salva em: ${res.url}`))
    );
  }

  getPlantas(): Observable<Planta[]> {
    console.log(`[AgroTechService] 🌿 Carregando lista de plantas -> ${this.apiUrl}/plantas`);
    return this.http.get<Planta[]>(`${this.apiUrl}/plantas`, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Total plantas cadastradas: ${res.length}`))
    );
  }

  getPlantaById(id: string): Observable<Planta> {
    console.log(`[AgroTechService] 🔍 Buscando planta ID=${id}`);
    return this.http.get<Planta>(`${this.apiUrl}/plantas/${id}`, { headers: this.defaultHeaders });
  }

  getCalendario(plantaId: string): Observable<EventoCalendarioItem[]> {
    return this.http.get<EventoCalendarioItem[]>(`${this.apiUrl}/plantas/${plantaId}/calendario`, { headers: this.defaultHeaders });
  }

  gerarCalendario(plantaId: string, chaveEtapaInicial: string): Observable<EventoCalendarioItem[]> {
    console.log(`[AgroTechService] 📅 Gerando calendário preditivo a partir da etapa "${chaveEtapaInicial}"`);
    return this.http.post<EventoCalendarioItem[]>(`${this.apiUrl}/plantas/${plantaId}/calendario/gerar`, { chaveEtapaInicial }, { headers: this.defaultHeaders });
  }

  concluirEventoCalendario(plantaId: string, eventoId: string, dataRealizada: string, observacao?: string): Observable<EventoCalendarioItem> {
    return this.http.post<EventoCalendarioItem>(`${this.apiUrl}/plantas/${plantaId}/calendario/${eventoId}/concluir`, { dataRealizada, observacao }, { headers: this.defaultHeaders });
  }

  getStatusCalendario(plantaId: string): Observable<{ recalibrandoIa: boolean }> {
    return this.http.get<{ recalibrandoIa: boolean }>(`${this.apiUrl}/plantas/${plantaId}/calendario/status`, { headers: this.defaultHeaders });
  }

  getConquistas(): Observable<ConquistaProgresso[]> {
    return this.http.get<ConquistaProgresso[]>(`${this.apiUrl}/conquistas`, { headers: this.defaultHeaders });
  }

  getNotificacoes(): Observable<NotificacaoItem[]> {
    return this.http.get<NotificacaoItem[]>(`${this.apiUrl}/plantas/notificacoes`, { headers: this.defaultHeaders });
  }

  getFotosPlanta(plantaId: string): Observable<PlantaFotoItem[]> {
    return this.http.get<PlantaFotoItem[]>(`${this.apiUrl}/plantas/${plantaId}/fotos`, { headers: this.defaultHeaders });
  }

  adicionarFotoPlanta(plantaId: string, url: string, dataFoto?: string, legenda?: string): Observable<PlantaFotoItem> {
    return this.http.post<PlantaFotoItem>(`${this.apiUrl}/plantas/${plantaId}/fotos`, { url, dataFoto, legenda }, { headers: this.defaultHeaders });
  }

  removerFotoPlanta(plantaId: string, fotoId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/plantas/${plantaId}/fotos/${fotoId}`, { headers: this.defaultHeaders });
  }

  getClima(plantaId: string): Observable<ClimaPlantaResponse> {
    return this.http.get<ClimaPlantaResponse>(`${this.apiUrl}/plantas/${plantaId}/clima`, { headers: this.defaultHeaders });
  }

  createPlanta(request: CreatePlantaRequest): Observable<Planta> {
    console.log(`[AgroTechService] 💾 Salvando nova planta no PostgreSQL:`, request);
    return this.http.post<Planta>(`${this.apiUrl}/plantas`, request, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Planta salva com sucesso! ID=${res.id}`))
    );
  }

  updatePlanta(id: string, request: CreatePlantaRequest): Observable<Planta> {
    console.log(`[AgroTechService] ✏️ Atualizando planta ID=${id}:`, request);
    return this.http.put<Planta>(`${this.apiUrl}/plantas/${id}`, request, { headers: this.defaultHeaders }).pipe(
      tap(res => console.log(`[AgroTechService] ✅ Planta atualizada com sucesso!`))
    );
  }

  deletePlanta(id: string): Observable<void> {
    console.log(`[AgroTechService] 🗑️ Deletando planta ID=${id}`);
    return this.http.delete<void>(`${this.apiUrl}/plantas/${id}`, { headers: this.defaultHeaders }).pipe(
      tap(() => console.log(`[AgroTechService] ✅ Planta excluída!`))
    );
  }

  perguntarIaEtapa(request: {
    nomePopular: string;
    nomeCientifico?: string | null;
    apelidoLote?: string | null;
    etapaNumero: number;
    etapaTitulo: string;
    etapaResumo: string;
    instrucaoEtapa?: string | null;
    perguntaUsuario: string;
    umidadeSoloMin?: number | null;
    umidadeSoloMax?: number | null;
    temperaturaMin?: number | null;
    temperaturaMax?: number | null;
    instrucoesManejo?: string | null;
  }): Observable<{ resposta: string }> {
    console.log(`[AgroTechService] 💬 Enviando pergunta para a IA sobre a etapa ${request.etapaNumero}: "${request.perguntaUsuario}"`);
    return this.http.post<{ resposta: string }>(`${this.apiUrl}/especies/chat-etapa`, request, { headers: this.defaultHeaders });
  }

  // ─── Diário de Bordo & Análise Fitossanitária IA ─────────────────────────────

  getDiarioBordoEtapa(plantaId: string, etapaNumero: number): Observable<DiarioBordoEtapaResponse> {
    return this.http.get<DiarioBordoEtapaResponse>(`${this.apiUrl}/plantas/${plantaId}/diario/${etapaNumero}`, { headers: this.defaultHeaders });
  }

  adicionarNotaDiario(plantaId: string, payload: CriarDiarioNotaRequest): Observable<DiarioNotaItem> {
    return this.http.post<DiarioNotaItem>(`${this.apiUrl}/plantas/${plantaId}/diario`, payload, { headers: this.defaultHeaders });
  }

  excluirNotaDiario(plantaId: string, notaId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/plantas/${plantaId}/diario/${notaId}`, { headers: this.defaultHeaders });
  }

  analisarSaudeDiario(plantaId: string, etapaNumero: number, payload: any): Observable<AnaliseSaudeIaResponse> {
    console.log(`[AgroTechService] 🩺 Solicitando análise fitossanitária de saúde para PlantaId=${plantaId} Etapa=${etapaNumero}`);
    return this.http.post<AnaliseSaudeIaResponse>(`${this.apiUrl}/plantas/${plantaId}/diario/${etapaNumero}/analisar`, payload, { headers: this.defaultHeaders });
  }

  // ─── Gamificação — Trilha do Cultivador (API_CONTRACTS §5 e §6) ──────────────

  /** Estado completo da gamificação da planta (§5.1). */
  getGamificacaoPlanta(plantaId: string): Observable<GamificacaoPlantaResponse> {
    return this.http.get<GamificacaoPlantaResponse>(`${this.apiUrl}/plantas/${plantaId}/gamificacao`, { headers: this.defaultHeaders });
  }

  /** Geração de conquistas por IA com fallback (§5.2). 409 = já gerada (ERR-GAM-005). */
  gerarGamificacao(plantaId: string): Observable<GerarGamificacaoResponse> {
    console.log(`[AgroTechService] ✨ Gerando gamificação da planta ID=${plantaId}`);
    return this.http.post<GerarGamificacaoResponse>(`${this.apiUrl}/plantas/${plantaId}/gamificacao/gerar`, {}, { headers: this.defaultHeaders });
  }

  /** Transição de estágio do ciclo de vida com validação de tempo mínimo (§5.3). */
  avancarEstagio(plantaId: string, novoEstagio: EstagioCiclo): Observable<TransicaoEstagioResponse> {
    console.log(`[AgroTechService] 🪜 Avançando estágio da planta ID=${plantaId} para ${novoEstagio}`);
    return this.http.post<TransicaoEstagioResponse>(`${this.apiUrl}/plantas/${plantaId}/estagio`, { novoEstagio }, { headers: this.defaultHeaders });
  }

  /** Confirmação de ação de manejo a partir de alerta (§5.4). */
  confirmarManejo(plantaId: string, alertaId: number): Observable<ManejoResponse> {
    console.log(`[AgroTechService] 🧑‍🌾 Confirmando manejo da planta ID=${plantaId} (alerta ${alertaId})`);
    return this.http.post<ManejoResponse>(`${this.apiUrl}/plantas/${plantaId}/manejo`, { alertaId }, { headers: this.defaultHeaders });
  }

  /** Cuidado manual do dia para plantas sem sensor — idempotente por dia (§5.8, CR-001). */
  registrarCuidado(plantaId: string): Observable<RegistroCuidadoResponse> {
    console.log(`[AgroTechService] 🤲 Registrando cuidado manual da planta ID=${plantaId}`);
    return this.http.post<RegistroCuidadoResponse>(`${this.apiUrl}/plantas/${plantaId}/cuidado`, {}, { headers: this.defaultHeaders });
  }

  /** Registro de transplante/remanejo e abertura da janela de verificação de 7 dias (§5.5). */
  registrarTransplante(plantaId: string, observacao?: string): Observable<TransplanteResponse> {
    return this.http.post<TransplanteResponse>(`${this.apiUrl}/plantas/${plantaId}/transplante`, { observacao }, { headers: this.defaultHeaders });
  }

  /** Arquivamento da planta (gamificação vai para histórico, XP preservado — §5.6). */
  arquivarPlanta(plantaId: string): Observable<void> {
    console.log(`[AgroTechService] 🗄️ Arquivando planta ID=${plantaId}`);
    return this.http.post<void>(`${this.apiUrl}/plantas/${plantaId}/arquivar`, {}, { headers: this.defaultHeaders });
  }

  /** Lista completa das conquistas da planta, bloqueadas e concluídas (§5.7). */
  getConquistasDaPlanta(plantaId: string): Observable<ConquistaLista[]> {
    return this.http.get<ConquistaLista[]>(`${this.apiUrl}/plantas/${plantaId}/conquistas`, { headers: this.defaultHeaders });
  }

  /** XP do Cultivador + conquistas de coleção do jardim (§6.1). */
  getGamificacaoJardim(): Observable<JardimGamificacaoResponse> {
    return this.http.get<JardimGamificacaoResponse>(`${this.apiUrl}/jardim/gamificacao`, { headers: this.defaultHeaders });
  }

  // ─── Plantas Existentes, Recuperação e Assistência IA (API_CONTRACTS §7) ─────

  /** Cadastro de planta sem origem conhecida — jornada inicia no estágio atual (§7.1, RN-026/027). */
  cadastrarPlantaExistente(request: CreatePlantaExistenteRequest): Observable<PlantaExistenteResponse> {
    console.log(`[AgroTechService] 🪴 Cadastrando planta existente "${request.apelidoLote}" (estágio ${request.estagioAtual})`);
    return this.http.post<PlantaExistenteResponse>(`${this.apiUrl}/plantas/existente`, request, { headers: this.defaultHeaders });
  }

  /** Registro de avaliação de estado físico (§7.2 — RN-028/029). 503 preserva dados brutos (RN-036). */
  registrarAvaliacao(plantaId: string, request: RegistrarAvaliacaoRequest): Observable<HttpResponse<AvaliacaoEstadoItem>> {
    console.log(`[AgroTechService] 🩺 Registrando estado físico da planta ID=${plantaId}`);
    return this.http.post<AvaliacaoEstadoItem>(`${this.apiUrl}/plantas/${plantaId}/avaliacoes`, request, {
      headers: this.defaultHeaders,
      observe: 'response'
    });
  }

  /** Histórico de avaliações de estado físico, mais recente primeiro (§7.3). */
  getAvaliacoes(plantaId: string): Observable<AvaliacaoEstadoItem[]> {
    return this.http.get<AvaliacaoEstadoItem[]>(`${this.apiUrl}/plantas/${plantaId}/avaliacoes`, { headers: this.defaultHeaders });
  }

  /** Registro de intervenção de manejo — corrente ou retroativa (§7.4 — RN-030/031/032). */
  registrarIntervencao(plantaId: string, request: RegistrarIntervencaoRequest): Observable<IntervencaoItem> {
    console.log(`[AgroTechService] 🛠️ Registrando intervenção ${request.tipo} da planta ID=${plantaId}`);
    return this.http.post<IntervencaoItem>(`${this.apiUrl}/plantas/${plantaId}/intervencoes`, request, { headers: this.defaultHeaders });
  }

  /** Histórico de intervenções com resumo do plano vinculado (§7.5). */
  getIntervencoes(plantaId: string): Observable<IntervencaoItem[]> {
    return this.http.get<IntervencaoItem[]>(`${this.apiUrl}/plantas/${plantaId}/intervencoes`, { headers: this.defaultHeaders });
  }

  /** Sugestão de etapas do plano via IA, sem persistir (§7.6.1 — RN-033). 503 → criação manual. */
  sugerirEtapasPlano(intervencaoId: string): Observable<SugestaoEtapasResponse> {
    console.log(`[AgroTechService] ✨ Sugerindo etapas de plano para intervenção ID=${intervencaoId}`);
    return this.http.post<SugestaoEtapasResponse>(`${this.apiUrl}/intervencoes/${intervencaoId}/plano/sugestao`, {}, { headers: this.defaultHeaders });
  }

  /** Cria e ativa o plano de recuperação com as etapas (§7.6.2 — RN-033). */
  criarPlanoRecuperacao(intervencaoId: string, request: CriarPlanoRequest): Observable<PlanoRecuperacaoItem> {
    console.log(`[AgroTechService] 📋 Criando plano de recuperação da intervenção ID=${intervencaoId}`);
    return this.http.post<PlanoRecuperacaoItem>(`${this.apiUrl}/intervencoes/${intervencaoId}/plano`, request, { headers: this.defaultHeaders });
  }

  /** Conclusão de etapa do plano — idempotente (§7.6.3 — RN-033). */
  concluirEtapaPlano(planoId: string, etapaId: string): Observable<ConcluirEtapaResponse> {
    return this.http.patch<ConcluirEtapaResponse>(`${this.apiUrl}/planos/${planoId}/etapas/${etapaId}/concluir`, {}, { headers: this.defaultHeaders });
  }

  /** Plano da intervenção — 404 com corpo vazio = sem plano (§7.6.4). */
  getPlanoDaIntervencao(intervencaoId: string): Observable<PlanoRecuperacaoItem> {
    return this.http.get<PlanoRecuperacaoItem>(`${this.apiUrl}/intervencoes/${intervencaoId}/plano`, { headers: this.defaultHeaders });
  }

  /** Consulta ao assistente IA da planta (§7.7.1 — RN-035). */
  consultarAssistente(plantaId: string, request: ConsultarAssistenteRequest): Observable<ConsultaAssistenteResponse> {
    console.log(`[AgroTechService] 💬 Consultando assistente IA da planta ID=${plantaId}`);
    return this.http.post<ConsultaAssistenteResponse>(`${this.apiUrl}/plantas/${plantaId}/assistente/consultar`, request, { headers: this.defaultHeaders });
  }

  /** Recomendações proativas vigentes da planta (§7.7.2 — RN-034). */
  getRecomendacoesIa(plantaId: string): Observable<RecomendacaoIaItem[]> {
    return this.http.get<RecomendacaoIaItem[]>(`${this.apiUrl}/plantas/${plantaId}/assistente/recomendacoes`, { headers: this.defaultHeaders });
  }

  /**
   * Dispositivos IoT ativos para o vínculo opcional do cadastro (UI_SPEC §5.3).
   * TODO: endpoint ainda não definido no API_CONTRACTS.md — sinalizado como pendência.
   */
  getDispositivosAtivos(): Observable<DispositivoItem[]> {
    return this.http.get<DispositivoItem[]>(`${this.apiUrl}/dispositivos`, { headers: this.defaultHeaders });
  }
}
