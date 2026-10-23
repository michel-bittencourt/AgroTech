import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ShellComponent } from './shell.component';

@Component({ selector: 'dummy-jardim', standalone: true, template: '' })
class DummyJardimComponent {}

@Component({ selector: 'dummy-nova', standalone: true, template: '' })
class DummyNovaComponent {}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([
          { path: 'plantas', component: DummyJardimComponent },
          { path: 'plantas/nova', component: DummyNovaComponent },
          { path: 'conquistas', component: DummyJardimComponent }
        ]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  function criarComponente(): ComponentFixture<ShellComponent> {
    const f = TestBed.createComponent(ShellComponent);
    f.detectChanges();
    return f;
  }

  afterEach(() => {
    localStorage.removeItem('agrotech-sidebar-collapsed');
    localStorage.removeItem('agrotech-sidebar-grupos');
  });

  it('cria o shell', () => {
    const f = criarComponente();
    expect(f.componentInstance).toBeTruthy();
  });

  it('exibe os grupos Jardim e Configurações', () => {
    const f = criarComponente();
    const rotulos = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nav-grupo-botao .nav-rotulo'));
    const textos = rotulos.map((r) => r.textContent?.trim());
    expect(textos).toContain('Jardim');
    expect(textos).toContain('Configurações');
  });

  it('grupo Jardim abre por padrão com os subitens Visão geral, Nova planta e Conquistas', () => {
    const f = criarComponente();
    const subitens = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nav-subitens .nav-subitem'));
    const textos = subitens.map((s) => s.textContent?.trim());
    expect(textos).toContain('Visão geral');
    expect(textos).toContain('Nova planta');
    expect(textos).toContain('Conquistas');
  });

  it('grupo Configurações abre/fecha via clique e persiste em localStorage', () => {
    const f = criarComponente();
    expect(f.componentInstance['grupoAberto']('config')).toBe(false);

    f.componentInstance['alternarGrupo']('config', true);
    expect(f.componentInstance['grupoAberto']('config')).toBe(true);
    expect(JSON.parse(localStorage.getItem('agrotech-sidebar-grupos') || '{}')['config']).toBe(true);

    f.componentInstance['alternarGrupo']('config', false);
    expect(f.componentInstance['grupoAberto']('config')).toBe(false);
    expect(JSON.parse(localStorage.getItem('agrotech-sidebar-grupos') || '{}')['config']).toBe(false);
  });

  it('restaura o estado dos grupos salvo no localStorage', () => {
    localStorage.setItem('agrotech-sidebar-grupos', JSON.stringify({ jardim: false, config: true }));
    const f = criarComponente();
    expect(f.componentInstance['grupoAberto']('jardim')).toBe(false);
    expect(f.componentInstance['grupoAberto']('config')).toBe(true);
  });

  it('persiste o colapso da sidebar no localStorage', () => {
    const f = criarComponente();
    expect(localStorage.getItem('agrotech-sidebar-collapsed')).toBeNull();

    f.componentInstance['alternarColapsada']();
    expect(f.componentInstance['colapsada']()).toBe(true);
    expect(localStorage.getItem('agrotech-sidebar-collapsed')).toBe('true');

    f.componentInstance['alternarColapsada']();
    expect(f.componentInstance['colapsada']()).toBe(false);
    expect(localStorage.getItem('agrotech-sidebar-collapsed')).toBe('false');
  });

  it('restaura o estado colapsado salvo no localStorage', () => {
    localStorage.setItem('agrotech-sidebar-collapsed', 'true');
    const f = criarComponente();
    expect(f.componentInstance['colapsada']()).toBe(true);
    expect((f.nativeElement as HTMLElement).querySelector('.sidebar')?.classList.contains('colapsada')).toBe(true);
  });

  it('clicar num grupo no rail colapsado expande a sidebar e abre o grupo', () => {
    localStorage.setItem('agrotech-sidebar-collapsed', 'true');
    const f = criarComponente();
    f.componentInstance['clicarGrupo']('config');
    expect(f.componentInstance['colapsada']()).toBe(false);
    expect(f.componentInstance['grupoAberto']('config')).toBe(true);
  });

  it('marca o subitem ativo conforme a rota (exato)', async () => {
    const f = criarComponente();
    await router.navigate(['/plantas']);
    f.detectChanges();

    const itens = f.componentInstance['gruposMenu'].flatMap((g) => g.itens);
    const visaoGeral = itens.find((i) => i.rotulo === 'Visão geral')!;
    const novaPlanta = itens.find((i) => i.rotulo === 'Nova planta')!;
    const conquistas = itens.find((i) => i.rotulo === 'Conquistas')!;

    expect(f.componentInstance['itemEstaAtivo'](visaoGeral)).toBe(true);
    expect(f.componentInstance['itemEstaAtivo'](novaPlanta)).toBe(false);
    expect(f.componentInstance['itemEstaAtivo'](conquistas)).toBe(false);

    await router.navigate(['/plantas/nova']);
    f.detectChanges();
    expect(f.componentInstance['itemEstaAtivo'](visaoGeral)).toBe(false);
    expect(f.componentInstance['itemEstaAtivo'](novaPlanta)).toBe(true);
  });

  it('marca "Conquistas" ativo apenas na rota dedicada /conquistas', async () => {
    const f = criarComponente();
    const itens = f.componentInstance['gruposMenu'].flatMap((g) => g.itens);
    const conquistas = itens.find((i) => i.rotulo === 'Conquistas')!;
    const visaoGeral = itens.find((i) => i.rotulo === 'Visão geral')!;

    await router.navigate(['/conquistas']);
    f.detectChanges();
    expect(f.componentInstance['itemEstaAtivo'](conquistas)).toBe(true);
    expect(f.componentInstance['itemEstaAtivo'](visaoGeral)).toBe(false);

    await router.navigate(['/plantas']);
    f.detectChanges();
    expect(f.componentInstance['itemEstaAtivo'](conquistas)).toBe(false);
  });

  it('navegação abre automaticamente o grupo do item ativo', async () => {
    localStorage.setItem('agrotech-sidebar-grupos', JSON.stringify({ jardim: false, config: false }));
    const f = criarComponente();
    expect(f.componentInstance['grupoAberto']('jardim')).toBe(false);

    await router.navigate(['/plantas']);
    f.detectChanges();
    expect(f.componentInstance['grupoAberto']('jardim')).toBe(true);
  });

  it('deriva o título da topbar a partir da rota atual', async () => {
    const f = criarComponente();
    await router.navigate(['/plantas/nova']);
    f.detectChanges();
    expect(f.componentInstance['tituloAtual']()).toBe('Nova Planta');
  });

  it('abre o modal Servidor API pelo submenu e fecha sem alterar a URL salva', () => {
    const f = criarComponente();
    f.componentInstance['abrirModalApi']();
    f.detectChanges();
    expect(f.componentInstance['modalApiAberto']()).toBe(true);
    expect((f.nativeElement as HTMLElement).querySelector('.modal-api-box')).not.toBeNull();

    f.componentInstance['fecharModalApi']();
    f.detectChanges();
    expect(f.componentInstance['modalApiAberto']()).toBe(false);
    expect((f.nativeElement as HTMLElement).querySelector('.modal-api-box')).toBeNull();
  });

  it('esconde o card de XP quando a gamificação do jardim falha', () => {
    const f = criarComponente();
    f.componentInstance['jardim'].set(null);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.xp-card')).toBeNull();
  });
});
