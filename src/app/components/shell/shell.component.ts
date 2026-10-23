import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgroTechService } from '../../services/agrotech.service';
import { GamificacaoHubService } from '../../services/gamificacao-hub.service';
import { ToastConquistaComponent } from '../toast-conquista/toast-conquista.component';
import { JardimGamificacaoResponse } from '../../models/gamificacao.models';

/** Subitem de menu: destino de navegação (rota) ou ação de sistema (ex.: modal Servidor API). */
interface ItemMenu {
  rotulo: string;
  rota: string;
  acao?: () => void;
}

/** Grupo de destinos por domínio do sistema. */
interface GrupoMenu {
  id: string;
  rotulo: string;
  icone: string;
  itens: ItemMenu[];
}

const CHAVE_SIDEBAR_COLAPSADA = 'agrotech-sidebar-collapsed';
const CHAVE_SIDEBAR_GRUPOS = 'agrotech-sidebar-grupos';

/** Mapeia a URL atual para o título exibido na topbar do shell. */
function tituloPorRota(url: string): string {
  if (url === '/plantas/nova') return 'Nova Planta';
  if (url === '/plantas/existente') return 'Cadastrar Planta Existente';
  if (/^\/plantas\/[^/]+\/avaliacao/.test(url)) return 'Registrar Estado Físico';
  if (/^\/plantas\/[^/]+\/intervencao/.test(url)) return 'Registrar Intervenção';
  if (/^\/plantas\/[^/]+\/assistente/.test(url)) return 'Assistente IA';
  if (url === '/conquistas') return 'Conquistas';
  if (/^\/plantas\/[^/]+\/etapa/.test(url)) return 'Etapa do Cultivo';
  if (/^\/plantas\/[^/]+/.test(url)) return 'Detalhe da Planta';
  return 'Meu Jardim';
}

