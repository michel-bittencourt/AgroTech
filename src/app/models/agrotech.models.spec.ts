import { faixaOpcionalValida } from './agrotech.models';

describe('faixaOpcionalValida (UI_SPEC §3.3 — campos opcionais de faixa)', () => {
  it('válida quando ambos os campos estão vazios (opcionais)', () => {
    expect(faixaOpcionalValida(null, null)).toBe(true);
    expect(faixaOpcionalValida(undefined, undefined)).toBe(true);
  });

  it('válida quando apenas um dos campos está preenchido', () => {
    expect(faixaOpcionalValida(1000, null)).toBe(true);
    expect(faixaOpcionalValida(null, 20000)).toBe(true);
  });

  it('válida quando Min <= Max', () => {
    expect(faixaOpcionalValida(1000, 20000)).toBe(true);
    expect(faixaOpcionalValida(500, 500)).toBe(true);
  });

  it('inválida quando Min > Max', () => {
    expect(faixaOpcionalValida(20000, 1000)).toBe(false);
  });

  it('trata zero como valor preenchido válido', () => {
    expect(faixaOpcionalValida(0, 100)).toBe(true);
    expect(faixaOpcionalValida(0, null)).toBe(true);
  });
});
