import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, of, timeout, retry, debounceTime, distinctUntilChanged, switchMap, catchError, throwError, Subscription } from 'rxjs';
import { AgroTechService } from '../../services/agrotech.service';
import { Especie, EspecieScraped, EspecieSugestao, FonteColetaStatus, CultivoContexto, faixaOpcionalValida } from '../../models/agrotech.models';
import { environment } from '../../../environments/environment';

/** Campos do formData que compõem o guia de cultivo (wizard). */
type CampoGuia =
  | 'passo1PreparoSemente'
  | 'passo2PreparoSolo'
  | 'passo3SemeaduraGerminacao'
  | 'passo4TransplanteMudas'
  | 'passo5CrescimentoManejo'
  | 'passo6FloracaoColheita'
  | 'cuidadosDiaADia';

interface PassoGuia {
  campo: CampoGuia;
  numero: number;
  titulo: string;
  icone: string;
  iaKeys: string[];
  oficialKeys: string[];
  placeholder: string;
}

@Component({
  selector: 'app-planta-cadastro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planta-cadastro.component.html',
  styleUrls: ['./planta-cadastro.component.scss']
})
export class PlantaCadastroComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  especies: Especie[] = [];
  sugestoes: EspecieSugestao[] = [];

  private searchSubject = new Subject<string>();

  isLoadingScraping = false;
  isUploadingImagem = false;
  isSaving = false;

  // Feedback de Demora, Erro e Re-tentativa IA
  erroScrapingMensagem: string | null = null;
  erroConexaoIa = false;
  erroConexaoIaMensagem: string | null = null;
  ultimaSugestaoSelecionada: EspecieSugestao | null = null;
  mensagemDemoraSugestoes: string | null = null;

  // Preview local da imagem selecionada
  imagemPreviewUrl: string | null = null;

  // URL da API para construir URLs absolutas de imagens
  readonly apiBaseUrl = environment.apiUrl.replace('/api', '');

  progressoPercentual = 0;
  mensagemProgresso = '';
  tempoDecorrido = 0;
  private startTime = 0;
  private timerInterval: any;
  private progressInterval: any;
  private pollingProgressoInterval: any;

  // Progresso real (backend publica etapas/fontes em tempo real)
  progressoEtapa = '';
  progressoFontes = '';
  tempoEstimado = 120;
  relatorioFontes: FonteColetaStatus[] = [];

  get tempoDecorridoDisplay(): string {
    return this.tempoDecorrido.toFixed(0) + 's';
  }

  get tempoEstimadoDisplay(): string {
    const restante = Math.max(0, this.tempoEstimado - this.tempoDecorrido);
    return restante.toFixed(0) + 's';
  }

  /** Faixa de luminosidade: quando ambos preenchidos, Min <= Max (UI_SPEC §3.3 — RN-005/RN-008). */
  get luminosidadeRangeInvalida(): boolean {
    return !faixaOpcionalValida(this.formData.luminosidadeMin, this.formData.luminosidadeMax);
  }

  // ─── Wizard do Guia de Cultivo ───────────────────────────────────────────────
  passosGuia: PassoGuia[] = [
    {
      campo: 'passo1PreparoSemente',
      numero: 1,
      titulo: 'Na Loja — Escolha da Semente & Primeiros Cuidados',
      icone: 'fa-cart-shopping',
      iaKeys: ['passo1PreparoSemente'],
      oficialKeys: ['passo1PreparoSemente'],
      placeholder: '🛒 Materiais & onde comprar (ideal vs. caseiro, preço de referência, selo MAPA, validade)... 🧑‍🌾 Modo de fazer numerado... 📅 Quando fazer... ⚠️ Erros comuns... ✅ Sinais de que deu certo...'
    },
    {
      campo: 'passo2PreparoSolo',
      numero: 2,
      titulo: 'Preparo do Substrato & Sementeira (Receita de Bolo)',
      icone: 'fa-seedling',
      iaKeys: ['passo2PreparoSolo'],
      oficialKeys: ['passo2PreparoSolo'],
      placeholder: '🛒 Materiais com medidas exatas (copos de requeijão, gramas, litros)... 🧑‍🌾 Receita passo a passo... 📅 Quando fazer... ⚠️ Erros comuns... ✅ Sinais de que deu certo...'
    },
    {
      campo: 'passo3SemeaduraGerminacao',
      numero: 3,
      titulo: 'Semeadura & Germinação (Dia a Dia do Broto)',
      icone: 'fa-droplet',
      iaKeys: ['passo3SemeaduraGerminacao'],
      oficialKeys: ['passo3SemeaduraGerminacao'],
      placeholder: '🧑‍🌾 Profundidade exata (cm), sementes por célula, rega com borrifador... 📅 Dias até germinar e o que checar a cada dia... ⚠️ Erros comuns... ✅ Sinais de que deu certo...'
    },
    {
      campo: 'passo4TransplanteMudas',
      numero: 4,
      titulo: 'Endurecimento, Transplante & Local Definitivo',
      icone: 'fa-leaf',
      iaKeys: ['passo6TransplanteMudas', 'passo4CuidadosBrotoDesbaste'],
      oficialKeys: ['passo6TransplanteMudas', 'passo4CuidadosBrotoDesbaste'],
      placeholder: '🧑‍🌾 Quando transplantar (folhas verdadeiras + altura em cm), cronograma de sol, técnica da colher para raízes... 🪴 Vaso/litros, espaçamento em cm, receita do solo definitivo... ⚠️ Erros comuns... ✅ Sinais de que deu certo...'
    },
    {
      campo: 'passo5CrescimentoManejo',
      numero: 5,
      titulo: 'Crescimento — Rega, Podas, Nutrição & Defesa contra Pragas',
      icone: 'fa-sun',
      iaKeys: ['passo7NutricaoPoda', 'passo5AclimatizacaoVasoDefinitivo'],
      oficialKeys: ['passo7NutricaoPoda', 'passo5AclimatizacaoVasoDefinitivo'],
      placeholder: '🧑‍🌾 Rega (volume/frequência), poda apical, tutor... 🧪 Cronograma de adubação com doses caseiras (borra de café, casca de banana)... 🐛 Pragas comuns da espécie + receitas de defesa (sabão neutro, óleo de neem)... ⚠️ Erros comuns... ✅ Sinais de que deu certo...'
    },
    {
      campo: 'passo6FloracaoColheita',
      numero: 6,
      titulo: 'Floração, Colheita & Manutenção da Produção',
      icone: 'fa-fan',
      iaKeys: ['passo8FloracaoColheita'],
      oficialKeys: ['passo8FloracaoColheita'],
      placeholder: '🌸 Como estimular floração e polinizar (se precisar)... 🧺 Sinais exatos do ponto de colheita (cor, tamanho, dias), como colher e armazenar... 🔁 Como manter produzindo (poda pós-colheita, adubação de recuperação, quando replantar)... ✅ Sinais de que deu certo...'
    },
    {
      campo: 'cuidadosDiaADia',
      numero: 7,
      titulo: 'Rotina Diária & Diagnóstico Rápido de Problemas',
      icone: 'fa-clipboard-check',
      iaKeys: ['cuidadosDiaADia'],
      oficialKeys: ['cuidadosDiaADia'],
      placeholder: '📋 Checklist diário (manhã/tarde, 2-3 min)... 📅 Checklist semanal e mensal... 🔍 Diagnóstico rápido: folha amarela = ?, pontas secas = ?, manchas = ?, mofo = ? + ação imediata de cada sintoma...'
    }
  ];

  passoAbertoIndex = 0;

  /** Sub-seção "Ajustes avançados" (faixas ideais) da seção Condições — fechada por padrão. */
  ajustesAvancadosAbertos = signal(false);

  alternarAjustesAvancados(): void {
    this.ajustesAvancadosAbertos.update((aberto) => !aberto);
    this.cdr.detectChanges();
  }

  get etapaAtual(): number {
    if (this.formData.nomePopular && this.formData.apelidoLote) {
      return 3;
    }
    if (this.formData.nomePopular) {
      return 2;
    }
    return 1;
  }

  abrirPasso(indice: number): void {
    // Toggle: clicar no passo aberto fecha o bloco (-1 = todos fechados)
    this.passoAbertoIndex = this.passoAbertoIndex === indice ? -1 : indice;
    this.cdr.detectChanges();
  }

  proximoPasso(): void {
    if (this.passoAbertoIndex < this.passosGuia.length - 1) {
      this.passoAbertoIndex++;
      this.cdr.detectChanges();
    }
  }

  isGrupo100Ia(chaves: string[]): boolean {
    return chaves.some((k) => this.isCampo100PercentIa(k));
  }

  isGrupoBaseOficial(chaves: string[]): boolean {
    return chaves.every((k) => this.isCampoBaseOficial(k));
  }

  termoBuscaEspecie = '';
  showDropdownSugestoes = false;
  isBuscandoSugestoes = false;
  showSelectSugestoes = false;
  sugestaoSelecionada: EspecieSugestao | null = null;
  private sugestoesSubscription: Subscription | null = null;
  private timerDemoraBusca: any;
  private buscaTimerInterval: any;
  buscaDecorridaSegundos = 0;
  isBuscaDemorando = false;
  private readonly limiteSegundosBuscaNormal = 45;

  // Personalização do cultivo (a IA adapta o guia à região, mês, local e recipiente)
  contexto: CultivoContexto = {};
  ufsBrasil = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  mesesPlantio = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  locaisPlantio = ['Vaso ou jardineira', 'Canteiro no solo', 'Horta elevada', 'Garrafa PET ou recipiente reciclado'];
  tamanhosRecipiente = ['Pequeno (até 5 litros)', 'Médio (5 a 15 litros)', 'Grande (15 a 50 litros)', 'Muito grande (mais de 50 litros)', 'Planto direto no solo (não se aplica)'];

  formData = {
    apelidoLote: '',
    especieId: '',
    nomePopular: '',
    nomeCientifico: '',
    imagemUrl: '',
    umidadeSoloMin: null as number | null,
    umidadeSoloMax: null as number | null,
    temperaturaMin: null as number | null,
    temperaturaMax: null as number | null,
    luminosidadeMin: null as number | null,
    luminosidadeMax: null as number | null,
    instrucoesManejo: '',
    passo1PreparoSemente: '',
    passo2PreparoSolo: '',
    passo3SemeaduraGerminacao: '',
    passo4CuidadosBrotoDesbaste: '',
    passo5AclimatizacaoVasoDefinitivo: '',
    passo6TransplanteMudas: '',
    passo7NutricaoPoda: '',
    passo8FloracaoColheita: '',
    passo4TransplanteMudas: '',
    passo5CrescimentoManejo: '',
    passo6FloracaoColheita: '',
    cuidadosDiaADia: '',
    fonteDadosScraping: '',
    isGeradoPorIa: false
  };

  constructor(
    private agroTechService: AgroTechService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Mês do plantio já vem preenchido com o mês atual (editável)
    this.contexto.mesPlantio = new Date().getMonth() + 1;
    this.carregarEspecies();
  }

  ngOnDestroy(): void {
    this.limparTimerProgresso();
    this.pararPollingProgresso();
    this.pararCronometroBusca();
    this.sugestoesSubscription?.unsubscribe();
    this.searchSubject.complete();
  }

  carregarEspecies(): void {
    this.agroTechService.getEspecies().subscribe({
      next: (data) => {
        this.especies = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao carregar espécies:', err)
    });
  }

  todasSugestoes: EspecieSugestao[] = [];
  limiteExibicaoSugestoes = 5;

  get sugestoesExibidas(): EspecieSugestao[] {
    return this.todasSugestoes.slice(0, this.limiteExibicaoSugestoes);
  }

  get temMaisSugestoes(): boolean {
    return this.todasSugestoes.length > this.limiteExibicaoSugestoes;
  }

  mostrarMaisSugestoes(): void {
    this.limiteExibicaoSugestoes += 10;
    this.cdr.detectChanges();
  }

  onSearchChange(): void {
    // Se o usuário digitou um novo termo, cancela qualquer busca anterior em andamento
    this.sugestoesSubscription?.unsubscribe();
    this.sugestoesSubscription = null;
    this.finalizarBuscaSugestoes();

    this.formData.nomePopular = this.termoBuscaEspecie;
    this.showDropdownSugestoes = false;
    this.showSelectSugestoes = false;
    this.sugestaoSelecionada = null;
    this.todasSugestoes = [];
    this.erroScrapingMensagem = null;
    this.mensagemDemoraSugestoes = null;
    this.erroConexaoIa = false;
    this.erroConexaoIaMensagem = null;
  }

  buscarSugestoesIa(): void {
    if (!this.termoBuscaEspecie || !this.termoBuscaEspecie.trim()) return;
    if (this.isLoadingScraping) return;

    // Nova busca sempre começa com o formulário limpo: descarta qualquer dado não salvo da busca anterior
    this.limparFormularioNaoSalvo();

    // Botão vira "Tentar Novamente": cancela a busca anterior (IA instável/lenta) e recomeça
    this.sugestoesSubscription?.unsubscribe();
    this.sugestoesSubscription = null;
    this.pararCronometroBusca();

    const termo = this.termoBuscaEspecie.trim();
    this.isBuscandoSugestoes = true;
    this.showSelectSugestoes = false;
    this.sugestaoSelecionada = null;
    this.todasSugestoes = [];
    this.erroScrapingMensagem = null;
    this.mensagemDemoraSugestoes = null;
    this.erroConexaoIa = false;
    this.erroConexaoIaMensagem = null;
    this.buscaDecorridaSegundos = 0;
    this.isBuscaDemorando = false;

    this.buscaTimerInterval = setInterval(() => {
      this.buscaDecorridaSegundos++;
      if (this.buscaDecorridaSegundos >= this.limiteSegundosBuscaNormal) {
        this.isBuscaDemorando = true;
      }
      this.cdr.detectChanges();
    }, 1000);

    this.timerDemoraBusca = setTimeout(() => {
      if (this.isBuscandoSugestoes) {
        this.isBuscaDemorando = true;
        this.mensagemDemoraSugestoes = 'A busca está demorando mais que o normal — a IA pode estar instável. Clique em Tentar Novamente para cancelar e rebuscar.';
        this.cdr.detectChanges();
      }
    }, this.limiteSegundosBuscaNormal * 1000);

    this.sugestoesSubscription = this.agroTechService.getSugestoes(termo).pipe(
      timeout(90000),
      retry({ count: 1, delay: 1000 }),
      catchError((err) => {
        console.error('[PlantaCadastroComponent] Erro ao conectar/obter resposta da IA:', err);
        return throwError(() => err);
      })
    ).subscribe({
      next: (data) => {
        this.finalizarBuscaSugestoes();
        if (!data || data.length === 0) {
          this.todasSugestoes = [];
          this.showSelectSugestoes = false;
          this.erroConexaoIa = true;
          this.erroConexaoIaMensagem = 'Não foi possível se conectar e obter resposta da IA para esta busca.';
        } else {
          this.todasSugestoes = data;
          this.erroConexaoIa = false;
          this.erroConexaoIaMensagem = null;
          this.showSelectSugestoes = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.finalizarBuscaSugestoes();
        this.todasSugestoes = [];
        this.showSelectSugestoes = false;
        this.erroConexaoIa = true;
        this.erroConexaoIaMensagem = 'Não foi possível se conectar e obter resposta da IA.';
        this.cdr.detectChanges();
      }
    });
  }

  private finalizarBuscaSugestoes(): void {
    if (this.timerDemoraBusca) {
      clearTimeout(this.timerDemoraBusca);
      this.timerDemoraBusca = null;
    }
    this.pararCronometroBusca();
    this.isBuscandoSugestoes = false;
    this.isBuscaDemorando = false;
    this.mensagemDemoraSugestoes = null;
  }

  private limparFormularioNaoSalvo(): void {
    this.formData = {
      apelidoLote: '',
      especieId: '',
      nomePopular: '',
      nomeCientifico: '',
      imagemUrl: '',
      umidadeSoloMin: null,
      umidadeSoloMax: null,
      temperaturaMin: null,
      temperaturaMax: null,
      luminosidadeMin: null,
      luminosidadeMax: null,
      instrucoesManejo: '',
      passo1PreparoSemente: '',
      passo2PreparoSolo: '',
      passo3SemeaduraGerminacao: '',
      passo4CuidadosBrotoDesbaste: '',
      passo5AclimatizacaoVasoDefinitivo: '',
      passo6TransplanteMudas: '',
      passo7NutricaoPoda: '',
      passo8FloracaoColheita: '',
      passo4TransplanteMudas: '',
      passo5CrescimentoManejo: '',
      passo6FloracaoColheita: '',
      cuidadosDiaADia: '',
      fonteDadosScraping: '',
      isGeradoPorIa: false
    };
    this.imagemPreviewUrl = null;
    this.camposOrigemIa = {};
    this.ultimaSugestaoSelecionada = null;
    this.relatorioFontes = [];
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private pararCronometroBusca(): void {
    if (this.buscaTimerInterval) {
      clearInterval(this.buscaTimerInterval);
      this.buscaTimerInterval = null;
    }
  }

  tentarNovamenteBuscaIa(): void {
    this.buscarSugestoesIa();
  }

  cadastrarManualmente(): void {
    this.erroConexaoIa = false;
    this.erroConexaoIaMensagem = null;
    this.erroScrapingMensagem = null;
    this.showSelectSugestoes = false;
    if (this.termoBuscaEspecie && this.termoBuscaEspecie.trim()) {
      this.formData.nomePopular = this.termoBuscaEspecie.trim();
      if (!this.formData.apelidoLote || this.formData.apelidoLote.startsWith('Mudas de ')) {
        this.formData.apelidoLote = `Mudas de ${this.formData.nomePopular} - Lote 01`;
      }
    }
    this.cdr.detectChanges();
  }

  onSelectSugestaoChange(): void {
    if (this.sugestaoSelecionada) {
      this.selecionarSugestao(this.sugestaoSelecionada);
    }
  }

  buscarEPreencherEspecie(nome: string): void {
    if (!nome || !nome.trim()) return;

    const termo = nome.trim();
    const sugestaoEncontrada = this.todasSugestoes.find(
      (s) => s.nomePopular.toLowerCase() === termo.toLowerCase()
    ) || {
      nomePopular: termo,
      nomeCientifico: ''
    };

    this.selecionarSugestao(sugestaoEncontrada);
  }

  selecionarSugestao(sugestao: EspecieSugestao): void {
    this.ultimaSugestaoSelecionada = sugestao;
    this.termoBuscaEspecie = sugestao.nomePopular;
    this.formData.nomePopular = sugestao.nomePopular;
    if (sugestao.nomeCientifico && sugestao.nomeCientifico !== 'Espécie digitada') {
      this.formData.nomeCientifico = sugestao.nomeCientifico;
    }
    this.showDropdownSugestoes = false;
    this.showSelectSugestoes = false;

    // Cache condicional: se a espécie já tem guia completo salvo, pergunta usar o cache ou buscar de novo
    const especieSalva = this.especies.find(
      (e) => e.nomePopular.toLowerCase() === sugestao.nomePopular.toLowerCase() && !!e.passo1PreparoSemente
    );

    if (especieSalva) {
      this.sugestaoComCache = { sugestao, especie: especieSalva };
      this.cdr.detectChanges();
      return;
    }

    this.iniciarScrapingComProgresso(sugestao);
  }

  // Cache condicional
  sugestaoComCache: { sugestao: EspecieSugestao; especie: Especie } | null = null;

  usarGuiaSalvo(): void {
    if (!this.sugestaoComCache) return;
    const e = this.sugestaoComCache.especie;

    this.formData.nomePopular = e.nomePopular;
    this.formData.nomeCientifico = e.nomeCientifico || '';
    this.formData.imagemUrl = e.imagemUrl || '';
    this.imagemPreviewUrl = null;
    this.formData.umidadeSoloMin = e.umidadeSoloMin ?? null;
    this.formData.umidadeSoloMax = e.umidadeSoloMax ?? null;
    this.formData.temperaturaMin = e.temperaturaMin ?? null;
    this.formData.temperaturaMax = e.temperaturaMax ?? null;
    this.formData.luminosidadeMin = e.luminosidadeMin ?? null;
    this.formData.luminosidadeMax = e.luminosidadeMax ?? null;
    this.formData.instrucoesManejo = e.instrucoesManejo || '';
    this.formData.passo1PreparoSemente = e.passo1PreparoSemente || '';
    this.formData.passo2PreparoSolo = e.passo2PreparoSolo || '';
    this.formData.passo3SemeaduraGerminacao = e.passo3SemeaduraGerminacao || '';
    this.formData.passo4TransplanteMudas = e.passo4TransplanteMudas || e.passo4CuidadosBrotoDesbaste || '';
    this.formData.passo5CrescimentoManejo = e.passo5CrescimentoManejo || e.passo5AclimatizacaoVasoDefinitivo || '';
    this.formData.passo6FloracaoColheita = e.passo6FloracaoColheita || e.passo8FloracaoColheita || '';
    this.formData.cuidadosDiaADia = e.cuidadosDiaADia || '';
    this.formData.fonteDadosScraping = e.fonteDadosScraping || 'Guia salvo no catálogo';
    this.formData.isGeradoPorIa = false;
    this.camposOrigemIa = {};

    if (!this.formData.apelidoLote || this.formData.apelidoLote.startsWith('Mudas de ')) {
      this.formData.apelidoLote = `Mudas de ${e.nomePopular} - Lote 01`;
    }

    this.sugestaoComCache = null;
    this.cdr.detectChanges();
  }

  descartarGuiaSalvoEBuscar(): void {
    const sugestao = this.sugestaoComCache?.sugestao;
    this.sugestaoComCache = null;
    if (sugestao) {
      this.iniciarScrapingComProgresso(sugestao);
    }
  }

  // ─── Coleta Profunda com Progresso Real (polling do backend) ─────────────────

  private iniciarScrapingComProgresso(sugestao: EspecieSugestao): void {
    this.limparTimerProgresso();
    this.isLoadingScraping = true;
    this.erroScrapingMensagem = null;
    this.progressoPercentual = 2;
    this.tempoDecorrido = 0;
    this.progressoEtapa = 'Preparando coleta profunda';
    this.progressoFontes = '13 fontes mundiais selecionadas';
    this.relatorioFontes = [];
    this.mensagemProgresso = '🚀 Iniciando coleta multi-fonte (6 sites via scraping HTML + 7 bases científicas + IA)...';
    this.startTime = Date.now();
    this.tempoEstimado = 120;
    this.cdr.detectChanges();

    this.agroTechService.iniciarScrapingComProgresso(sugestao.nomePopular, sugestao.nomeCientifico, this.contexto).subscribe({
      next: (res) => {
        this.tempoEstimado = res.tempoEstimadoSegundos || 120;
        this.iniciarPollingProgresso(res.sessaoId, sugestao);
      },
      error: (err) => {
        console.error('[PlantaCadastroComponent] Falha ao iniciar coleta com progresso. Usando modo direto:', err);
        this.executarScrapingDireto(sugestao);
      }
    });
  }

  private iniciarPollingProgresso(sessaoId: string, sugestao: EspecieSugestao): void {
    this.pollingProgressoInterval = setInterval(() => {
      this.agroTechService.getProgressoScraping(sessaoId).subscribe({
        next: (p) => {
          this.progressoPercentual = p.percentual;
          this.progressoEtapa = p.etapa;
          this.progressoFontes = `Fontes concluídas: ${p.fontesConcluidas}/${p.totalFontes}`;
          this.mensagemProgresso = p.mensagem;
          this.tempoEstimado = p.tempoEstimadoSegundos;
          this.tempoDecorrido = p.decorridoSegundos;
          if (p.fontes && p.fontes.length > 0) {
            this.relatorioFontes = p.fontes;
          }

          if (p.erro) {
            this.pararPollingProgresso();
            this.finalizarProgressoErro(p.mensagemErro || 'Falha na coleta profunda de dados.');
          } else if (p.concluido) {
            this.pararPollingProgresso();
            this.buscarResultadoScraping(sessaoId);
          }
          this.cdr.detectChanges();
        },
        error: () => {
          // Sessão não encontrada/expirada — cai para o modo direto
          this.pararPollingProgresso();
          this.executarScrapingDireto(sugestao);
        }
      });
    }, 1000);
  }

  private buscarResultadoScraping(sessaoId: string): void {
    this.agroTechService.getResultadoScraping(sessaoId).subscribe({
      next: (res) => {
        if ('pronto' in res && res.pronto === false) {
          setTimeout(() => this.buscarResultadoScraping(sessaoId), 1000);
          return;
        }
        this.finalizarProgressoSucesso(res as EspecieScraped);
      },
      error: (err) => {
        console.error('[PlantaCadastroComponent] Erro ao obter resultado da coleta:', err);
        this.finalizarProgressoErro('Não foi possível obter o resultado da coleta profunda.');
      }
    });
  }

  private pararPollingProgresso(): void {
    if (this.pollingProgressoInterval) {
      clearInterval(this.pollingProgressoInterval);
      this.pollingProgressoInterval = null;
    }
  }

  private executarScrapingDireto(sugestao: EspecieSugestao): void {
    this.iniciarProgresso(sugestao.nomePopular);

    this.agroTechService.scrapeEspecie(sugestao.nomePopular, sugestao.nomeCientifico, this.contexto)
      .pipe(
        retry({ count: 1, delay: 1500 }),
        timeout(180000)
      )
      .subscribe({
        next: (scrapedData: EspecieScraped) => {
          this.finalizarProgressoSucesso(scrapedData);
        },
        error: (err) => {
          console.error(`[PlantaCadastroComponent] Erro no scraping:`, err);
          this.finalizarProgressoErro('Não foi possível obter a resposta completa no momento. O servidor pode estar ocupado. Você pode tentar novamente com 1 clique.');
        }
      });
  }

  tentarNovamenteScraping(): void {
    if (this.ultimaSugestaoSelecionada) {
      this.selecionarSugestao(this.ultimaSugestaoSelecionada);
    } else if (this.termoBuscaEspecie) {
      this.buscarEPreencherEspecie(this.termoBuscaEspecie);
    }
  }

  // ─── Upload Manual de Imagem ──────────────────────────────────────────────────

  abrirSeletorImagem(): void {
    this.fileInput.nativeElement.click();
  }

  onImagemSelecionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagemPreviewUrl = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);

    // Upload para o servidor
    this.isUploadingImagem = true;
    this.cdr.detectChanges();

    this.agroTechService.uploadEspecieImagem(file).subscribe({
      next: (res) => {
        this.formData.imagemUrl = res.url;
        this.isUploadingImagem = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[PlantaCadastroComponent] Erro no upload da imagem:', err);
        this.isUploadingImagem = false;
        this.imagemPreviewUrl = null;
        alert('Não foi possível enviar a imagem. Tente novamente.');
        this.cdr.detectChanges();
      }
    });
  }

  removerImagem(): void {
    this.formData.imagemUrl = '';
    this.imagemPreviewUrl = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.cdr.detectChanges();
  }

  get imagemExibicaoUrl(): string | null {
    if (this.imagemPreviewUrl) return this.imagemPreviewUrl;
    if (this.formData.imagemUrl) {
      return this.formData.imagemUrl.startsWith('http')
        ? this.formData.imagemUrl
        : `${this.apiBaseUrl}${this.formData.imagemUrl}`;
    }
    return null;
  }

  // ─── Progresso do Scraping ────────────────────────────────────────────────────

  private iniciarProgresso(nomePlanta: string = ''): void {
    this.limparTimerProgresso();
    this.isLoadingScraping = true;
    this.erroScrapingMensagem = null;
    this.progressoPercentual = 15;
    this.tempoDecorrido = 0;
    this.tempoEstimado = 90;
    this.progressoEtapa = 'Coleta direta (modo compatibilidade)';
    this.progressoFontes = '';
    this.mensagemProgresso = '🕷️ Etapa 1 de 3: acessando os sites (Wikipédia PT/EN + Portal Embrapa) e raspando o HTML da espécie...';
    this.startTime = Date.now();

    this.timerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.tempoDecorrido = Math.max(0, elapsed);
    }, 100);

    this.progressInterval = setInterval(() => {
      if (this.progressoPercentual < 95) {
        this.progressoPercentual += 3;
        const s = this.tempoDecorrido;
        if (s < 5) {
          this.mensagemProgresso = '🕷️ Etapa 1 de 3: acessando os sites (Wikipédia PT/EN + Portal Embrapa) e raspando o HTML da espécie...';
        } else if (s >= 5 && s < 12) {
          this.mensagemProgresso = '🏛️ Etapa 2 de 3: comparando a massa coletada com as APIs científicas (Flora do Brasil JBRJ + GBIF)...';
        } else if (s >= 12 && s < 30) {
          this.mensagemProgresso = `✨ Etapa 3 de 3: IA Agronômica (Gemini) cruzando as fontes, organizando e sanitizando os dados para ${nomePlanta || 'a espécie'}...`;
        } else {
          this.mensagemProgresso = '⚡ A coleta profunda está demorando mais que o normal (sites lentos ou IA ocupada), mas o processamento continua ativo...';
        }
        this.cdr.detectChanges();
      }
    }, 800);
  }

  camposOrigemIa: { [key: string]: boolean } = {};

  private getCampoOrigemIaStatus(campoKey: string): boolean | undefined {
    if (!this.camposOrigemIa || Object.keys(this.camposOrigemIa).length === 0) {
      return undefined;
    }

    if (typeof this.camposOrigemIa[campoKey] === 'boolean') {
      return this.camposOrigemIa[campoKey];
    }

    const aliasMap: { [key: string]: string[] } = {
      'passo4TransplanteMudas': ['passo6TransplanteMudas', 'passo4CuidadosBrotoDesbaste'],
      'passo5CrescimentoManejo': ['passo7NutricaoPoda', 'passo5AclimatizacaoVasoDefinitivo'],
      'passo6FloracaoColheita': ['passo8FloracaoColheita'],
      'umidadeSolo': ['umidadeSoloMin', 'umidadeSoloMax'],
      'temperatura': ['temperaturaMin', 'temperaturaMax']
    };

    const aliases = aliasMap[campoKey];
    if (aliases) {
      for (const alias of aliases) {
        if (typeof this.camposOrigemIa[alias] === 'boolean') {
          return this.camposOrigemIa[alias];
        }
      }
    }

    return undefined;
  }

  isCampo100PercentIa(campoKey: string): boolean {
    // Exibe o selo '100% IA' SOMENTE se houver registro explícito no mapa de origem indicando 'true'.
    // Proibido qualquer tipo de presunção ou fallback genérico.
    const status = this.getCampoOrigemIaStatus(campoKey);
    return status === true;
  }

  isCampoBaseOficial(campoKey: string): boolean {
    if (!this.formData.nomePopular || !this.formData.fonteDadosScraping) {
      return false;
    }
    const status = this.getCampoOrigemIaStatus(campoKey);
    if (status === false) {
      return true;
    }
    if (status === undefined) {
      const fontes = this.formData.fonteDadosScraping || '';
      if (fontes.includes('Jardim Botânico') || fontes.includes('GBIF') || fontes.includes('Embrapa') || fontes.includes('Flora')) {
        return true;
      }
    }
    return false;
  }

  private finalizarProgressoSucesso(scrapedData: EspecieScraped): void {
    this.limparTimerProgresso();
    this.progressoPercentual = 100;
    this.mensagemProgresso = 'Dados botânicos coletados com sucesso! ✅';

    this.formData.nomePopular = scrapedData.nomePopular;
    this.formData.nomeCientifico = scrapedData.nomeCientifico || '';
    // ⚠️ NÃO preenchemos imagemUrl automaticamente — apenas upload manual
    this.formData.umidadeSoloMin = scrapedData.umidadeSoloMin ?? null;
    this.formData.umidadeSoloMax = scrapedData.umidadeSoloMax ?? null;
    this.formData.temperaturaMin = scrapedData.temperaturaMin ?? null;
    this.formData.temperaturaMax = scrapedData.temperaturaMax ?? null;
    // Luminosidade é nullable na fonte — null deixa o campo vazio e editável (RN-005/RN-008)
    this.formData.luminosidadeMin = scrapedData.luminosidadeMin ?? null;
    this.formData.luminosidadeMax = scrapedData.luminosidadeMax ?? null;
    this.formData.instrucoesManejo = scrapedData.instrucoesManejo || '';
    this.formData.passo1PreparoSemente = scrapedData.passo1PreparoSemente || '';
    this.formData.passo2PreparoSolo = scrapedData.passo2PreparoSolo || '';
    this.formData.passo3SemeaduraGerminacao = scrapedData.passo3SemeaduraGerminacao || '';
    this.formData.passo4TransplanteMudas = scrapedData.passo4TransplanteMudas || scrapedData.passo4CuidadosBrotoDesbaste || '';
    this.formData.passo5CrescimentoManejo = scrapedData.passo5CrescimentoManejo || scrapedData.passo5AclimatizacaoVasoDefinitivo || scrapedData.passo7NutricaoPoda || '';
    this.formData.passo6FloracaoColheita = scrapedData.passo6FloracaoColheita || scrapedData.passo8FloracaoColheita || '';
    this.formData.cuidadosDiaADia = scrapedData.cuidadosDiaADia || '';
    this.formData.fonteDadosScraping = scrapedData.fonteDadosScraping || '';
    this.formData.isGeradoPorIa = !!scrapedData.isGeradoPorIa;
    this.camposOrigemIa = scrapedData.camposOrigemIa || {};

    if (!this.formData.apelidoLote || this.formData.apelidoLote.startsWith('Mudas de ')) {
      this.formData.apelidoLote = `Mudas de ${scrapedData.nomePopular} - Lote 01`;
    }

    this.cdr.detectChanges();

    setTimeout(() => {
      this.isLoadingScraping = false;
      this.progressoPercentual = 0;
      this.cdr.detectChanges();
    }, 800);
  }

  private finalizarProgressoErro(mensagem?: string): void {
    this.limparTimerProgresso();
    this.isLoadingScraping = false;
    this.progressoPercentual = 0;
    this.erroScrapingMensagem = mensagem || 'Não foi possível obter a resposta completa no momento. O servidor pode estar ocupado. Você pode tentar novamente com 1 clique.';
    this.cdr.detectChanges();
  }

  private limparTimerProgresso(): void {
    this.pararPollingProgresso();
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ─── Salvar ───────────────────────────────────────────────────────────────────

  salvar(): void {
    if (this.isSaving) return;

    if (!this.formData.apelidoLote.trim()) {
      alert('Por favor, informe o apelido/lote da planta.');
      return;
    }

    if (!this.formData.nomePopular.trim()) {
      alert('Por favor, selecione ou informe a espécie da planta.');
      return;
    }

    if (this.luminosidadeRangeInvalida) {
      alert('Luminosidade: o mínimo deve ser menor ou igual ao máximo.');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const especieDados: Partial<Especie> = {
      nomePopular: this.formData.nomePopular,
      nomeCientifico: this.formData.nomeCientifico,
      imagemUrl: this.formData.imagemUrl || undefined,
      umidadeSoloMin: this.formData.umidadeSoloMin,
      umidadeSoloMax: this.formData.umidadeSoloMax,
      temperaturaMin: this.formData.temperaturaMin,
      temperaturaMax: this.formData.temperaturaMax,
      luminosidadeMin: this.formData.luminosidadeMin,
      luminosidadeMax: this.formData.luminosidadeMax,
      instrucoesManejo: this.formData.instrucoesManejo,
      passo1PreparoSemente: this.formData.passo1PreparoSemente,
      passo2PreparoSolo: this.formData.passo2PreparoSolo,
      passo3SemeaduraGerminacao: this.formData.passo3SemeaduraGerminacao,
      passo4TransplanteMudas: this.formData.passo4TransplanteMudas,
      passo5CrescimentoManejo: this.formData.passo5CrescimentoManejo,
      passo6FloracaoColheita: this.formData.passo6FloracaoColheita,
      cuidadosDiaADia: this.formData.cuidadosDiaADia,
      fonteDadosScraping: 'Reflora / Embrapa / GBIF'
    };

    const especieExistente = this.especies.find(
      (e) => e.nomePopular.toLowerCase() === this.formData.nomePopular.toLowerCase()
    );

    if (especieExistente) {
      this.executarCriacaoPlanta(especieExistente.id);
    } else {
      this.agroTechService.createEspecie(especieDados).subscribe({
        next: (especieCriada) => {
          this.executarCriacaoPlanta(especieCriada.id);
        },
        error: (err) => {
          console.error('Erro ao salvar espécie:', err);
          this.isSaving = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  private executarCriacaoPlanta(especieId: string): void {
    const payload = {
      apelidoLote: this.formData.apelidoLote,
      especieId: especieId,
      ufCultivo: this.contexto.regiaoUf,
      areaCoberta: this.contexto.areaCoberta
    };

    this.agroTechService.createPlanta(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/plantas']);
      },
      error: (err) => {
        console.error('Erro ao criar planta:', err);
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  voltar(): void {
    this.router.navigate(['/plantas']);
  }
}
