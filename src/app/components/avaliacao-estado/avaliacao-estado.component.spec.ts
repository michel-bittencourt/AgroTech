import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Component } from '@angular/core';
import { AvaliacaoEstadoComponent } from './avaliacao-estado.component';

@Component({ selector: 'dummy-detalhe', standalone: true, template: '' })
class DummyDetalheComponent {}

describe('AvaliacaoEstadoComponent (RN-028/029/036)', () => {
  let http: HttpTestingController;
  let router: Router;

  function criarComponente(): { fixture: ComponentFixture<AvaliacaoEstadoComponent>; component: AvaliacaoEstadoComponent } {
    const fixture = TestBed.createComponent(AvaliacaoEstadoComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    // Carga do apelido da planta disparada no ngOnInit
    http.expectOne((req) => req.url.includes('/plantas/planta-1') && !req.url.includes('avaliacoes')).flush({
      id: 'planta-1', apelidoLote: 'Boldo', especieId: 'e', especieNomePopular: 'Boldo', criadoEm: ''
    });
    fixture.detectChanges();
    return { fixture, component };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvaliacaoEstadoComponent],
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

  it('bloqueia o salvamento sem nenhuma parte do checklist (RN-028 — ERR-REC-002)', () => {
    const { component } = criarComponente();
    component['salvar']();
    expect(component['erroChecklist']()).toContain('ao menos uma parte');
    http.expectNone((req) => req.url.includes('/avaliacoes'));
  });

  it('salva a avaliação, mostra aviso de IA indisponível pelo header e volta ao detalhe (RN-036)', async () => {
    const { component } = criarComponente();
    component['checklist'].set({ folhas: ['Comidas', 'Secas'], caule: [], raizes: [], pragas: ['Caramujos'] });
    component['observacoesLivres'] = 'folhas comidas por caramujos';
    component['salvar']();

    const req = http.expectOne((req) => req.url.includes('/plantas/planta-1/avaliacoes'));
    expect(req.request.body).toEqual({
      checklist: { folhas: ['Comidas', 'Secas'], caule: [], raizes: [], pragas: ['Caramujos'] },
      observacoesLivres: 'folhas comidas por caramujos'
    });
    // Contrato §7.2: 201 com header X-Ia-Indisponivel=true — registro preservado, aviso discreto (RN-036)
    req.flush({ id: 'av-1', interpretacaoIa: null }, { headers: { 'X-Ia-Indisponivel': 'true' } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.url).toBe('/plantas/planta-1');
    expect(component['salvando']()).toBe(false);
  });

  it('trata 503 como registro preservado e navega de volta (RN-036)', async () => {
    const { component } = criarComponente();
    component['checklist'].set({ folhas: ['Murchas'], caule: [], raizes: [], pragas: [] });
    component['salvar']();

    const req = http.expectOne((req) => req.url.includes('/plantas/planta-1/avaliacoes'));
    req.flush(null, { status: 503, statusText: 'Service Unavailable' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.url).toBe('/plantas/planta-1');
  });
});
