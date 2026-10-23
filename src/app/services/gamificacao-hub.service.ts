import { inject, Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { AgroTechService } from './agrotech.service';
import { GamificacaoToastService } from './gamificacao-toast.service';
import { ConquistaDesbloqueadaEvento } from '../models/gamificacao.models';
import { RecomendacaoIaEvento } from '../models/recuperacao.models';

/**
 * Cliente SignalR do hub /hubs/telemetria para o evento ConquistaDesbloqueada (RN-022).
 * Conexão defensiva: qualquer falha é apenas logada — o app segue funcionando
 * com o fallback de atualização local via responses das próprias ações.
 */
@Injectable({ providedIn: 'root' })
export class GamificacaoHubService {
  private readonly toastService = inject(GamificacaoToastService);
  private readonly agroTechService = inject(AgroTechService);
  private conexao: HubConnection | null = null;

  /** Último evento de conquista recebido (consumido via effect nas telas). */
  readonly ultimaConquista = signal<ConquistaDesbloqueadaEvento | null>(null);

  /** Última recomendação IA recebida em tempo real (RN-034 — consumido via effect no detalhe da planta). */
  readonly ultimaRecomendacao = signal<RecomendacaoIaEvento | null>(null);

  /** Status da conexão com o hub (informativo). */
  readonly conectado = signal(false);

  /** Idempotente: apenas a primeira chamada cria a conexão. */
  iniciar(): void {
    if (this.conexao || typeof window === 'undefined') {
      return;
    }
    try {
      const base = this.agroTechService.apiUrl.replace(/\/api\/?$/, '');
      const conexao = new HubConnectionBuilder()
        .withUrl(`${base}/hubs/telemetria`)
        .withAutomaticReconnect()
        .build();

      conexao.on('ConquistaDesbloqueada', (evento: ConquistaDesbloqueadaEvento) => {
        if (!evento || !evento.conquista) {
          return;
        }
        this.ultimaConquista.set(evento);
        this.toastService.exibirConquista(evento);
      });

      conexao.on('RecomendacaoIa', (evento: RecomendacaoIaEvento) => {
        if (!evento || !evento.recomendacao) {
          return;
        }
        this.ultimaRecomendacao.set(evento);
        this.toastService.exibirRecomendacao(evento);
      });

      conexao.onreconnected(() => this.conectado.set(true));
      conexao.onclose(() => this.conectado.set(false));

      conexao
        .start()
        .then(() => this.conectado.set(true))
        .catch((erro: unknown) =>
          console.warn('[GamificacaoHub] Hub indisponível — seguindo sem tempo real (fallback local ativo).', erro)
        );

      this.conexao = conexao;
    } catch (erro) {
      console.warn('[GamificacaoHub] Falha ao preparar conexão SignalR — seguindo sem tempo real.', erro);
    }
  }

  parar(): void {
    if (!this.conexao) {
      return;
    }
    try {
      void this.conexao.stop();
    } catch (erro) {
      console.warn('[GamificacaoHub] Falha ao encerrar conexão SignalR.', erro);
    }
    this.conexao = null;
    this.conectado.set(false);
  }
}
