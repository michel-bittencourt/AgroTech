import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AgroTechService } from '../../services/agrotech.service';
import { ConquistaProgresso } from '../../models/agrotech.models';
import { ConquistaItem, JardimGamificacaoResponse, ORDEM_TIERS, TIER_VISUAL, TierConquista } from '../../models/gamificacao.models';

/** Página dedicada /conquistas — XP do Cultivador, coleções (§6.1) e catálogo clássico (/conquistas). */
@Component({
  selector: 'app-conquistas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './conquistas.component.html',
  styleUrls: ['./conquistas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConquistasComponent {
  private readonly agroTechService = inject(AgroTechService);
  private readonly router = inject(Router);

  readonly tierVisual = TIER_VISUAL;
  readonly ordemTiers = ORDEM_TIERS;

  /** Gamificação do jardim (XP + coleções, contrato §6.1). */
  readonly jardim = signal<JardimGamificacaoResponse | null>(null);
  readonly isLoading = signal(true);

  /** Catálogo clássico de conquistas (endpoint /conquistas). */
  readonly catalogo = signal<ConquistaProgresso[]>([]);

  /** Filtro ativo por tier das conquistas de coleção; null = todos. */
  readonly tierFiltro = signal<TierConquista | null>(null);

  constructor() {
    this.carregar();
  }

  /** Coleções (bloqueadas + concluídas) respeitando o filtro de tier. */
  colecoesFiltradas(): ConquistaItem[] {
    const filtro = this.tierFiltro();
    const colecoes = this.jardim()?.conquistasColecao ?? [];
    return filtro ? colecoes.filter((c) => c.tier === filtro) : colecoes;
  }

  contagemPorTier(tier: TierConquista): number {
    return (this.jardim()?.conquistasColecao ?? []).filter((c) => c.tier === tier).length;
  }

  alternarFiltroTier(tier: TierConquista | null): void {
    this.tierFiltro.set(this.tierFiltro() === tier ? null : tier);
  }

  concluidasColecao(): number {
    return (this.jardim()?.conquistasColecao ?? []).filter((c) => c.status === 'Concluida').length;
  }

  catalogoConquistadas(): number {
    return this.catalogo().filter((c) => c.conquistada).length;
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

  /** Sem coleções geradas e catálogo clássico vazio → empty state com CTA. */
  get jardimVazio(): boolean {
    return (this.jardim()?.conquistasColecao?.length ?? 0) === 0 && this.catalogo().length === 0;
  }

  irParaJardim(): void {
    this.router.navigate(['/plantas']);
  }

  private carregar(): void {
    this.agroTechService.getGamificacaoJardim().subscribe({
      next: (res) => {
        this.jardim.set(res);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.warn('[Conquistas] Gamificação do jardim indisponível:', err);
        this.isLoading.set(false);
      }
    });

    this.agroTechService.getConquistas().subscribe({
      next: (lista) => this.catalogo.set(lista ?? []),
      error: (err: HttpErrorResponse) => {
        console.warn('[Conquistas] Catálogo clássico indisponível:', err);
        this.catalogo.set([]);
      }
    });
  }
}
