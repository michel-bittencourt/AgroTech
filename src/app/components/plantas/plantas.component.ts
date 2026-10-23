import { ChangeDetectorRef, Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AgroTechService } from '../../services/agrotech.service';
import { Planta, NotificacaoItem, ConquistaProgresso } from '../../models/agrotech.models';
import { JardimGamificacaoResponse, extrairMensagemErro, TierConquista, TIER_VISUAL, ConquistaItem } from '../../models/gamificacao.models';
import { GamificacaoHubService } from '../../services/gamificacao-hub.service';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';

@Component({
  selector: 'app-plantas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './plantas.component.html',
  styleUrls: ['./plantas.component.scss']
})
export class PlantasComponent implements OnInit {
  plantas: Planta[] = [];
  isLoading = true;

  // Sino de notificações
  notificacoes: NotificacaoItem[] = [];
  mostrarNotificacoes = false;

  constructor(
    private agroTechService: AgroTechService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private gamificacaoHub: GamificacaoHubService,
    private toastService: GamificacaoToastService
  ) {
    // Evento SignalR → atualiza XP/conquistas do jardim em tempo real (RN-022)
    effect(() => {
      const evento = this.gamificacaoHub.ultimaConquista();
      if (evento) {
        this.carregarJardim();
      }
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.carregarPlantas();
    this.carregarNotificacoes();
    this.carregarJardim();
    this.gamificacaoHub.iniciar();
  }

  get atrasadasCount(): number {
    return this.notificacoes.filter((n) => n.status !== 'proximo').length;
  }

  carregarNotificacoes(): void {
    this.agroTechService.getNotificacoes().subscribe({
      next: (data) => {
        this.notificacoes = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar notificações:', err);
      }
    });
  }

  alternarNotificacoes(): void {
    this.mostrarNotificacoes = !this.mostrarNotificacoes;
    this.cdr.detectChanges();
  }

  irParaNotificacao(n: NotificacaoItem): void {
    this.mostrarNotificacoes = false;
    this.verDetalhes(n.plantaId);
  }

  carregarPlantas(): void {
    this.isLoading = true;
    this.agroTechService.getPlantas().subscribe({
      next: (data) => {
        console.log('[PlantasComponent] 🌿 Plantas recebidas:', data);
        this.plantas = data || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar plantas:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cadastrar(): void {
    this.router.navigate(['/plantas/nova']);
  }

  verDetalhes(id: string): void {
    this.router.navigate(['/plantas', id]);
  }

  // ─── Gamificação do Jardim + confirmação de manejo (RN-009-14) ──────────────

  jardim: JardimGamificacaoResponse | null = null;
  isLoadingJardim = true;
  manejoEmAndamento: string | null = null;

  carregarJardim(): void {
    this.agroTechService.getGamificacaoJardim().subscribe({
      next: (res) => {
        this.jardim = res;
        this.isLoadingJardim = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar gamificação do jardim:', err);
        this.isLoadingJardim = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Botão "Confirmar ação" nos alertas de manejo (RN-013) — POST /manejo com alertaAtivo.id (§3.1/§5.4). */
  confirmarManejo(planta: Planta): void {
    const alerta = planta.alertaAtivo;
    if (!alerta || alerta.id == null || this.manejoEmAndamento) {
      console.warn('[PlantasComponent] Alerta sem identificação — POST /manejo exige alertaId (contrato §3.1/§5.4).');
      return;
    }
    if (planta.statusVida === 'Arquivada') {
      return; // Planta do histórico: sem ações de manejo (RN-021)
    }

    this.manejoEmAndamento = planta.id;
    this.cdr.detectChanges();

    this.agroTechService.confirmarManejo(planta.id, alerta.id).subscribe({
      next: (res) => {
        this.manejoEmAndamento = null;
        planta.alertaAtivo = null;
        // Feedback "+X XP (bônus)" dentro da janela / "+X XP" fora (RN-013)
        this.toastService.exibirFeedback(res.dentroDaJanela ? `+${res.xpGanho.total} XP (bônus)` : `+${res.xpGanho.total} XP`);
        // Fallback de tempo real: atualiza o XP do jardim com o response da própria ação
        if (this.jardim) {
          this.jardim = { ...this.jardim, xpTotalCultivador: this.jardim.xpTotalCultivador + res.xpGanho.total };
        }
        this.carregarJardim();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao confirmar manejo:', err);
        this.manejoEmAndamento = null;
        const fallback = err.status === 422 ? 'Este alerta já foi resolvido.' : 'Não foi possível confirmar a ação.';
        this.toastService.exibirFeedback(extrairMensagemErro(err.error, fallback));
        this.cdr.detectChanges();
      }
    });
  }
  painelColecaoAberto = false;
  conquistas: ConquistaProgresso[] = [];
  isLoadingConquistas = false;

  alternarPainelColecao(): void {
    this.painelColecaoAberto = !this.painelColecaoAberto;
    if (this.painelColecaoAberto && this.conquistas.length === 0) {
      this.carregarConquistasClassicas();
    }
    this.cdr.detectChanges();
  }

  colecaoConcluidasCount(): number {
    return this.jardim?.conquistasColecao?.filter((c) => c.status === 'Concluida').length ?? 0;
  }

  get conquistadasCount(): number {
    return this.conquistas.filter((c) => c.conquistada).length;
  }

  percentualProgresso(c: ConquistaItem): number {
    if (!c.progresso || c.progresso.necessario <= 0) return 0;
    return Math.min(100, (c.progresso.atual / c.progresso.necessario) * 100);
  }

  tierCor(tier: TierConquista): string {
    return TIER_VISUAL[tier]?.cor ?? '#6b7580';
  }

  tierIcone(tier: TierConquista): string {
    return TIER_VISUAL[tier]?.icone ?? 'fa-medal';
  }

  tierLabel(tier: TierConquista): string {
    return TIER_VISUAL[tier]?.label ?? tier;
  }

  carregarConquistasClassicas(): void {
    this.isLoadingConquistas = true;
    this.agroTechService.getConquistas().subscribe({
      next: (data) => {
        this.conquistas = data || [];
        this.isLoadingConquistas = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar conquistas:', err);
        this.isLoadingConquistas = false;
        this.cdr.detectChanges();
      }
    });
  }
}
