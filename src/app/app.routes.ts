import { Routes } from '@angular/router';
import { PlantasComponent } from './components/plantas/plantas.component';
import { PlantaCadastroComponent } from './components/planta-cadastro/planta-cadastro.component';
import { PlantaDetalhesComponent } from './components/planta-detalhes/planta-detalhes.component';
import { PlantaEtapaDetalhesComponent } from './components/planta-etapa-detalhes/planta-etapa-detalhes.component';
import { ConquistasComponent } from './components/conquistas/conquistas.component';

export const routes: Routes = [
  { path: '', redirectTo: 'plantas', pathMatch: 'full' },
  { path: 'plantas', component: PlantasComponent },
  { path: 'plantas/nova', component: PlantaCadastroComponent },
  { path: 'plantas/:id/etapa/:passo', component: PlantaEtapaDetalhesComponent },
  { path: 'plantas/:id', component: PlantaDetalhesComponent },
  { path: 'conquistas', component: ConquistasComponent, title: 'Conquistas' },
  { path: '**', redirectTo: 'plantas' }
];
