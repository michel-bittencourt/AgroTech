import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AgroTechService } from '../../services/agrotech.service';
import { Especie } from '../../models/agrotech.models';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';
import { extrairMensagemErro, ESTAGIO_VISUAL, ORDEM_ESTAGIOS, EstagioCiclo } from '../../models/gamificacao.models';
import {
  ChecklistEstadoFisico,
  DispositivoItem,
  ORDEM_TIPOS_INTERVENCAO,
  PARTES_CHECKLIST,
  PartePlanta,
  RegistrarIntervencaoRequest,
  TIPO_INTERVENCAO_VISUAL,
  TipoIntervencao,
  checklistComToggle,
  checklistTemSelecao,
  dataEventoValida
} from '../../models/recuperacao.models';

/** Linha do repetidor de histórico inicial (UI_SPEC §5.2 seção 3). */
interface IntervencaoForm {
  tipo: TipoIntervencao;
  dataEvento: string;
  dataAproximada: boolean;
  detalhesLivres: string;
}

function intervencaoVazia(): IntervencaoForm {
  return { tipo: 'Poda', dataEvento: '', dataAproximada: false, detalhesLivres: '' };
}

/** Tela 4 — Cadastro de Planta Existente (UI_SPEC §5, RN-026..033, RN-036). */
@Component({
  selector: 'app-planta-existente-cadastro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './planta-existente-cadastro.component.html',
  styleUrls: ['./planta-existente-cadastro.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlantaExistenteCadastroComponent implements OnInit, OnDestroy {
  private readonly agroTechService = inject(AgroTechService);
  private readonly router = inject(Router);
  private readonly toastService = inject(GamificacaoToastService);

  // ─── Constantes visuais expostas ao template ────────────────────────────────
  protected readonly ORDEM_ESTAGIOS = ORDEM_ESTAGIOS;
  protected readonly ESTAGIO_VISUAL = ESTAGIO_VISUAL;
  protected readonly ORDEM_TIPOS_INTERVENCAO = ORDEM_TIPOS_INTERVENCAO;
  protected readonly TIPO_INTERVENCAO_VISUAL = TIPO_INTERVENCAO_VISUAL;
  protected readonly PARTES_CHECKLIST = PARTES_CHECKLIST;

  // ─── Seção 1: Identificação ─────────────────────────────────────────────────
  protected apelidoLote = '';
  protected especieBusca = '';
  protected especieSelecionada: Especie | null = null;
  protected estagioAtual: EstagioCiclo = 'Vegetativo';
  protected dispositivoId: string | null = null;

  protected readonly especiesCatalogo = signal<Especie[]>([]);
  protected readonly sugestoesAbertas = signal(false);
  protected readonly dispositivos = signal<DispositivoItem[]>([]);

  // ─── Seção 2: Estado físico atual ───────────────────────────────────────────
  protected readonly checklist = signal<ChecklistEstadoFisico>({ folhas: [], caule: [], raizes: [], pragas: [] });
  protected observacoesLivres = '';
  protected readonly fotos = signal<string[]>([]);
  protected readonly fotosCarregando = signal(false);

  // ─── Seção 3: Histórico inicial (opcional) ──────────────────────────────────
  protected readonly intervencoes = signal<IntervencaoForm[]>([]);

  // ─── Estados da tela (UI_SPEC §5.5) ─────────────────────────────────────────
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal('');
  protected readonly errosCampo = signal<Record<string, string>>({});

  protected hojeIso = this.dataHojeIso();
  private intervaloDia: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.carregarCatalogoEspecies();
    this.carregarDispositivos();
    // Limite "data não futura" (ERR-REC-003) acompanha viradas de dia com a tela aberta
    this.intervaloDia = setInterval(() => (this.hojeIso = this.dataHojeIso()), 60_000);
  }

  ngOnDestroy(): void {
    if (this.intervaloDia) {
      clearInterval(this.intervaloDia);
    }
  }

  private dataHojeIso(): string {
    const hoje = new Date();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `${hoje.getFullYear()}-${mm}-${dd}`;
  }

  private carregarCatalogoEspecies(): void {
    this.agroTechService.getEspecies().subscribe({
      next: (especies) => this.especiesCatalogo.set(especies || []),
      error: (err) => console.error('[PlantaExistente] Erro ao carregar catálogo de espécies:', err)
    });
  }

  private carregarDispositivos(): void {
    this.agroTechService.getDispositivosAtivos().subscribe({
      next: (lista) => this.dispositivos.set(lista || []),
      // Tolerante: vínculo de dispositivo é opcional (RN-021) — lista vazia não bloqueia o cadastro
      error: (err) => console.warn('[PlantaExistente] Dispositivos indisponíveis — vínculo segue opcional:', err)
    });
  }

  // ─── Autocomplete de espécie (UI_SPEC §5.3 — espécie do catálogo, fluxo §3 cria) ──

  protected get sugestoesFiltradas(): Especie[] {
    const termo = this.especieBusca.trim().toLowerCase();
    const catalogo = this.especiesCatalogo();
    if (!termo) {
      return catalogo;
    }
    return catalogo.filter(
      (e) =>
        e.nomePopular.toLowerCase().includes(termo) ||
        (e.nomeCientifico ?? '').toLowerCase().includes(termo)
    );
  }

  protected selecionarEspecie(especie: Especie): void {
    this.especieSelecionada = especie;
    this.especieBusca = especie.nomePopular;
    this.sugestoesAbertas.set(false);
  }

  protected limparEspecie(): void {
    this.especieSelecionada = null;
    this.especieBusca = '';
    this.sugestoesAbertas.set(false);
  }

  // ─── Checklist e fotos (RN-028/029) ─────────────────────────────────────────

  protected parteSelecionada(parte: PartePlanta, valor: string): boolean {
    return this.checklist()[parte].includes(valor);
  }

  protected alternarSintoma(parte: PartePlanta, valor: string): void {
    this.checklist.set(checklistComToggle(this.checklist(), parte, valor));
  }

  protected abrirSeletorFotos(): void {
    document.getElementById('fotos-existente-input')?.click();
  }

  protected onFotosSelecionadas(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    this.fotosCarregando.set(true);
    const arquivos = Array.from(input.files);
    let pendentes = arquivos.length;
    for (const arquivo of arquivos) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.fotos.update((atual) => [...atual, e.target?.result as string]);
        pendentes--;
        if (pendentes === 0) {
          this.fotosCarregando.set(false);
        }
      };
      reader.onerror = () => {
        pendentes--;
        if (pendentes === 0) {
          this.fotosCarregando.set(false);
        }
      };
      reader.readAsDataURL(arquivo);
    }
    input.value = '';
  }

  protected removerFoto(indice: number): void {
    this.fotos.update((atual) => atual.filter((_, i) => i !== indice));
  }

  // ─── Repetidor de intervenções (RN-030/031) ─────────────────────────────────

  protected adicionarIntervencao(): void {
    this.intervencoes.update((atual) => [...atual, intervencaoVazia()]);
  }

  protected removerIntervencao(indice: number): void {
    this.intervencoes.update((atual) => atual.filter((_, i) => i !== indice));
  }

  protected temTransplanteNoHistorico(): boolean {
    return this.intervencoes().some((i) => i.tipo === 'Transplante');
  }

  // ─── Validação e salvamento (UI_SPEC §5.3/§5.5) ─────────────────────────────

  protected salvar(): void {
    if (this.salvando()) {
      return;
    }

    const erros: Record<string, string> = {};
    if (!this.apelidoLote.trim()) {
      erros['apelidoLote'] = 'Informe o apelido do vaso/planta.';
    } else if (this.apelidoLote.trim().length > 100) {
      erros['apelidoLote'] = 'Máximo de 100 caracteres.';
    }

    if (!this.especieSelecionada) {
      erros['especie'] = 'Selecione a espécie do catálogo.';
    }

    if (!checklistTemSelecao(this.checklist())) {
      erros['checklist'] = 'Informe ao menos uma parte da planta no checklist (folhas, caule, raízes ou pragas).';
    }

    this.intervencoes().forEach((iv, i) => {
      if (!dataEventoValida(iv.dataEvento)) {
        erros[`intervencao-${i}`] = 'A data da intervenção não pode ser no futuro.';
      } else if (iv.tipo === 'Outro' && !iv.detalhesLivres.trim()) {
        erros[`intervencao-${i}`] = 'Detalhamento livre obrigatório para o tipo "Outro".';
      }
    });

    this.errosCampo.set(erros);
    if (Object.keys(erros).length > 0) {
      return;
    }

    this.salvando.set(true);
    this.erroGeral.set('');

    this.agroTechService
      .cadastrarPlantaExistente({
        apelidoLote: this.apelidoLote.trim(),
        especieId: this.especieSelecionada!.id,
        estagioAtual: this.estagioAtual,
        dispositivoId: this.dispositivoId
      })
      .subscribe({
        next: (planta) => this.salvarRegistrosAuxiliares(planta.id),
        error: (err) => {
          this.salvando.set(false);
          this.erroGeral.set(extrairMensagemErro(err.error, 'Não foi possível cadastrar a planta.'));
        }
      });
  }

  /** Persiste estado físico (§7.2) e histórico inicial (§7.4) e navega para o detalhe (UI_SPEC §5.5). */
  private salvarRegistrosAuxiliares(plantaId: string): void {
    const fotosDataUrl = this.fotos();
    this.agroTechService
      .registrarAvaliacao(plantaId, {
        checklist: this.checklist(),
        observacoesLivres: this.observacoesLivres.trim() || undefined,
        fotos: fotosDataUrl.length > 0 ? fotosDataUrl : undefined
      })
      .subscribe({
        next: (resposta) => {
          // RN-036: IA indisponível não bloqueia o registro — aviso discreto com os dados preservados
          if (resposta.headers.get('X-Ia-Indisponivel') === 'true') {
            this.toastService.exibirFeedback('IA indisponível — registro salvo com suas descrições');
          }
          this.salvarHistoricoInicial(plantaId);
        },
        error: (err) => {
          console.error('[PlantaExistente] Erro ao registrar estado físico:', err);
          this.toastService.exibirFeedback('Planta cadastrada, mas o estado físico não foi salvo');
          this.salvarHistoricoInicial(plantaId);
        }
      });
  }

  private salvarHistoricoInicial(plantaId: string): void {
    const pedidos: RegistrarIntervencaoRequest[] = this.intervencoes()
      .filter((iv) => dataEventoValida(iv.dataEvento))
      .map((iv) => ({
        tipo: iv.tipo,
        dataEvento: iv.dataEvento,
        dataAproximada: iv.dataAproximada,
        detalhesLivres: iv.detalhesLivres.trim() || undefined
      }));

    if (pedidos.length === 0) {
      this.finalizarCadastro(plantaId, null);
      return;
    }

    // Sequencial preserva a ordem do histórico e identifica o transplante para oferecer o plano (RN-032/033)
    let transplanteId: string | null = null;
    const salvarProximo = (indice: number): void => {
      if (indice >= pedidos.length) {
        this.finalizarCadastro(plantaId, transplanteId);
        return;
      }
      this.agroTechService.registrarIntervencao(plantaId, pedidos[indice]).subscribe({
        next: (criada) => {
          if (criada.tipo === 'Transplante') {
            transplanteId = criada.id;
          }
          salvarProximo(indice + 1);
        },
        error: (err) => {
          console.error('[PlantaExistente] Erro ao registrar intervenção do histórico:', err);
          salvarProximo(indice + 1);
        }
      });
    };
    salvarProximo(0);
  }

  private finalizarCadastro(plantaId: string, transplanteId: string | null): void {
    this.salvando.set(false);
    this.toastService.exibirFeedback('Planta cadastrada!');
    // Transplante no histórico → detalhe abre o acordeão de intervenções oferecendo o plano (RN-032/033)
    const extras = transplanteId ? { queryParams: { abrirPlano: transplanteId } } : undefined;
    void this.router.navigate(['/plantas', plantaId], extras);
  }
}
