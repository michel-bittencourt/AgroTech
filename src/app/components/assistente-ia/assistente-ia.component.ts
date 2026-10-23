import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgroTechService } from '../../services/agrotech.service';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';
import { extrairMensagemErro, formatarDataHora } from '../../models/gamificacao.models';
import {
  CONTEXTO_RECOMENDACAO_LABEL,
  ConsultaAssistenteResponse,
  FontesConsideradas,
  RecomendacaoIaItem
} from '../../models/recuperacao.models';

/** Mensagem do chat do assistente (histórico da sessão — §5.6). */
interface MensagemChat {
  autor: 'usuario' | 'ia';
  texto: string;
  fontes?: FontesConsideradas;
  geradaEm?: string;
}

/** Página auxiliar — Consulta ao Assistente IA (UI_SPEC §5.6, RN-035/036). */
@Component({
  selector: 'app-assistente-ia',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './assistente-ia.component.html',
  styleUrls: ['./assistente-ia.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistenteIaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agroTechService = inject(AgroTechService);
  private readonly toastService = inject(GamificacaoToastService);

  protected readonly CONTEXTO_LABEL = CONTEXTO_RECOMENDACAO_LABEL;

  /** Chaves fixas do painel de fontes (contrato §7.7.1 — FontesConsideradas). */
  protected readonly CHAVES_FONTES: (keyof FontesConsideradas)[] = [
    'telemetria',
    'avaliacoesEstado',
    'intervencoes',
    'planoRecuperacao',
    'perfilEspecie'
  ];

  protected plantaId: string | null = null;
  protected apelidoPlanta = '';
  protected pergunta = '';

  protected readonly mensagens = signal<MensagemChat[]>([]);
  protected readonly consultando = signal(false);
  protected readonly iaIndisponivel = signal(false);
  protected readonly erroGeral = signal('');
  protected readonly recomendacoes = signal<RecomendacaoIaItem[]>([]);
  protected readonly recomendacoesIndisponiveis = signal(false);

  ngOnInit(): void {
    this.plantaId = this.route.snapshot.paramMap.get('id');
    if (!this.plantaId) {
      void this.router.navigate(['/plantas']);
      return;
    }
    this.agroTechService.getPlantaById(this.plantaId).subscribe({
      next: (planta) => (this.apelidoPlanta = planta.apelidoLote),
      error: () => (this.apelidoPlanta = '')
    });
    this.carregarRecomendacoes();
  }

  protected carregarRecomendacoes(): void {
    if (!this.plantaId) {
      return;
    }
    this.recomendacoesIndisponiveis.set(false);
    this.agroTechService.getRecomendacoesIa(this.plantaId).subscribe({
      next: (lista) => this.recomendacoes.set(lista || []),
      error: (err) => {
        // ERR-IA-001 (503): estado "IA indisponível" com retry — RN-036
        if (err.status === 503) {
          this.recomendacoesIndisponiveis.set(true);
        }
        console.error('[AssistenteIa] Erro ao carregar recomendações:', err);
      }
    });
  }

  protected perguntar(): void {
    if (this.consultando() || !this.plantaId) {
      return;
    }
    const texto = this.pergunta.trim();
    if (!texto) {
      return;
    }

    this.iaIndisponivel.set(false);
    this.erroGeral.set('');
    this.mensagens.update((atual) => [...atual, { autor: 'usuario', texto }]);
    this.pergunta = '';
    this.consultando.set(true);

    this.agroTechService.consultarAssistente(this.plantaId, { pergunta: texto }).subscribe({
      next: (resposta: ConsultaAssistenteResponse) => {
        this.consultando.set(false);
        this.mensagens.update((atual) => [
          ...atual,
          { autor: 'ia', texto: resposta.resposta, fontes: resposta.fontesConsideradas, geradaEm: resposta.geradaEm }
        ]);
      },
      error: (err) => {
        this.consultando.set(false);
        // ERR-IA-001 (503): dados preservados, alertas padrão ativos — estado com retry (RN-036)
        if (err.status === 503) {
          this.iaIndisponivel.set(true);
          this.toastService.exibirFeedback('IA indisponível — seus dados estão salvos e os alertas padrão seguem ativos');
          return;
        }
        this.erroGeral.set(extrairMensagemErro(err.error, 'Não foi possível consultar o assistente. Tente novamente.'));
      }
    });
  }

  /** Repete a última pergunta após indisponibilidade (botão "Tentar novamente" — RN-036). */
  protected tentarNovamente(): void {
    const ultimaPergunta = [...this.mensagens()].reverse().find((m) => m.autor === 'usuario')?.texto ?? '';
    if (ultimaPergunta) {
      // Remove o eco pendente e repete o envio
      this.mensagens.update((atual) => (atual[atual.length - 1]?.autor === 'usuario' ? atual.slice(0, -1) : atual));
      this.pergunta = ultimaPergunta;
    }
    this.iaIndisponivel.set(false);
    this.perguntar();
  }

  protected fonteAtiva(fontes: FontesConsideradas | undefined, chave: keyof FontesConsideradas): boolean {
    if (!fontes) {
      return false;
    }
    const valor = fontes[chave];
    return typeof valor === 'number' ? valor > 0 : valor === true;
  }

  /** Fontes consideradas pela resposta mais recente da IA (painel lateral — RN-035). */
  protected fontesUltimaResposta(): FontesConsideradas | undefined {
    const mensagens = this.mensagens();
    for (let i = mensagens.length - 1; i >= 0; i--) {
      if (mensagens[i].autor === 'ia') {
        return mensagens[i].fontes;
      }
    }
    return undefined;
  }

  protected rotuloFonte(fontes: FontesConsideradas | undefined, chave: keyof FontesConsideradas): string {
    if (!fontes) {
      return '';
    }
    const valor = fontes[chave];
    const rotulos: Record<keyof FontesConsideradas, string> = {
      telemetria: 'Telemetria',
      avaliacoesEstado: 'Avaliações de estado',
      intervencoes: 'Intervenções',
      planoRecuperacao: 'Plano de recuperação',
      perfilEspecie: 'Perfil da espécie'
    };
    const rotulo = rotulos[chave];
    return typeof valor === 'number' ? `${rotulo} (${valor})` : rotulo;
  }

  protected dataHora(iso?: string | null): string {
    return formatarDataHora(iso);
  }
}
