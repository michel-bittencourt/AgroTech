import { Injectable, signal } from '@angular/core';
import { ConquistaDesbloqueadaEvento } from '../models/gamificacao.models';
import { RecomendacaoIaEvento } from '../models/recuperacao.models';

/** Duração do toast de conquista em tela (RN-022 — some sozinho após ~5s). */
const DURACAO_TOAST_MS = 5000;

/** Duração do feedback de XP de ação manual ("+X XP"). */
const DURACAO_FEEDBACK_MS = 4000;

@Injectable({ providedIn: 'root' })
export class GamificacaoToastService {
  private timeoutToast: ReturnType<typeof setTimeout> | null = null;
  private timeoutFeedback: ReturnType<typeof setTimeout> | null = null;
  private timeoutRecomendacao: ReturnType<typeof setTimeout> | null = null;

  /** Última conquista recebida (SignalR ou fallback de ação) exibida no toast global. */
  readonly toastAtual = signal<ConquistaDesbloqueadaEvento | null>(null);

  /** Feedback textual de ação manual (ex.: "+35 XP (bônus)"). */
  readonly feedbackAcao = signal<string | null>(null);

  /** Toast discreto "Nova recomendação da IA" (RN-034 — mesmo padrão do toast de conquista). */
  readonly recomendacaoAtual = signal<RecomendacaoIaEvento | null>(null);

  exibirConquista(evento: ConquistaDesbloqueadaEvento): void {
    if (!evento || !evento.conquista) {
      return;
    }
    if (this.timeoutToast) {
      clearTimeout(this.timeoutToast);
    }
    this.toastAtual.set(evento);
    this.timeoutToast = setTimeout(() => this.ocultarConquista(), DURACAO_TOAST_MS);
  }

  exibirFeedback(mensagem: string): void {
    if (!mensagem) {
      return;
    }
    if (this.timeoutFeedback) {
      clearTimeout(this.timeoutFeedback);
    }
    this.feedbackAcao.set(mensagem);
    this.timeoutFeedback = setTimeout(() => this.feedbackAcao.set(null), DURACAO_FEEDBACK_MS);
  }

  exibirRecomendacao(evento: RecomendacaoIaEvento): void {
    if (!evento || !evento.recomendacao) {
      return;
    }
    if (this.timeoutRecomendacao) {
      clearTimeout(this.timeoutRecomendacao);
    }
    this.recomendacaoAtual.set(evento);
    this.timeoutRecomendacao = setTimeout(() => this.ocultarRecomendacao(), DURACAO_TOAST_MS);
  }

  ocultarRecomendacao(): void {
    if (this.timeoutRecomendacao) {
      clearTimeout(this.timeoutRecomendacao);
      this.timeoutRecomendacao = null;
    }
    this.recomendacaoAtual.set(null);
  }

  ocultarConquista(): void {
    if (this.timeoutToast) {
      clearTimeout(this.timeoutToast);
      this.timeoutToast = null;
    }
    this.toastAtual.set(null);
  }

  ocultarFeedback(): void {
    if (this.timeoutFeedback) {
      clearTimeout(this.timeoutFeedback);
      this.timeoutFeedback = null;
    }
    this.feedbackAcao.set(null);
  }
}
