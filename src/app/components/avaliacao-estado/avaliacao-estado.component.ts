import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgroTechService } from '../../services/agrotech.service';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';
import {
  ChecklistEstadoFisico,
  PARTES_CHECKLIST,
  PartePlanta,
  checklistComToggle,
  checklistTemSelecao
} from '../../models/recuperacao.models';

/** Página dedicada — Registrar estado físico (UI_SPEC §4.2 acordeão + §7.2 do contrato, RN-028/029/036). */
@Component({
  selector: 'app-avaliacao-estado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './avaliacao-estado.component.html',
  styleUrls: ['./avaliacao-estado.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvaliacaoEstadoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agroTechService = inject(AgroTechService);
  private readonly toastService = inject(GamificacaoToastService);

  protected readonly PARTES_CHECKLIST = PARTES_CHECKLIST;

  protected plantaId: string | null = null;
  protected apelidoPlanta = '';
  protected readonly checklist = signal<ChecklistEstadoFisico>({ folhas: [], caule: [], raizes: [], pragas: [] });
  protected observacoesLivres = '';
  protected readonly fotos = signal<string[]>([]);
  protected readonly fotosCarregando = signal(false);

  protected readonly salvando = signal(false);
  protected readonly erroChecklist = signal('');

  ngOnInit(): void {
    this.plantaId = this.route.snapshot.paramMap.get('id');
    this.agroTechService.getPlantaById(this.plantaId ?? '').subscribe({
      next: (planta) => (this.apelidoPlanta = planta.apelidoLote),
      error: () => (this.apelidoPlanta = '')
    });
  }

  protected parteSelecionada(parte: PartePlanta, valor: string): boolean {
    return this.checklist()[parte].includes(valor);
  }

  protected alternarSintoma(parte: PartePlanta, valor: string): void {
    this.erroChecklist.set('');
    this.checklist.set(checklistComToggle(this.checklist(), parte, valor));
  }

  protected abrirSeletorFotos(): void {
    document.getElementById('fotos-avaliacao-input')?.click();
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

  protected salvar(): void {
    if (this.salvando() || !this.plantaId) {
      return;
    }
    if (!checklistTemSelecao(this.checklist())) {
      this.erroChecklist.set('Informe ao menos uma parte da planta no checklist (folhas, caule, raízes ou pragas).');
      return;
    }

    this.salvando.set(true);
    const fotosDataUrl = this.fotos();

    this.agroTechService
      .registrarAvaliacao(this.plantaId, {
        checklist: this.checklist(),
        observacoesLivres: this.observacoesLivres.trim() || undefined,
        fotos: fotosDataUrl.length > 0 ? fotosDataUrl : undefined
      })
      .subscribe({
        next: (resposta) => {
          this.salvando.set(false);
          // RN-036: IA indisponível preserva os dados brutos — aviso discreto, registro não bloqueado
          if (resposta.headers.get('X-Ia-Indisponivel') === 'true') {
            this.toastService.exibirFeedback('IA indisponível — registro salvo com suas descrições');
          } else {
            this.toastService.exibirFeedback('Estado físico registrado');
          }
          void this.router.navigate(['/plantas', this.plantaId!]);
        },
        error: (err) => {
          this.salvando.set(false);
          // RN-036: 503 com registro preservado no backend — trata como salvo com aviso
          if (err.status === 503) {
            this.toastService.exibirFeedback('IA indisponível — registro salvo com suas descrições');
            void this.router.navigate(['/plantas', this.plantaId!]);
            return;
          }
          this.toastService.exibirFeedback('Não foi possível registrar o estado físico. Tente novamente.');
        }
      });
  }
}
