import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { AssistenteIaComponent } from './assistente-ia.component';

describe('AssistenteIaComponent (RN-035/036 — UI_SPEC §5.6)', () => {
  let http: HttpTestingController;

  function criarComponente(): { fixture: ComponentFixture<AssistenteIaComponent>; component: AssistenteIaComponent } {
    const fixture = TestBed.createComponent(AssistenteIaComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((req) => req.url.includes('/plantas/planta-1') && !req.url.includes('assistente')).flush({
      id: 'planta-1', apelidoLote: 'Boldo', especieId: 'e', especieNomePopular: 'Boldo', criadoEm: ''
    });
    http.expectOne((req) => req.url.includes('/assistente/recomendacoes')).flush([]);
    fixture.detectChanges();
    return { fixture, component };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssistenteIaComponent],
      providers: [
        provideRouter([{ path: 'plantas/:id', component: AssistenteIaComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'planta-1' }), queryParamMap: convertToParamMap({}) } } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('envia a pergunta e exibe a resposta com as fontes consideradas (RN-035)', () => {
    const { component } = criarComponente();

    component['pergunta'] = 'As folhas estão murchando depois do transplante. Devo regar agora?';
    component['perguntar']();

    const req = http.expectOne((req) => req.url.includes('/assistente/consultar'));
    expect(req.request.body).toEqual({ pergunta: 'As folhas estão murchando depois do transplante. Devo regar agora?' });
    req.flush({
      resposta: 'Murcha leve nas primeiras 72h pós-transplante é comum.',
      fontesConsideradas: { telemetria: true, avaliacoesEstado: 1, intervencoes: 1, planoRecuperacao: true, perfilEspecie: true },
      geradaEm: '2026-10-24T10:00:00Z'
    });

    const mensagens = component['mensagens']();
    expect(mensagens.length).toBe(2);
    expect(mensagens[0].autor).toBe('usuario');
    expect(mensagens[1].autor).toBe('ia');
    expect(component['fontesUltimaResposta']()).toBeTruthy();
    expect(component['iaIndisponivel']()).toBe(false);
  });

  it('ativa o estado IA indisponível no 503 e repete a pergunta no retry (RN-036)', () => {
    const { component } = criarComponente();

    component['pergunta'] = 'Devo adubar agora?';
    component['perguntar']();

    const req = http.expectOne((req) => req.url.includes('/assistente/consultar'));
    req.flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(component['iaIndisponivel']()).toBe(true);
    expect(component['consultando']()).toBe(false);

    component['tentarNovamente']();
    const retry = http.expectOne((req) => req.url.includes('/assistente/consultar'));
    expect(retry.request.body).toEqual({ pergunta: 'Devo adubar agora?' });
    retry.flush({
      resposta: 'Aguarde o fim da fase de sombra.',
      fontesConsideradas: { telemetria: false, avaliacoesEstado: 0, intervencoes: 1, planoRecuperacao: false, perfilEspecie: true },
      geradaEm: '2026-10-24T10:05:00Z'
    });

    expect(component['iaIndisponivel']()).toBe(false);
    expect(component['mensagens']().length).toBe(2);
  });

  it('considera fonte com contagem 0 como inativa no painel lateral', () => {
    const { component } = criarComponente();
    expect(component['fonteAtiva']({ telemetria: false, avaliacoesEstado: 0, intervencoes: 2, planoRecuperacao: true, perfilEspecie: true }, 'intervencoes')).toBe(true);
    expect(component['fonteAtiva']({ telemetria: false, avaliacoesEstado: 0, intervencoes: 2, planoRecuperacao: true, perfilEspecie: true }, 'telemetria')).toBe(false);
    expect(component['rotuloFonte']({ telemetria: true, avaliacoesEstado: 3, intervencoes: 0, planoRecuperacao: false, perfilEspecie: false }, 'avaliacoesEstado')).toBe('Avaliações de estado (3)');
  });
});
