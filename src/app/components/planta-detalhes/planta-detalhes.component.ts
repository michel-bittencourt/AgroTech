import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AgroTechService } from '../../services/agrotech.service';
import { Especie, Planta, EventoCalendarioItem, PlantaFotoItem, ClimaPlantaResponse } from '../../models/agrotech.models';
import { environment } from '../../../environments/environment';
import {
  CuidadosSemana,
  ConquistaItem,
  ConquistaLista,
  ESTAGIO_VISUAL,
  EstagioCiclo,
  GamificacaoPlantaResponse,
  GerarGamificacaoResponse,
  ORDEM_ESTAGIOS,
  ORDEM_TIERS,
  SeloConquistado,
  StatusVida,
  TIER_VISUAL,
  TierConquista,
  TrilhaEstagioItem,
  TransicaoEstagioResponse,
  TransplanteResponse,
  cuidadoHojeRegistrado,
  extrairMensagemErro,
  formatarContagemRegressiva,
  formatarDataHora,
  larguraBarraSaude,
  normalizarDiasCuidados,
  proximoEstagio,
  rotuloDiaCuidado,
  transicaoDisponivel
} from '../../models/gamificacao.models';
import { GamificacaoHubService } from '../../services/gamificacao-hub.service';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';

/** Seções colapsáveis da tela de detalhe (redesign UI). */
type SecaoGamificacao = 'trilha' | 'conquistas' | 'saude' | 'acoes';

