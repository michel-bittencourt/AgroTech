import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { PlantaExistenteCadastroComponent } from './planta-existente-cadastro.component';

@Component({ selector: 'dummy-detalhe', standalone: true, template: '' })
class DummyDetalheComponent {}

describe('PlantaExistenteCadastroComponent (UI_SPEC §5 — RN-026..033)', () => {
  let fixture: ComponentFixture<PlantaExistenteCadastroComponent>;
  let component: PlantaExistenteCadastroComponent;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlantaExistenteCadastroComponent],
      providers: [
        provideRouter([{ path: 'plantas/:id', component: DummyDetalheComponent }]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PlantaExistenteCadastroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  function flushCargas(): void {
    http.expectOne((req) => req.url.includes('/especies')).flush([]);
    http.expectOne((req) => req.url.includes('/dispositivos')).flush([]);
  }

  it('exibe o badge informativo de planta existente (RN-026)', () => {
    flushCargas();
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Você está cadastrando uma planta que já existe');
    expect(texto).toContain('sem checklist de semente');
  });

  it('inicia no estágio Vegetativo por padrão (UI_SPEC §5.3)', () => {
    flushCargas();
    expect(component['estagioAtual']).toBe('Vegetativo');
  });

  it('bloqueia o salvamento sem nenhuma parte selecionada no checklist (RN-028 — ERR-REC-002)', () => {
    flushCargas();
    fixture.detectChanges();
    component['apelidoLote'] = 'Boldo - Vaso grande';
    component['especieSelecionada'] = { id: 'e1', nomePopular: 'Boldo', criadoEm: '' };
    component['salvar']();

    const erros = component['errosCampo']();
    expect(erros['checklist']).toBeTruthy();
    http.expectNone((req) => req.url.includes('/plantas/existente'));
  });

  it('bloqueia data futura em intervenção do histórico (RN-031 — ERR-REC-003)', () => {
    flushCargas();
    fixture.detectChanges();
    component['apelidoLote'] = 'Boldo';
    component['especieSelecionada'] = { id: 'e1', nomePopular: 'Boldo', criadoEm: '' };
    component['checklist'].set({ folhas: ['Secas'], caule: [], raizes: [], pragas: [] });
    component['intervencoes'].update((atual) => [
      ...atual,
      { tipo: 'Transplante', dataEvento: '2099-01-01', dataAproximada: false, detalhesLivres: '' }
    ]);
    component['salvar']();

    expect(component['errosCampo']()['intervencao-0']).toBeTruthy();
    http.expectNone((req) => req.url.includes('/plantas/existente'));
  });

  it('salva planta + avaliação e redireciona para o detalhe (UI_SPEC §5.5)', async () => {
    flushCargas();
    fixture.detectChanges();
    component['apelidoLote'] = 'Boldo - Vaso grande';
    component['especieSelecionada'] = { id: 'esp-1', nomePopular: 'Boldo', criadoEm: '' };
    component['checklist'].set({ folhas: ['Secas'], caule: [], raizes: [], pragas: ['Caramujos'] });
    component['estagioAtual'] = 'Vegetativo';

    component['salvar']();

    const reqPlanta = http.expectOne((req) => req.url.includes('/plantas/existente'));
    expect(reqPlanta.request.method).toBe('POST');
    expect(reqPlanta.request.body).toEqual({
      apelidoLote: 'Boldo - Vaso grande',
      especieId: 'esp-1',
      estagioAtual: 'Vegetativo',
      dispositivoId: null
    });
    reqPlanta.flush({ id: 'planta-1', apelidoLote: 'Boldo - Vaso grande', estagioCiclo: 'Vegetativo', origemDesconhecida: true, statusVida: 'Ativa', dataCadastro: '2026-10-22T14:00:00Z' });

    const reqAvaliacao = http.expectOne((req) => req.url.includes('/plantas/planta-1/avaliacoes'));
    expect(reqAvaliacao.request.body).toEqual({
      checklist: { folhas: ['Secas'], caule: [], raizes: [], pragas: ['Caramujos'] },
      observacoesLivres: undefined,
      fotos: undefined
    });
    reqAvaliacao.flush({ id: 'av-1' }, { headers: { 'X-Ia-Indisponivel': 'false' } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.url).toBe('/plantas/planta-1');
  });

  it('navega com abrirPlano quando o histórico tem transplante (RN-032/033)', async () => {
    flushCargas();
    fixture.detectChanges();
    component['apelidoLote'] = 'Boldo';
    component['especieSelecionada'] = { id: 'e1', nomePopular: 'Boldo', criadoEm: '' };
    component['checklist'].set({ folhas: ['Secas'], caule: [], raizes: [], pragas: [] });
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    component['intervencoes'].update((atual) => [
      ...atual,
      { tipo: 'Transplante', dataEvento: hojeIso, dataAproximada: false, detalhesLivres: 'canela nos cortes' }
    ]);

    component['salvar']();

    const reqPlanta = http.expectOne((req) => req.url.includes('/plantas/existente'));
    reqPlanta.flush({ id: 'planta-9', apelidoLote: 'Boldo', estagioCiclo: 'Vegetativo', origemDesconhecida: true, statusVida: 'Ativa', dataCadastro: '2026-10-22T14:00:00Z' });

    const reqAvaliacao = http.expectOne((req) => req.url.includes('/avaliacoes'));
    reqAvaliacao.flush({ id: 'av-2' });

    const reqIntervencao = http.expectOne((req) => req.url.includes('/plantas/planta-9/intervencoes'));
    reqIntervencao.flush({ id: 'iv-7', tipo: 'Transplante', dataEvento: hojeIso, dataAproximada: false, criadoEm: '2026-10-22T14:10:00Z' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.url).toBe('/plantas/planta-9?abrirPlano=iv-7');
  });
});
