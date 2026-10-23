import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgroTechService } from '../../services/agrotech.service';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';
import { extrairMensagemErro } from '../../models/gamificacao.models';
import {
  ORDEM_TIPOS_INTERVENCAO,
  TIPO_INTERVENCAO_VISUAL,
  TipoIntervencao,
  dataEventoValida
} from '../../models/recuperacao.models';

/** Página dedicada — Registrar intervenção de manejo (UI_SPEC §4.2 acordeão + §7.4 do contrato, RN-030/031/032). */
@Component({
  selector: 'app-intervencao-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './intervencao-registro.component.html',
  styleUrls: ['./intervencao-registro.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntervencaoRegistroComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agroTechService = inject(AgroTechService);
  private readonly toastService = inject(GamificacaoToastService);

  protected readonly ORDEM_TIPOS_INTERVENCAO = ORDEM_TIPOS_INTERVENCAO;
  protected readonly TIPO_INTERVENCAO_VISUAL = TIPO_INTERVENCAO_VISUAL;

  protected plantaId: string | null = null;
  protected apelidoPlanta = '';
  protected tipo: TipoIntervencao = 'Poda';
  protected dataEvento = '';
  protected dataAproximada = false;
  protected detalhesLivres = '';

  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal('');
  protected readonly erroCampo = signal('');

  protected hojeIso = '';
  private intervaloDia: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.plantaId = this.route.snapshot.paramMap.get('id');
    this.hojeIso = this.dataHojeIso();
    // Limite "data não futura" (ERR-REC-003) acompanha viradas de dia com a tela aberta
    this.intervaloDia = setInterval(() => (this.hojeIso = this.dataHojeIso()), 60_000);
    this.agroTechService.getPlantaById(this.plantaId ?? '').subscribe({
      next: (planta) => (this.apelidoPlanta = planta.apelidoLote),
      error: () => (this.apelidoPlanta = '')
    });
  }

  private dataHojeIso(): string {
    const hoje = new Date();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `${hoje.getFullYear()}-${mm}-${dd}`;
  }

  protected salvar(): void {
    if (this.salvando() || !this.plantaId) {
      return;
    }

    if (!dataEventoValida(this.dataEvento)) {
      this.erroCampo.set('A data da intervenção não pode ser no futuro.');
      return;
    }
    if (this.tipo === 'Outro' && !this.detalhesLivres.trim()) {
      this.erroCampo.set('Detalhamento livre obrigatório para o tipo "Outro".');
      return;
    }
    this.erroCampo.set('');
    this.erroGeral.set('');
    this.salvando.set(true);

    this.agroTechService
      .registrarIntervencao(this.plantaId, {
        tipo: this.tipo,
        dataEvento: this.dataEvento,
        dataAproximada: this.dataAproximada,
        detalhesLivres: this.detalhesLivres.trim() || undefined
      })
      .subscribe({
        next: (criada) => {
          this.salvando.set(false);
          this.toastService.exibirFeedback('Intervenção registrada');
          // Transplante → detalhe abre o acordeão oferecendo o plano de recuperação (RN-032/033)
          const extras = criada.tipo === 'Transplante' ? { queryParams: { abrirPlano: criada.id } } : undefined;
          void this.router.navigate(['/plantas', this.plantaId!], extras);
        },
        error: (err) => {
          this.salvando.set(false);
          this.erroGeral.set(extrairMensagemErro(err.error, 'Não foi possível registrar a intervenção.'));
        }
      });
  }
}