/** Shell principal do app: sidebar colapsável com grupos + topbar + router-outlet + toast global. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, ToastConquistaComponent],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly agroTechService = inject(AgroTechService);
  protected readonly hub = inject(GamificacaoHubService);

  /** Estado de abertura do modal "Servidor API" (configuração de sistema, movida do /plantas). */
  protected readonly modalApiAberto = signal(false);
  protected inputApiUrl = '';

  protected readonly gruposMenu: GrupoMenu[] = [
    {
      id: 'jardim',
      rotulo: 'Jardim',
      icone: 'fa-seedling',
      itens: [
        { rotulo: 'Visão geral', rota: '/plantas' },
        { rotulo: 'Nova planta', rota: '/plantas/nova' },
        { rotulo: 'Cadastrar planta existente', rota: '/plantas/existente' },
        { rotulo: 'Conquistas', rota: '/conquistas' }
      ]
    },
    {
      id: 'config',
      rotulo: 'Configurações',
      icone: 'fa-gear',
      itens: [
        { rotulo: 'Servidor API', rota: '', acao: () => this.abrirModalApi() }
      ]
    }
  ];

  /** Sidebar colapsada (rail de ícones) — persistida no localStorage. */
  protected readonly colapsada = signal<boolean>(this.lerPreferenciaColapso());

  /** Estado aberto/fechado dos grupos — persistido no localStorage. */
  protected readonly gruposAbertos = signal<Record<string, boolean>>(this.lerPreferenciaGrupos());

  /** Sidebar aberta em mobile (off-canvas). */
  protected readonly mobileAberta = signal(false);

  /** Título da página atual, derivado da rota. */
  protected readonly tituloAtual = signal(tituloPorRota(this.router.url));

  /** Gamificação do jardim para o rodapé da sidebar; null = esconder card sem quebrar. */
  protected readonly jardim = signal<JardimGamificacaoResponse | null>(null);

  constructor() {
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((evento) => {
        this.tituloAtual.set(tituloPorRota(evento.urlAfterRedirects));
        this.mobileAberta.set(false);
        this.abrirGrupoDaRota(evento.urlAfterRedirects);
      });

    // Conquista desbloqueada → XP do rodapé atualiza em tempo real (RN-022)
    effect(() => {
      if (this.hub.ultimaConquista()) {
        this.carregarJardim();
      }
    });
  }

  ngOnInit(): void {
    this.hub.iniciar();
    this.carregarJardim();
    this.abrirGrupoDaRota(this.router.url);
  }

  ngOnDestroy(): void {
    // Serviços root vivem para o app todo — nada a liberar aqui
  }

  // ─── Grupos do menu ─────────────────────────────────────────────────────────

  protected grupoAberto(id: string): boolean {
    return this.gruposAbertos()[id] === true;
  }

  /**
   * Clique num grupo: no rail colapsado, expande a sidebar e abre o grupo;
   * na sidebar expandida, alterna aberto/fechado.
   */
  protected clicarGrupo(id: string): void {
    if (this.colapsada()) {
      this.alternarColapsada();
      this.alternarGrupo(id, true);
      return;
    }
    this.alternarGrupo(id, !this.grupoAberto(id));
  }

  private alternarGrupo(id: string, aberto: boolean): void {
    this.gruposAbertos.update((estado) => ({ ...estado, [id]: aberto }));
    this.persistirGrupos();
  }

  /** Grupo do item ativo abre automaticamente ao navegar. */
  private abrirGrupoDaRota(url: string): void {
    const caminho = url.split('?')[0];
    if (caminho === '/plantas' || caminho.startsWith('/plantas/') || caminho === '/conquistas') {
      if (!this.grupoAberto('jardim')) {
        this.alternarGrupo('jardim', true);
      }
    }
  }

  /** Item ativo quando o caminho atual coincide exatamente com a rota do item. */
  protected itemEstaAtivo(item: ItemMenu): boolean {
    return this.router.url.split('?')[0] === item.rota;
  }

  // ─── Colapso da sidebar ─────────────────────────────────────────────────────

  /** Alterna colapso da sidebar e persiste a preferência. */
  protected alternarColapsada(): void {
    const novo = !this.colapsada();
    this.colapsada.set(novo);
    try {
      localStorage.setItem(CHAVE_SIDEBAR_COLAPSADA, String(novo));
    } catch {
      // localStorage indisponível — preferência não persiste, sem quebrar
    }
  }

  protected abrirMobile(): void {
    this.mobileAberta.set(true);
  }

  protected fecharMobile(): void {
    this.mobileAberta.set(false);
  }

  // ─── Modal Servidor API (lógica preservada do plantas.component) ───────────

  protected abrirModalApi(): void {
    this.inputApiUrl = this.agroTechService.apiUrl;
    this.modalApiAberto.set(true);
  }

  protected fecharModalApi(): void {
    this.modalApiAberto.set(false);
  }

  /**
   * Grava a URL da API no localStorage (fonte única do getter AgroTechService.apiUrl)
   * e recarrega o app para aplicar em TODAS as telas e no hub SignalR.
   * Configuração estrutural e rara — reload garante consistência total.
   */
  protected salvarEConectarApi(): void {
    if (!this.inputApiUrl.trim()) {
      localStorage.removeItem('AGROTECH_API_URL');
      this.fecharModalApi();
      window.location.reload();
      return;
    }

    let cleanUrl = this.inputApiUrl.trim().replace(/\/$/, '');
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl += '/api';
    }

    localStorage.setItem('AGROTECH_API_URL', cleanUrl);
    this.fecharModalApi();
    window.location.reload();
  }

  // ─── Rodapé: XP do Cultivador ───────────────────────────────────────────────

  protected colecaoConcluidas(): number {
    return (this.jardim()?.conquistasColecao ?? []).filter((c) => c.status === 'Concluida').length;
  }

  /** XP compacto para o rail colapsado (ex.: "1,2k"). */
  protected xpCompacto(): string {
    const xp = this.jardim()?.xpTotalCultivador ?? 0;
    if (xp >= 1000) {
      const mil = (xp / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      return `${mil}k`;
    }
    return String(xp);
  }

  private carregarJardim(): void {
    this.agroTechService.getGamificacaoJardim().subscribe({
      next: (res) => this.jardim.set(res),
      error: (err: HttpErrorResponse) => {
        // Falha silenciosa: card do rodapé simplesmente não aparece
        console.warn('[Shell] Gamificação do jardim indisponível para a sidebar:', err);
      }
    });
  }

  private lerPreferenciaColapso(): boolean {
    try {
      return localStorage.getItem(CHAVE_SIDEBAR_COLAPSADA) === 'true';
    } catch {
      return false;
    }
  }

  private lerPreferenciaGrupos(): Record<string, boolean> {
    try {
      const bruto = localStorage.getItem(CHAVE_SIDEBAR_GRUPOS);
      if (bruto) {
        return JSON.parse(bruto) as Record<string, boolean>;
      }
    } catch {
      // JSON inválido/indisponível — usa default
    }
    return { jardim: true, config: false };
  }

  private persistirGrupos(): void {
    try {
      localStorage.setItem(CHAVE_SIDEBAR_GRUPOS, JSON.stringify(this.gruposAbertos()));
    } catch {
      // localStorage indisponível — preferência não persiste, sem quebrar
    }
  }
}
