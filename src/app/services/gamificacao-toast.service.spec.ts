import { GamificacaoToastService } from './gamificacao-toast.service';
import { ConquistaDesbloqueadaEvento } from '../models/gamificacao.models';
import { RecomendacaoIaEvento } from '../models/recuperacao.models';

function eventoFake(titulo: string): ConquistaDesbloqueadaEvento {
  return {
    plantaId: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
    plantaApelido: 'Vaso 01 - Mudas de Manjericão',
    conquista: {
      id: 'c9d8e7f6-a5b4-4321-9876-543210fedcba',
      titulo,
      tier: 'Medio',
      tipo: 'Saude',
      xpRecompensa: 50
    },
    xpTotalCultivador: 1240,
    desbloqueadoEm: '2026-10-04T15:30:00Z'
  };
}

describe('GamificacaoToastService', () => {
  let service: GamificacaoToastService;

  beforeEach(() => {
    service = new GamificacaoToastService();
  });

  afterEach(() => {
    service.ocultarConquista();
    service.ocultarFeedback();
  });

  it('exibe o evento de conquista recebido (RN-022)', () => {
    const ev = eventoFake('7 dias na faixa ideal');
    service.exibirConquista(ev);
    expect(service.toastAtual()).toEqual(ev);
  });

  it('substitui a conquista anterior quando um novo evento chega', () => {
    service.exibirConquista(eventoFake('Primeira'));
    service.exibirConquista(eventoFake('Segunda'));
    expect(service.toastAtual()?.conquista.titulo).toBe('Segunda');
  });

  it('ignora eventos inválidos (sem conquista)', () => {
    const invalido = { ...eventoFake('x'), conquista: null as unknown as ConquistaDesbloqueadaEvento['conquista'] };
    service.exibirConquista(invalido);
    expect(service.toastAtual()).toBeNull();
  });

  it('oculta o toast ao chamar ocultarConquista', () => {
    service.exibirConquista(eventoFake('7 dias na faixa ideal'));
    service.ocultarConquista();
    expect(service.toastAtual()).toBeNull();
  });

  it('exibe e limpa o feedback de ação manual ("+X XP")', () => {
    service.exibirFeedback('+35 XP (bônus)');
    expect(service.feedbackAcao()).toBe('+35 XP (bônus)');
    service.ocultarFeedback();
    expect(service.feedbackAcao()).toBeNull();
  });

  it('exibe o toast discreto de recomendação da IA (RN-034)', () => {
    const evento: RecomendacaoIaEvento = {
      plantaId: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
      plantaApelido: 'Boldo',
      recomendacao: { id: 'r1', titulo: 'Atenção ao período de aclimatação', mensagem: 'Mantenha na sombra por 7 dias.', contexto: 'Intervencao' },
      geradaEm: '2026-10-22T14:00:00Z'
    };
    service.exibirRecomendacao(evento);
    expect(service.recomendacaoAtual()).toEqual(evento);
    service.ocultarRecomendacao();
    expect(service.recomendacaoAtual()).toBeNull();
  });

  it('ignora evento de recomendação inválido (sem recomendacao)', () => {
    const invalido = { plantaId: 'x', recomendacao: null, geradaEm: '' } as unknown as RecomendacaoIaEvento;
    service.exibirRecomendacao(invalido);
    expect(service.recomendacaoAtual()).toBeNull();
  });
});
