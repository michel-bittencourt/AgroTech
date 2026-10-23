import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Component } from '@angular/core';
import { IntervencaoRegistroComponent } from './intervencao-registro.component';

@Component({ selector: 'dummy-detalhe', standalone: true, template: '' })
class DummyDetalheComponent {}

describe('IntervencaoRegistroComponent (RN-030/031/032)', () => {
  let http: HttpTestingController;
  let router: Router;

  function criarComponente(): { fixture: ComponentFixture<IntervencaoRegistroComponent>; component: IntervencaoRegistroComponent } {
    const fixture = TestBed.createComponent(IntervencaoRegistroComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((req) => req.url.includes('/plantas/planta-1') && !req.url.includes('intervencoes')).flush({
      id: 'planta-1', apelidoLote: 'Boldo', especieId: 'e', especieNomePopular: 'Boldo', criadoEm: ''
    });
    fixture.detectChanges();
    return { fixture, component };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntervencaoRegistroComponent],
      providers: [
        provideRouter([{ path: 'plantas/:id', component: DummyDetalheComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'planta-1' }), queryParamMap: convertToParamMap({}) } } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
  });

  it('inicia sem data aproximada marcada (RN-031 — toggle opt-in)', () => {
    const { component } = criarComponente();
    expect(component['dataAproximada']).toBe(false);
    expect(component['tipo']).toBe('Poda');
  });

  it('bloqueia data futura (RN-031 — ERR-REC-003)', () => {
    const { component } = criarComponente();
    component['dataEvento'] = '2099-01-01';
    component['salvar']();
    expect(component['erroCampo']()).toContain('futuro');
    http.expectNone((req) => req.url.includes('/intervencoes'));
  });

  it('exige detalhamento livre para o tipo "Outro" (contrato §7.4)', () => {
    const { component } = criarComponente();
    const hoje = new Date();
    component['dataEvento'] = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    component['tipo'] = 'Outro';
    component['salvar']();
    expect(component['erroCampo']()).toContain('"Outro"');
    http.expectNone((req) => req.url.includes('/intervencoes'));
  });

  it('salva transplante e navega com abrirPlano para oferta do plano (RN-032/033)', async () => {
    const { component } = criarComponente();
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    component['tipo'] = 'Transplante';
    component['dataEvento'] = hojeIso;
    component['dataAproximada'] = true;
    component['detalhesLivres'] = 'canela nos cortes; drenagem com garrafa PET';

    component['salvar']();

    const req = http.expectOne((req) => req.url.includes('/plantas/planta-1/intervencoes'));
    expect(req.request.body).toEqual({
      tipo: 'Transplante',
      dataEvento: hojeIso,
      dataAproximada: true,
      detalhesLivres: 'canela nos cortes; drenagem com garrafa PET'
    });
    req.flush({
      id: 'iv-9', tipo: 'Transplante', dataEvento: hojeIso, dataAproximada: true, criadoEm: '2026-10-22T14:10:00Z',
      janelaTransplante: { iniciada: true, verificacaoAte: '2026-10-29T14:10:00Z', seloPrevisto: 'Transplante bem-sucedido' }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.url).toBe('/plantas/planta-1?abrirPlano=iv-9');
  });
});
