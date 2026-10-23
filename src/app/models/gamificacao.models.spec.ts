import {
  ORDEM_ESTAGIOS,
  ORDEM_TIERS,
  SaudeMetricaItem,
  TIER_VISUAL,
  cuidadoHojeRegistrado,
  extrairMensagemErro,
  formatarContagemRegressiva,
  formatarDataHora,
  larguraBarraSaude,
  normalizarDiasCuidados,
  proximoEstagio,
  rotuloDiaCuidado,
  transicaoDisponivel
} from './gamificacao.models';

describe('Gamificação — helpers puros', () => {
  describe('TIER_VISUAL (cores fixas — UI_SPEC §6)', () => {
    it('define as 6 tiers na ordem canônica', () => {
      expect(ORDEM_TIERS).toEqual(['Facil', 'Medio', 'Dificil', 'MuitoDificil', 'Epico', 'Lendario']);
    });

    it('aplica as cores fixas por tier (cinza, verde, azul, roxo, laranja, dourado)', () => {
      expect(TIER_VISUAL['Facil'].cor).toBe('#6b7580'); // cinza escurecido p/ contraste AA com texto branco
      expect(TIER_VISUAL['Medio'].cor).toBe('#198754');
      expect(TIER_VISUAL['Dificil'].cor).toBe('#0d6efd');
      expect(TIER_VISUAL['MuitoDificil'].cor).toBe('#6f42c1');
      expect(TIER_VISUAL['Epico'].cor).toBe('#fd7e14');
      expect(TIER_VISUAL['Lendario'].cor).toBe('#d4a017');
    });

    it('exibe rótulos acentuados', () => {
      expect(TIER_VISUAL['Lendario'].label).toBe('Lendário');
      expect(TIER_VISUAL['MuitoDificil'].label).toBe('Muito Difícil');
    });
  });

  describe('ORDEM_ESTAGIOS', () => {
    it('contém os 7 estágios do ciclo de vida na sequência', () => {
      expect(ORDEM_ESTAGIOS).toEqual([
        'Semente',
        'Germinacao',
        'Muda',
        'Vegetativo',
        'Floracao',
        'Frutificacao',
        'Colheita'
      ]);
    });
  });

  describe('proximoEstagio', () => {
    it('retorna o estágio seguinte da sequência', () => {
      expect(proximoEstagio('Muda')).toBe('Vegetativo');
      expect(proximoEstagio('Semente')).toBe('Germinacao');
    });

    it('retorna null no fim da trilha (Colheita)', () => {
      expect(proximoEstagio('Colheita')).toBeNull();
    });
  });

  describe('transicaoDisponivel (RN-010)', () => {
    const agora = new Date('2026-10-04T12:00:00Z');

    it('está liberada quando podeTransicionarEm é vazio', () => {
      expect(transicaoDisponivel(null, agora)).toBe(true);
      expect(transicaoDisponivel(undefined, agora)).toBe(true);
    });

    it('está bloqueada quando o timestamp ainda não passou', () => {
      expect(transicaoDisponivel('2026-10-06T10:00:00Z', agora)).toBe(false);
    });

    it('está liberada quando o timestamp já passou', () => {
      expect(transicaoDisponivel('2026-10-04T09:59:59Z', agora)).toBe(true);
    });
  });

  describe('formatarContagemRegressiva (UI_SPEC §6 — "Disponível em Xd Yh")', () => {
    const agora = new Date('2026-10-04T12:00:00Z');

    it('formata dias e horas restantes', () => {
      // 2 dias e 5 horas no futuro
      expect(formatarContagemRegressiva('2026-10-06T17:00:00Z', agora)).toBe('Disponível em 2d 5h');
    });

    it('formata apenas horas quando menos de um dia', () => {
      expect(formatarContagemRegressiva('2026-10-04T20:00:00Z', agora)).toBe('Disponível em 8h');
    });

    it('retorna vazio quando já liberado ou sem timestamp', () => {
      expect(formatarContagemRegressiva('2026-10-01T00:00:00Z', agora)).toBe('');
      expect(formatarContagemRegressiva(null, agora)).toBe('');
    });
  });

  describe('formatarDataHora (UI_SPEC §6 — DD/MM/AAAA HH:mm)', () => {
    it('formata timestamp ISO com componentes locais', () => {
      const resultado = formatarDataHora('2026-10-04T15:30:00Z');
      expect(resultado).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('retorna traço para entrada vazia ou inválida', () => {
      expect(formatarDataHora(null)).toBe('—');
      expect(formatarDataHora('nao-e-data')).toBe('—');
    });
  });

  describe('larguraBarraSaude (barras proporcionais — §5.1)', () => {
    it('retorna a posição do valorAtual dentro da faixa', () => {
      const metrica: SaudeMetricaItem = { naFaixaIdeal: true, valorAtual: 55, faixaIdeal: { min: 40, max: 70 } };
      expect(larguraBarraSaude(metrica)).toBe(50); // (55-40)/(70-40) = 50%
    });

    it('satura em 0% quando o valor está abaixo da faixa', () => {
      const metrica: SaudeMetricaItem = { naFaixaIdeal: false, valorAtual: 30, faixaIdeal: { min: 40, max: 70 } };
      expect(larguraBarraSaude(metrica)).toBe(0);
    });

    it('satura em 100% quando o valor está acima da faixa', () => {
      const metrica: SaudeMetricaItem = { naFaixaIdeal: false, valorAtual: 90, faixaIdeal: { min: 40, max: 70 } };
      expect(larguraBarraSaude(metrica)).toBe(100);
    });

    it('limites da faixa mapeiam para 0% e 100%', () => {
      expect(larguraBarraSaude({ naFaixaIdeal: true, valorAtual: 40, faixaIdeal: { min: 40, max: 70 } })).toBe(0);
      expect(larguraBarraSaude({ naFaixaIdeal: true, valorAtual: 70, faixaIdeal: { min: 40, max: 70 } })).toBe(100);
    });

    it('fallback 100% quando não há dados numéricos ou faixa inválida', () => {
      expect(larguraBarraSaude({ naFaixaIdeal: true })).toBe(100);
      expect(larguraBarraSaude({ naFaixaIdeal: false, valorAtual: 10, faixaIdeal: { min: 70, max: 40 } })).toBe(100);
    });
  });

  describe('Modo Manual de Saúde — helpers de cuidadosSemana (CR-001)', () => {
    it('normaliza para 7 posições, preenchendo faltantes com false', () => {
      const dias = normalizarDiasCuidados({ confirmados: 2, dias: [true, true] });
      expect(dias.length).toBe(7);
      expect(dias[0]).toBe(true);
      expect(dias[1]).toBe(true);
      expect(dias.slice(2).every((d) => d === false)).toBe(true);
    });

    it('trunca arrays maiores que 7 e trata null/undefined como semana vazia', () => {
      const semana = [true, true, true, true, true, true, true, true, true];
      expect(normalizarDiasCuidados({ confirmados: 9, dias: semana }).length).toBe(7);
      expect(normalizarDiasCuidados(null)).toEqual([false, false, false, false, false, false, false]);
      expect(normalizarDiasCuidados(undefined)).toEqual([false, false, false, false, false, false, false]);
    });

    it('estado do botão: habilitado só quando o cuidado de HOJE (dias[0]) ainda não foi registrado', () => {
      expect(cuidadoHojeRegistrado({ confirmados: 1, dias: [true, false, false, false, false, false, false] })).toBe(true);
      expect(cuidadoHojeRegistrado({ confirmados: 4, dias: [false, true, true, true, true, false, false] })).toBe(false);
      expect(cuidadoHojeRegistrado(null)).toBe(false);
    });

    it('diferencia dias marcados de não marcados (classes dos dots)', () => {
      const dias = normalizarDiasCuidados({ confirmados: 4, dias: [true, true, false, true, true, false, false] });
      const preenchidos = dias.filter((d) => d).length;
      expect(preenchidos).toBe(4);
      expect(dias.map((d) => (d ? 'preenchido' : 'vazio'))).toEqual([
        'preenchido', 'preenchido', 'vazio', 'preenchido', 'preenchido', 'vazio', 'vazio'
      ]);
    });

    it('rótulos dos indicadores: Hoje, Ontem e N dias atrás', () => {
      expect(rotuloDiaCuidado(0)).toBe('Hoje');
      expect(rotuloDiaCuidado(1)).toBe('Ontem');
      expect(rotuloDiaCuidado(3)).toBe('3 dias atrás');
      expect(rotuloDiaCuidado(6)).toBe('6 dias atrás');
    });
  });

  describe('extrairMensagemErro (envelope de erro do contrato)', () => {
    it('extrai a primeira mensagem do array padrão', () => {
      const corpo = [{ id: null, message: 'Tempo mínimo do estágio atual ainda não foi atingido.', field: 'novoEstagio' }];
      expect(extrairMensagemErro(corpo, 'fallback')).toBe('Tempo mínimo do estágio atual ainda não foi atingido.');
    });

    it('usa fallback para corpo vazio ou inválido', () => {
      expect(extrairMensagemErro([], 'fallback')).toBe('fallback');
      expect(extrairMensagemErro(null, 'fallback')).toBe('fallback');
    });
  });
});
