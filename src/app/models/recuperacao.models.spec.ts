import {
  checklistComToggle,
  checklistTemSelecao,
  dataEventoValida,
  etapasEditorValidas,
  intervencaoRetroativa
} from './recuperacao.models';

describe('recuperacao.models — helpers (RN-028/031/033)', () => {
  describe('checklistTemSelecao (RN-028 — ERR-REC-002)', () => {
    const vazio = { folhas: [], caule: [], raizes: [], pragas: [] };

    it('inválido quando nenhuma parte tem seleção', () => {
      expect(checklistTemSelecao(vazio)).toBe(false);
    });

    it('válido quando ao menos uma parte tem seleção', () => {
      expect(checklistTemSelecao({ ...vazio, pragas: ['Caramujos'] })).toBe(true);
      expect(checklistTemSelecao({ ...vazio, folhas: ['Secas'] })).toBe(true);
    });
  });

  describe('checklistComToggle', () => {
    it('adiciona e remove sintoma sem mutar o checklist original', () => {
      const inicial = { folhas: [] as string[], caule: [] as string[], raizes: [] as string[], pragas: [] as string[] };
      const comSintoma = checklistComToggle(inicial, 'folhas', 'Secas');
      expect(comSintoma.folhas).toEqual(['Secas']);
      expect(inicial.folhas).toEqual([]);

      const semSintoma = checklistComToggle(comSintoma, 'folhas', 'Secas');
      expect(semSintoma.folhas).toEqual([]);
    });
  });

  describe('intervencaoRetroativa (RN-031)', () => {
    it('true quando dataEvento anterior à data do registro', () => {
      expect(intervencaoRetroativa('2026-10-01', '2026-10-22T14:10:00Z')).toBe(true);
    });

    it('false quando dataEvento é o mesmo dia do registro', () => {
      expect(intervencaoRetroativa('2026-10-22', '2026-10-22T14:10:00Z')).toBe(false);
    });

    it('false quando datas ausentes', () => {
      expect(intervencaoRetroativa('', '')).toBe(false);
    });
  });

  describe('dataEventoValida (RN-031 — ERR-REC-003)', () => {
    it('aceita data passada e hoje', () => {
      expect(dataEventoValida('2026-10-01', new Date(2026, 9, 22))).toBe(true);
      expect(dataEventoValida('2026-10-22', new Date(2026, 9, 22))).toBe(true);
    });

    it('rejeita data futura', () => {
      expect(dataEventoValida('2026-10-23', new Date(2026, 9, 22))).toBe(false);
    });

    it('rejeita vazia ou malformada', () => {
      expect(dataEventoValida('', new Date(2026, 9, 22))).toBe(false);
      expect(dataEventoValida('nao-e-data', new Date(2026, 9, 22))).toBe(false);
    });
  });

  describe('etapasEditorValidas (RN-033)', () => {
    it('renumera ordens, trima descrições e descarta vazias', () => {
      const resultado = etapasEditorValidas([
        { descricao: '  Permanecer na sombra ', duracaoDias: 7 },
        { descricao: '   ', duracaoDias: 3 },
        { descricao: 'Retorno gradual ao sol', duracaoDias: 0 }
      ]);
      expect(resultado).toEqual([
        { ordem: 1, descricao: 'Permanecer na sombra', duracaoDias: 7 },
        { ordem: 2, descricao: 'Retorno gradual ao sol', duracaoDias: 1 }
      ]);
    });
  });
});