@Component({
  selector: 'app-planta-detalhes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planta-detalhes.component.html',
  styleUrls: ['./planta-detalhes.component.scss']
})
export class PlantaDetalhesComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  plantaId: string | null = null;
  planta: Planta | null = null;

  isEditing = false;
  isSaving = false;
  isLoading = true;
  isUploadingImagem = false;
  showConfirmDelete = false;

  // Preview local da nova imagem durante edição
  imagemPreviewUrl: string | null = null;

  readonly apiBaseUrl = environment.apiUrl.replace('/api', '');

  // Form edit model com 8 passos da Wiki
  formData: {
    apelidoLote: string;
    especieId: string;
    nomePopular: string;
    nomeCientifico: string;
    imagemUrl: string;
    umidadeSoloMin: number | null;
    umidadeSoloMax: number | null;
    temperaturaMin: number | null;
    temperaturaMax: number | null;
    instrucoesManejo: string;
    passo1PreparoSemente: string;
    passo2PreparoSolo: string;
    passo3SemeaduraGerminacao: string;
    passo4CuidadosBrotoDesbaste: string;
    passo5AclimatizacaoVasoDefinitivo: string;
    passo6TransplanteMudas: string;
    passo7NutricaoPoda: string;
    passo8FloracaoColheita: string;
    passo4TransplanteMudas?: string;
    passo5CrescimentoManejo?: string;
    passo6FloracaoColheita?: string;
    cuidadosDiaADia: string;
    fonteDadosScraping: string;
    isGeradoPorIa: boolean;
  } = {
    apelidoLote: '',
    especieId: '',
    nomePopular: '',
    nomeCientifico: '',
    imagemUrl: '',
    umidadeSoloMin: null as number | null,
    umidadeSoloMax: null as number | null,
    temperaturaMin: null as number | null,
    temperaturaMax: null as number | null,
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
    private route: ActivatedRoute,
    private router: Router,
    private agroTechService: AgroTechService,
    private cdr: ChangeDetectorRef
  ) {
    // Evento SignalR desta planta → atualiza trilha/XP/cards em tempo real (RN-022)
    effect(() => {
      const evento = this.gamificacaoHub.ultimaConquista();
      if (evento && evento.plantaId === this.plantaId) {
        this.carregarGamificacao();
      }
      this.cdr.detectChanges();
    });
  }

  // ─── Galeria de Evolução ─────────────────────────────────────────────────────
  @ViewChild('fotoGaleriaInput') fotoGaleriaInput!: ElementRef<HTMLInputElement>;
  fotos: PlantaFotoItem[] = [];
  isLoadingFotos = false;
  isEnviandoFotoGaleria = false;
  dataFotoSelecionada = '';

  carregarFotos(): void {
    if (!this.plantaId) return;
    this.isLoadingFotos = true;
    this.agroTechService.getFotosPlanta(this.plantaId).subscribe({
      next: (fotos) => {
        this.fotos = fotos || [];
        this.isLoadingFotos = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar galeria:', err);
        this.isLoadingFotos = false;
        this.cdr.detectChanges();
      }
    });
  }

  abrirSeletorFotoGaleria(): void {
    this.fotoGaleriaInput.nativeElement.click();
  }

  onFotoGaleriaSelecionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.plantaId) return;

    const file = input.files[0];
    this.isEnviandoFotoGaleria = true;
    this.cdr.detectChanges();

    this.agroTechService.uploadEspecieImagem(file).subscribe({
      next: (res) => {
        const dataFoto = this.dataFotoSelecionada ? `${this.dataFotoSelecionada}T12:00:00Z` : undefined;
        this.agroTechService.adicionarFotoPlanta(this.plantaId!, res.url, dataFoto).subscribe({
          next: () => {
            this.isEnviandoFotoGaleria = false;
            input.value = '';
            this.carregarFotos();
          },
          error: (err) => {
            console.error('Erro ao registrar foto na galeria:', err);
            this.isEnviandoFotoGaleria = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Erro no upload da foto:', err);
        this.isEnviandoFotoGaleria = false;
        this.cdr.detectChanges();
      }
    });
  }

  removerFotoGaleria(foto: PlantaFotoItem): void {
    if (!this.plantaId || !confirm('Remover esta foto da galeria?')) return;
    this.agroTechService.removerFotoPlanta(this.plantaId, foto.id).subscribe({
      next: () => this.carregarFotos(),
      error: (err) => console.error('Erro ao remover foto:', err)
    });
  }

  urlFotoGaleria(url: string): string {
    return url.startsWith('http') ? url : `${this.apiBaseUrl}${url}`;
  }

  ngOnInit(): void {
    this.plantaId = this.route.snapshot.paramMap.get('id');
    if (this.plantaId) {
      this.carregarPlanta(this.plantaId);
      this.carregarCalendario();
      this.carregarFotos();
      this.carregarClima();
      this.carregarGamificacao();
      this.carregarConquistas();
      this.gamificacaoHub.iniciar();
      this.iniciarContagemRegressiva();
    } else {
      this.router.navigate(['/plantas']);
    }
  }

  ngOnDestroy(): void {
    if (this.contagemInterval) {
      clearInterval(this.contagemInterval);
      this.contagemInterval = null;
    }
  }

  // ─── Clima na região (advisory-only) ─────────────────────────────────────────
  clima: ClimaPlantaResponse | null = null;

  carregarClima(): void {
    if (!this.plantaId) return;
    this.agroTechService.getClima(this.plantaId).subscribe({
      next: (res) => {
        this.clima = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar clima:', err);
      }
    });
  }

  // ─── Calendário Preditivo de Cultivo ─────────────────────────────────────────
  calendario: EventoCalendarioItem[] = [];
  isLoadingCalendario = false;
  isGerandoCalendario = false;
  isConcluindoEvento = '';
  etapaSelecionada = 'escolha_semente';
  etapasIniciais = [
    { chave: 'escolha_semente', label: '🌱 Escolha da semente na loja' },
    { chave: 'teste_germinacao', label: '🧻 Teste de germinação' },
    { chave: 'semeadura', label: '🌾 Semeadura' },
    { chave: 'germinacao', label: '💧 Germinação' },
    { chave: 'transplante', label: '🪴 Transplante das mudas' },
    { chave: 'crescimento', label: '☀️ Crescimento' },
    { chave: 'floracao', label: '🌸 Floração' },
    { chave: 'colheita', label: '🧺 Colheita' }
  ];

  carregarCalendario(): void {
    if (!this.plantaId) return;
    this.isLoadingCalendario = true;
    this.agroTechService.getCalendario(this.plantaId).subscribe({
      next: (eventos) => {
        this.calendario = eventos || [];
        this.isLoadingCalendario = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar calendário:', err);
        this.isLoadingCalendario = false;
        this.cdr.detectChanges();
      }
    });
  }

  gerarCalendarioAgora(): void {
    if (!this.plantaId || this.isGerandoCalendario) return;
    this.isGerandoCalendario = true;
    this.cdr.detectChanges();
    this.agroTechService.gerarCalendario(this.plantaId, this.etapaSelecionada).subscribe({
      next: (eventos) => {
        this.calendario = eventos || [];
        this.isGerandoCalendario = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao gerar calendário:', err);
        this.isGerandoCalendario = false;
        this.cdr.detectChanges();
      }
    });
  }

  concluirEvento(ev: EventoCalendarioItem): void {
    if (!this.plantaId || this.isConcluindoEvento) return;
    this.isConcluindoEvento = ev.id;
    this.cdr.detectChanges();

    // Meio-dia UTC evita deslocamento de fuso ao registrar a data real
    const hojeIso = new Date().toISOString().slice(0, 10) + 'T12:00:00Z';
    this.agroTechService.concluirEventoCalendario(this.plantaId, ev.id, hojeIso).subscribe({
      next: () => {
        this.isConcluindoEvento = '';
        this.carregarCalendario();
        // Marco de fase: a IA recalibra em background — acompanha e recarrega ao finalizar
        if (['germinacao', 'transplante', 'crescimento', 'floracao', 'colheita'].includes(ev.chaveEtapa)) {
          this.acompanharRecalibracaoIa();
        }
      },
      error: (err) => {
        console.error('Erro ao concluir evento:', err);
        this.isConcluindoEvento = '';
        this.cdr.detectChanges();
      }
    });
  }

  // Acompanha a recalibração da IA em background (poll a cada 4s, máx. 60s)
  isRecalibrandoIa = false;
  private recalibracaoPollInterval: any;

  private acompanharRecalibracaoIa(): void {
    if (!this.plantaId) return;

    this.isRecalibrandoIa = true;
    this.cdr.detectChanges();

    if (this.recalibracaoPollInterval) {
      clearInterval(this.recalibracaoPollInterval);
    }

    let tentativas = 0;
    this.recalibracaoPollInterval = setInterval(() => {
      tentativas++;
      this.agroTechService.getStatusCalendario(this.plantaId!).subscribe({
        next: (status) => {
          if (!status.recalibrandoIa || tentativas >= 15) {
            clearInterval(this.recalibracaoPollInterval);
            this.recalibracaoPollInterval = null;
            this.isRecalibrandoIa = false;
            this.carregarCalendario();
          }
          this.cdr.detectChanges();
        },
        error: () => {
          clearInterval(this.recalibracaoPollInterval);
          this.recalibracaoPollInterval = null;
          this.isRecalibrandoIa = false;
          this.cdr.detectChanges();
        }
      });
    }, 4000);
  }

  get eventosAcoesHoje(): EventoCalendarioItem[] {
    const hojeIso = new Date().toISOString().slice(0, 10);
    return this.calendario.filter((ev) => {
      if (ev.concluido) return false;
      const dataEv = ev.dataPrevista.slice(0, 10);
      return dataEv <= hojeIso;
    });
  }

  statusEvento(ev: EventoCalendarioItem): 'concluido' | 'atrasado' | 'hoje' | 'futuro' {
    if (ev.concluido) return 'concluido';
    const hojeIso = new Date().toISOString().slice(0, 10);
    const dataEv = ev.dataPrevista.slice(0, 10);
    if (dataEv < hojeIso) return 'atrasado';
    if (dataEv === hojeIso) return 'hoje';
    return 'futuro';
  }

  proximoEventoId(): string | null {
    const proximo = this.calendario.find((ev) => !ev.concluido);
    return proximo ? proximo.id : null;
  }

  carregarPlanta(id: string): void {
    this.isLoading = true;
    this.agroTechService.getPlantaById(id).subscribe({
      next: (data) => {
        this.planta = data;
        this.populateFormData(data);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar detalhes da planta:', err);
        this.isLoading = false;
        this.router.navigate(['/plantas']);
      }
    });
  }

  getTextoPadraoEtapa(passo: number): string {
    const padroes: Record<number, string> = {
      1: 'Seleção de sementes sadias e viáveis, higienização sanitária e hidratação/escarificação prévia para quebra de dormência e rápida germinação.',
      2: 'Escolha dos recipientes iniciais (sementeiras de células ou copinhos descartáveis de 200ml furados) e preparo de substrato leve, fofo, aerado e bem drenado.',
      3: '1. Faça pequenos furos no substrato com profundidade equivalente a 2 a 3 vezes o tamanho da semente (aprox. 0,5 cm a 1 cm).\n2. Deposite de 2 a 3 sementes por célula ou copinho no centro para garantir a germinação.\n3. Cubra suavemente as sementes com uma fina camada de substrato leve peneirado.\n4. Umedeça o substrato borrifando água delicadamente para não deslocar a semente do lugar.\n5. Mantenha em local iluminado porém protegido de sol forte direto.',
      4: '1. Mantenha a sementeira levemente úmida borrifando água delicadamente, sem encharcar.\n2. Forneça de 2 a 3 horas de sol fraco da manhã para fortalecer o caule e evitar estiolamento.\n3. Faça o desbaste (thinning): corte a muda mais fraca com tesoura fina se nascerem duas no mesmo copinho.',
      5: '1. Exponha a sementeira ao sol pleno gradualmente por 2 a 3 dias antes do transplante para aclimatar a muda.\n2. Escolha o vaso definitivo (mínimo 5 a 10 litros) com furos de drenagem no fundo.\n3. Coloque camada de drenagem no fundo (2 a 3 cm de argila expandida/isopor) e cubra com manta geotêxtil (Bidim).\n4. Preencha o vaso definitivo com solo fértil rico em matéria orgânica.',
      6: '1. Aguarde a muda apresentar de 4 a 6 folhas verdadeiras (8 a 10 cm de altura).\n2. Pressione delicadamente as laterais do copinho para retirar o torrão intacto sem puxar pelo caule.\n3. Desfaça suavemente as raízes enoveladas no fundo com os dedos para estimular a expansão no novo solo.\n4. Plante no berço do vaso definitivo, cubra até a base do caule e regue no final da tarde.',
      7: '1. Realize regas regulares diretamente na base da planta no início da manhã, evitando molhar as folhas.\n2. Faça a poda de beliscamento (apical/topping) nos brotos superiores para multiplicar os ramos laterais.\n3. Adube a cada 15 a 20 dias com adubo orgânico (húmus de minhoca ou esterco curtido).',
      8: '1. Para ervas e temperos aromáticos, remova os botões florais assim que surgirem para concentrar os óleos essenciais nas folhas.\n2. Acompanhe a mudança de cor e maturação ideal dos frutos no pé.\n3. Efetue a colheita nas primeiras horas da manhã utilizando tesoura limpa e higienizada com álcool 70%.'
    };
    return padroes[passo] || '';
  }

  populateFormData(p: Planta): void {
    this.formData = {
      apelidoLote: p.apelidoLote,
      especieId: p.especieId,
      nomePopular: p.especieNomePopular,
      nomeCientifico: p.especieNomeCientifico || '',
      imagemUrl: p.imagemUrl || '',
      umidadeSoloMin: p.umidadeSoloMin ?? null,
      umidadeSoloMax: p.umidadeSoloMax ?? null,
      temperaturaMin: p.temperaturaMin ?? null,
      temperaturaMax: p.temperaturaMax ?? null,
      instrucoesManejo: p.instrucoesManejo || '',
      passo1PreparoSemente: p.passo1PreparoSemente || this.getTextoPadraoEtapa(1),
      passo2PreparoSolo: p.passo2PreparoSolo || this.getTextoPadraoEtapa(2),
      passo3SemeaduraGerminacao: p.passo3SemeaduraGerminacao || this.getTextoPadraoEtapa(3),
      passo4CuidadosBrotoDesbaste: p.passo4CuidadosBrotoDesbaste || p.passo4TransplanteMudas || this.getTextoPadraoEtapa(4),
      passo5AclimatizacaoVasoDefinitivo: p.passo5AclimatizacaoVasoDefinitivo || p.passo5CrescimentoManejo || this.getTextoPadraoEtapa(5),
      passo6TransplanteMudas: p.passo6TransplanteMudas || this.getTextoPadraoEtapa(6),
      passo7NutricaoPoda: p.passo7NutricaoPoda || this.getTextoPadraoEtapa(7),
      passo8FloracaoColheita: p.passo8FloracaoColheita || p.passo6FloracaoColheita || this.getTextoPadraoEtapa(8),
      cuidadosDiaADia: p.cuidadosDiaADia || '',
      fonteDadosScraping: p.fonteDadosScraping || '',
      isGeradoPorIa: !!p.isGeradoPorIa
    };
    // Limpa preview ao recarregar
    this.imagemPreviewUrl = null;
  }

  // ─── Upload Manual de Imagem ──────────────────────────────────────────────────

  abrirSeletorImagem(): void {
    this.fileInput.nativeElement.click();
  }

  onImagemSelecionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagemPreviewUrl = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);

    this.isUploadingImagem = true;
    this.cdr.detectChanges();

    this.agroTechService.uploadEspecieImagem(file).subscribe({
      next: (res) => {
        this.formData.imagemUrl = res.url;
        this.isUploadingImagem = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[PlantaDetalhesComponent] Erro no upload da imagem:', err);
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
    // Durante edição: preview local tem prioridade
    if (this.imagemPreviewUrl) return this.imagemPreviewUrl;
    // Senão: URL persistida
    const url = this.isEditing ? this.formData.imagemUrl : (this.planta?.imagemUrl || '');
    if (!url) return null;
    return url.startsWith('http') ? url : `${this.apiBaseUrl}${url}`;
  }

  // ─── Edição ───────────────────────────────────────────────────────────────────

  iniciarEdicao(): void {
    this.isEditing = true;
    if (this.planta) {
      this.populateFormData(this.planta);
    }
    this.cdr.detectChanges();
  }

  cancelarEdicao(): void {
    this.isEditing = false;
    this.imagemPreviewUrl = null;
    if (this.planta) {
      this.populateFormData(this.planta);
    }
    this.cdr.detectChanges();
  }

  salvar(): void {
    if (this.isSaving || !this.plantaId) return;

    if (!this.formData.apelidoLote.trim()) {
      alert('Por favor, informe o apelido/lote da planta.');
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
      instrucoesManejo: this.formData.instrucoesManejo,
      passo1PreparoSemente: this.formData.passo1PreparoSemente,
      passo2PreparoSolo: this.formData.passo2PreparoSolo,
      passo3SemeaduraGerminacao: this.formData.passo3SemeaduraGerminacao,
      passo4CuidadosBrotoDesbaste: this.formData.passo4CuidadosBrotoDesbaste,
      passo5AclimatizacaoVasoDefinitivo: this.formData.passo5AclimatizacaoVasoDefinitivo,
      passo6TransplanteMudas: this.formData.passo6TransplanteMudas,
      passo7NutricaoPoda: this.formData.passo7NutricaoPoda,
      passo8FloracaoColheita: this.formData.passo8FloracaoColheita,
      cuidadosDiaADia: this.formData.cuidadosDiaADia
    };

    const targetEspecieId = this.formData.especieId;

    if (targetEspecieId) {
      this.agroTechService.updateEspecie(targetEspecieId, especieDados).subscribe({
        next: () => this.executarAtualizacaoPlanta(),
        error: () => this.executarAtualizacaoPlanta()
      });
    } else {
      this.executarAtualizacaoPlanta();
    }
  }

  private executarAtualizacaoPlanta(): void {
    if (!this.plantaId) return;

    const payload = {
      apelidoLote: this.formData.apelidoLote,
      especieId: this.formData.especieId
    };

    this.agroTechService.updatePlanta(this.plantaId, payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isEditing = false;
        this.imagemPreviewUrl = null;
        this.carregarPlanta(this.plantaId!);
      },
      error: (err) => {
        console.error('Erro ao atualizar planta:', err);
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── Exclusão ─────────────────────────────────────────────────────────────────

  confirmarExclusao(): void {
    this.showConfirmDelete = true;
    this.cdr.detectChanges();
  }

  cancelarExclusao(): void {
    this.showConfirmDelete = false;
    this.cdr.detectChanges();
  }

  executarExclusao(): void {
    if (!this.plantaId) return;

    this.showConfirmDelete = false;
    this.agroTechService.deletePlanta(this.plantaId).subscribe({
      next: () => {
        this.router.navigate(['/plantas']);
      },
      error: (err) => {
        console.error('Erro ao excluir planta:', err);
        alert('Ocorreu um erro ao excluir a planta.');
      }
    });
  }

  voltar(): void {
    this.router.navigate(['/plantas']);
  }

  abrirEtapa(passo: number): void {
    if (this.plantaId) {
      this.router.navigate(['/plantas', this.plantaId, 'etapa', passo]);
    }
  }

  readonly resumosEtapas: Record<number, string> = {
    1: 'Seleção de sementes sadias e viáveis, higienização sanitária e hidratação/escarificação prévia para quebra de dormência e rápida germinação.',
    2: 'Escolha dos recipientes iniciais (sementeiras de células ou copinhos descartáveis de 200ml furados) e preparo de substrato leve, fofo, aerado e bem drenado.',
    3: 'Semeadura dos grãos nos recipientes na profundidade correta (2 a 3x o tamanho da semente), umedecimento delicado com borrifador e iluminação indireta para despertar a semente.',
    4: 'Manutenção diária da umidade na sementeira, iluminação solar da manhã (2-3h), desbaste (thinning) das mudas sobressalentes e acompanhamento do desenvolvimento inicial.',
    5: 'Exposição gradual da muda ao sol pleno (aclimatação) e montagem do vaso definitivo (mínimo 5-10L) com camada de drenagem (argila expandida/isopor + manta) e solo fértil.',
    6: 'Retirada da muda com o torrão intacto ao atingir 4 a 6 folhas verdadeiras e descompactação suave das raízes enoveladas no fundo para enraizamento profundo no novo solo.',
    7: 'Manejo contínuo com regas na base do solo no início da manhã, adubação orgânica periódica a cada 15-30 dias e poda de beliscamento apical (topping) para multiplicar ramos.',
    8: 'Acompanhamento da fase reprodutiva, manejo de flores (remocão em plantas aromáticas para prolongar sabor) e colheita no ponto ideal de maturação com tesoura higienizada em álcool 70%.'
  };

  getResumoEtapa(passo: number): string {
    return this.resumosEtapas[passo] || '';
  }

  // ─── Gamificação — Trilha do Cultivador (RN-009-12/13/15) ────────────────────

  private readonly gamificacaoHub = inject(GamificacaoHubService);
  private readonly toastService = inject(GamificacaoToastService);

  gamificacao: GamificacaoPlantaResponse | null = null;
  isLoadingGamificacao = true;
  isGerandoGamificacao = false;
  isAvancandoEstagio = false;
  isRegistrandoTransplante = false;
  isArquivando = false;

  /** Conquistas conhecidas da planta (§5.7 carga inicial / §5.2 pós-geração). */
  conquistas: ConquistaItem[] = [];
  conquistasGeradas = false;

  /** Destaque animado "+X XP" após transição confirmada (RN-010/014). */
  xpDestaque: number | null = null;
  selosRecentes: SeloConquistado[] = [];

  /** Fallback do multiplicador pós-transição até o próximo GET §5.1. */
  ultimoMultiplicador: number | null = null;

  /** Janela de verificação exibida após "Registrar transplante" (RN-018). */
  transplanteInfo: TransplanteResponse | null = null;

  /** Fallback quando o §5.1 ainda não traz statusVida: arquivamento confirmado nesta sessão (RN-021). */
  arquivadaNestaSessao = false;

  /** statusVida persistente — §5.1 quando disponível, fallback da sessão. */
  get statusVidaAtual(): StatusVida {
    return this.gamificacao?.statusVida ?? (this.arquivadaNestaSessao ? 'Arquivada' : 'Ativa');
  }

  /** Planta arquivada (RN-021): badge "Histórico" + ações bloqueadas. */
  get estaArquivada(): boolean {
    return this.statusVidaAtual === 'Arquivada';
  }

  /** Multiplicador de streak — §5.1; fallback do response de transição (§5.3). */
  get multiplicadorExibido(): number | null {
    return this.gamificacao?.multiplicadorStreak ?? this.ultimoMultiplicador;
  }

  erroGamificacao = '';

  showConfirmTransplante = false;
  showConfirmArquivar = false;
  observacaoTransplante = '';

  /** "Agora" reativo para a contagem regressiva do stepper (atualizado a cada 60s). */
  agora = new Date();
  private contagemInterval: ReturnType<typeof setInterval> | null = null;

  readonly ORDEM_ESTAGIOS = ORDEM_ESTAGIOS;
  readonly ESTAGIO_VISUAL = ESTAGIO_VISUAL;
  readonly TIER_VISUAL = TIER_VISUAL;
  readonly ORDEM_TIERS = ORDEM_TIERS;

  carregarGamificacao(): void {
    if (!this.plantaId) return;
    this.isLoadingGamificacao = this.gamificacao === null;
    this.agroTechService.getGamificacaoPlanta(this.plantaId).subscribe({
      next: (res) => {
        this.gamificacao = res;
        this.isLoadingGamificacao = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar gamificação da planta:', err);
        this.isLoadingGamificacao = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Item da trilha em que a planta está agora. */
  get estagioAtualItem(): TrilhaEstagioItem | null {
    const trilha = this.gamificacao?.trilha;
    if (!trilha || trilha.length === 0) return null;
    return trilha.find((t) => t.atual) ?? trilha[trilha.length - 1] ?? null;
  }

  get estagioAtualLabel(): string {
    const item = this.estagioAtualItem;
    return item ? (ESTAGIO_VISUAL[item.estagio]?.label ?? item.estagio) : '';
  }

  get estagioAtualIcone(): string {
    const item = this.estagioAtualItem;
    return item ? (ESTAGIO_VISUAL[item.estagio]?.icone ?? 'fa-seedling') : 'fa-seedling';
  }

  /** Trilha na ordem canônica Semente → Colheita. */
  get trilhaOrdenada(): TrilhaEstagioItem[] {
    const trilha = this.gamificacao?.trilha ?? [];
    return [...trilha].sort((a, b) => ORDEM_ESTAGIOS.indexOf(a.estagio) - ORDEM_ESTAGIOS.indexOf(b.estagio));
  }

  estagioLabel(estagio: EstagioCiclo): string {
    return ESTAGIO_VISUAL[estagio]?.label ?? estagio;
  }

  estagioIcone(estagio: EstagioCiclo): string {
    return ESTAGIO_VISUAL[estagio]?.icone ?? 'fa-circle';
  }

  readonly metricasSaude: { chave: 'umidadeSolo' | 'temperatura' | 'luminosidade'; label: string; icone: string }[] = [
    { chave: 'umidadeSolo', label: 'Umidade Solo', icone: 'fa-droplet' },
    { chave: 'temperatura', label: 'Temperatura', icone: 'fa-temperature-half' },
    { chave: 'luminosidade', label: 'Luminosidade', icone: 'fa-sun' }
  ];

  /** true/false conforme naFaixaIdeal; null quando métrica ausente (sem sensor). */
  metricaNaFaixa(chave: 'umidadeSolo' | 'temperatura' | 'luminosidade'): boolean | null {
    const metrica = this.gamificacao?.saudePorMetrica?.[chave];
    return metrica ? metrica.naFaixaIdeal : null;
  }

  /** Largura proporcional da barra: posição do valorAtual dentro da faixa, saturada fora (§5.1). */
  larguraSaude(chave: 'umidadeSolo' | 'temperatura' | 'luminosidade'): number {
    const metrica = this.gamificacao?.saudePorMetrica?.[chave];
    return metrica ? larguraBarraSaude(metrica) : 0;
  }

  private static readonly UNIDADES_SAUDE: Record<'umidadeSolo' | 'temperatura' | 'luminosidade', string> = {
    umidadeSolo: '%',
    temperatura: '°C',
    luminosidade: ' lux'
  };

  /** Valor atual formatado com unidade (ex.: "55%", "24,5°C", "1500 lux"). */
  valorSaudeTexto(chave: 'umidadeSolo' | 'temperatura' | 'luminosidade'): string {
    const metrica = this.gamificacao?.saudePorMetrica?.[chave];
    if (!metrica || typeof metrica.valorAtual !== 'number') return '—';
    const valor = metrica.valorAtual.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `${valor}${PlantaDetalhesComponent.UNIDADES_SAUDE[chave]}`;
  }

  /** Faixa ideal formatada para tooltip (ex.: "Faixa ideal: 40 – 70"). */
  faixaSaudeTexto(chave: 'umidadeSolo' | 'temperatura' | 'luminosidade'): string {
    const metrica = this.gamificacao?.saudePorMetrica?.[chave];
    if (!metrica?.faixaIdeal) return '';
    const min = metrica.faixaIdeal.min.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    const max = metrica.faixaIdeal.max.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `Faixa ideal: ${min} – ${max}`;
  }

  concluidasCount(): number {
    return this.conquistas.filter((c) => c.status === 'Concluida').length;
  }

  get proximoEstagioLabel(): string {
    const atual = this.estagioAtualItem;
    if (!atual) return '';
    const proximo = proximoEstagio(atual.estagio);
    return proximo ? (ESTAGIO_VISUAL[proximo]?.label ?? proximo) : '';
  }

  /** Botão "Avançar estágio" habilitado só quando podeTransicionarEm já passou (RN-010). */
  podeAvancar(item: TrilhaEstagioItem): boolean {
    return !!item.atual && transicaoDisponivel(item.podeTransicionarEm, this.agora);
  }

  contagemDoEstagio(item: TrilhaEstagioItem): string {
    return formatarContagemRegressiva(item.podeTransicionarEm, this.agora);
  }

  /** Tooltip do botão "Avançar estágio" com o tempo restante quando bloqueado. */
  get tituloBotaoAvancar(): string {
    const item = this.estagioAtualItem;
    if (!item) return '';
    return this.podeAvancar(item) ? '' : this.contagemDoEstagio(item);
  }

  private iniciarContagemRegressiva(): void {
    if (this.contagemInterval) return;
    this.contagemInterval = setInterval(() => {
      this.agora = new Date();
      this.cdr.detectChanges();
    }, 60_000);
  }

  avancarEstagio(): void {
    const atual = this.estagioAtualItem;
    if (!this.plantaId || !atual || !this.podeAvancar(atual) || this.isAvancandoEstagio) return;

    const destino = proximoEstagio(atual.estagio);
    if (!destino) return;

    this.isAvancandoEstagio = true;
    this.cdr.detectChanges();

    this.agroTechService.avancarEstagio(this.plantaId, destino).subscribe({
      next: (res: TransicaoEstagioResponse) => {
        this.isAvancandoEstagio = false;
        this.xpDestaque = res.xpGanho.total;
        this.selosRecentes = res.selosConquistados || [];
        this.ultimoMultiplicador = res.xpGanho.multiplicadorStreak ?? null;
        // Fallback de tempo real: atualiza XP local com o response da própria ação
        if (this.gamificacao) {
          this.gamificacao = { ...this.gamificacao, xpTotal: this.gamificacao.xpTotal + res.xpGanho.total };
        }
        setTimeout(() => {
          this.xpDestaque = null;
          this.cdr.detectChanges();
        }, 4000);
        this.carregarGamificacao();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao avançar estágio:', err);
        this.isAvancandoEstagio = false;
        this.erroGamificacao = this.mensagemDeErro(err, 'Não foi possível avançar o estágio.');
        setTimeout(() => {
          this.erroGamificacao = '';
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      }
    });
  }

  /** Lista completa de conquistas da planta (§5.7) — alimenta o grid do painel. */
  carregarConquistas(): void {
    if (!this.plantaId) return;
    this.agroTechService.getConquistasDaPlanta(this.plantaId).subscribe({
      next: (lista: ConquistaLista[]) => {
        if (lista && lista.length > 0) {
          this.conquistas = lista;
          this.conquistasGeradas = true;
        }
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        // Silencioso: lista vazia = gamificação ainda não gerada (estado vazio cuida do UX)
        console.error('Erro ao carregar conquistas da planta:', err);
      }
    });
  }

  /** Conquistas agrupadas por tier na ordem fixa (UI_SPEC §6), respeitando o filtro ativo. */
  conquistasAgrupadas(): { tier: TierConquista; itens: ConquistaItem[] }[] {
    const filtro = this.tierFiltro();
    return ORDEM_TIERS
      .filter((tier) => !filtro || tier === filtro)
      .map((tier) => ({ tier, itens: this.conquistas.filter((c) => c.tier === tier) }))
      .filter((grupo) => grupo.itens.length > 0);
  }

  /** Estado vazio (sem conquistas geradas) — mensagem + botão "Gerar agora" (UI_SPEC §4.5). */
  get semConquistasGeradas(): boolean {
    return this.conquistasGeradas && this.conquistas.length === 0;
  }

  gerarAgora(): void {
    if (!this.plantaId || this.isGerandoGamificacao) return;
    this.isGerandoGamificacao = true;
    this.erroGamificacao = '';
    this.cdr.detectChanges();

    this.agroTechService.gerarGamificacao(this.plantaId).subscribe({
      next: (res: GerarGamificacaoResponse) => {
        this.conquistas = res.conquistas || [];
        this.conquistasGeradas = true;
        this.isGerandoGamificacao = false;
        this.carregarGamificacao();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.isGerandoGamificacao = false;
        if (err.status === 409) {
          // ERR-GAM-005: gamificação já gerada — recarrega o grid existente via GET §5.7 + aviso informativo
          this.conquistasGeradas = true;
          this.toastService.exibirFeedback('Gamificação já gerada — exibindo conquistas existentes');
          this.carregarConquistas();
          this.carregarGamificacao();
        } else {
          this.erroGamificacao = this.mensagemDeErro(err, 'Falha ao gerar a gamificação.');
          setTimeout(() => {
            this.erroGamificacao = '';
            this.cdr.detectChanges();
          }, 5000);
        }
        this.cdr.detectChanges();
      }
    });
  }

  abrirConfirmTransplante(): void {
    if (this.estaArquivada) return;
    this.observacaoTransplante = '';
    this.showConfirmTransplante = true;
    this.cdr.detectChanges();
  }

  cancelarTransplante(): void {
    this.showConfirmTransplante = false;
    this.cdr.detectChanges();
  }

  executarTransplante(): void {
    if (!this.plantaId || this.isRegistrandoTransplante) return;
    this.isRegistrandoTransplante = true;
    this.cdr.detectChanges();

    const observacao = this.observacaoTransplante.trim();
    this.agroTechService.registrarTransplante(this.plantaId, observacao.length > 0 ? observacao : undefined).subscribe({
      next: (res: TransplanteResponse) => {
        this.isRegistrandoTransplante = false;
        this.showConfirmTransplante = false;
        this.transplanteInfo = res;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao registrar transplante:', err);
        this.isRegistrandoTransplante = false;
        this.erroGamificacao = this.mensagemDeErro(err, 'Não foi possível registrar o transplante.');
        this.showConfirmTransplante = false;
        setTimeout(() => {
          this.erroGamificacao = '';
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      }
    });
  }

  abrirConfirmArquivar(): void {
    if (this.estaArquivada) return;
    this.showConfirmArquivar = true;
    this.cdr.detectChanges();
  }

  cancelarArquivar(): void {
    this.showConfirmArquivar = false;
    this.cdr.detectChanges();
  }

  executarArquivar(): void {
    if (!this.plantaId || this.isArquivando) return;
    this.isArquivando = true;
    this.cdr.detectChanges();

    this.agroTechService.arquivarPlanta(this.plantaId).subscribe({
      next: () => {
        this.isArquivando = false;
        this.showConfirmArquivar = false;
        this.arquivadaNestaSessao = true;
        this.carregarGamificacao();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao arquivar planta:', err);
        this.isArquivando = false;
        this.erroGamificacao = this.mensagemDeErro(err, 'Não foi possível arquivar a planta.');
        this.showConfirmArquivar = false;
        setTimeout(() => {
          this.erroGamificacao = '';
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      }
    });
  }

  dataHora(iso?: string | null): string {
    return formatarDataHora(iso);
  }

  /** Mensagem amigável a partir do envelope de erro do contrato (ERR-GAM-001..007). */
  private mensagemDeErro(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 404) return 'Planta não encontrada.';
    if (err.status === 0) return 'Não foi possível conectar ao servidor.';
    return extrairMensagemErro(err.error, fallback);
  }

  // ─── Modo Manual de Saúde (CR-001 — RN-023/024/025) ──────────────────────────

  isRegistrandoCuidado = false;

  /** 7 indicadores (hoje → -6) normalizados para os dots do painel. */
  dotsCuidados(): boolean[] {
    return normalizarDiasCuidados(this.gamificacao?.cuidadosSemana);
  }

  /** Rótulo do dia pelo índice (0 = hoje) para tooltip dos dots. */
  nomeDiaCuidado(indice: number): string {
    return rotuloDiaCuidado(indice);
  }

  /** Cuidado de hoje já confirmado (§5.1 dias[0]=true) ⇒ botão desabilitado. */
  get cuidadoHojeFeito(): boolean {
    return cuidadoHojeRegistrado(this.gamificacao?.cuidadosSemana);
  }

  /** POST §5.8 — idempotente por dia; atualiza estado local + feedbacks no padrão existente. */
  registrarCuidado(): void {
    if (!this.plantaId || this.isRegistrandoCuidado || this.cuidadoHojeFeito) return;

    this.isRegistrandoCuidado = true;
    this.cdr.detectChanges();

    this.agroTechService.registrarCuidado(this.plantaId).subscribe({
      next: (res) => {
        this.isRegistrandoCuidado = false;
        if (res.registrouHoje) {
          if (this.gamificacao) {
            this.gamificacao = {
              ...this.gamificacao,
              xpTotal: this.gamificacao.xpTotal + res.xpGanho.total,
              streakDiasAtual: res.streakDiasAtual,
              multiplicadorStreak: res.xpGanho.multiplicadorStreak ?? this.gamificacao.multiplicadorStreak,
              cuidadosSemana: this.cuidadosSemanaAposRegistroHoje(this.gamificacao.cuidadosSemana)
            };
          }
          if (res.xpGanho.total > 0) {
            this.xpDestaque = res.xpGanho.total;
            setTimeout(() => {
              this.xpDestaque = null;
              this.cdr.detectChanges();
            }, 4000);
          }
          this.toastService.exibirFeedback(`+${res.xpGanho.total} XP`);
        } else {
          this.toastService.exibirFeedback('Cuidado do dia já registrado');
        }
        // Re-sincroniza com a fonte da verdade (streak/dias vindos do §5.1)
        this.carregarGamificacao();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao registrar cuidado manual:', err);
        this.isRegistrandoCuidado = false;
        // ERR-GAM-007 (planta com sensor) / ERR-GAM-004 (arquivada) via envelope do contrato
        this.erroGamificacao = this.mensagemDeErro(err, 'Não foi possível registrar o cuidado.');
        setTimeout(() => {
          this.erroGamificacao = '';
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      }
    });
  }

  /** CuidadosSemana imutável com hoje marcado (feedback imediato até o GET §5.1 re-sincronizar). */
  private cuidadosSemanaAposRegistroHoje(atual?: CuidadosSemana | null): CuidadosSemana {
    const dias = normalizarDiasCuidados(atual);
    const jaMarcado = dias[0];
    dias[0] = true;
    return { confirmados: (atual?.confirmados ?? 0) + (jaMarcado ? 0 : 1), dias };
  }

  // ─── Layout: seções colapsáveis + filtro de tier (redesign UI) ───────────────

  /** Estado dos acordeões (trilha e conquistas abertas; saúde e ações fechadas). */
  readonly secoesAbertas = signal<Record<SecaoGamificacao, boolean>>({
    trilha: true,
    conquistas: true,
    saude: false,
    acoes: false
  });

  /** Filtro ativo do painel de conquistas; null = todos os tiers. */
  readonly tierFiltro = signal<TierConquista | null>(null);

  alternarSecao(secao: SecaoGamificacao): void {
    this.secoesAbertas.update((estado) => ({ ...estado, [secao]: !estado[secao] }));
    this.cdr.detectChanges();
  }

  alternarFiltroTier(tier: TierConquista | null): void {
    this.tierFiltro.set(this.tierFiltro() === tier ? null : tier);
    this.cdr.detectChanges();
  }

  contagemPorTier(tier: TierConquista): number {
    return this.conquistas.filter((c) => c.tier === tier).length;
  }
}
