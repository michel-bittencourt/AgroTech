import { Routes } from '@angular/router';
import { PlantasComponent } from './components/plantas/plantas.component';
import { PlantaCadastroComponent } from './components/planta-cadastro/planta-cadastro.component';
import { PlantaDetalhesComponent } from './components/planta-detalhes/planta-detalhes.component';
import { PlantaEtapaDetalhesComponent } from './components/planta-etapa-detalhes/planta-etapa-detalhes.component';
import { ConquistasComponent } from './components/conquistas/conquistas.component';
import { PlantaExistenteCadastroComponent } from './components/planta-existente-cadastro/planta-existente-cadastro.component';
import { AvaliacaoEstadoComponent } from './components/avaliacao-estado/avaliacao-estado.component';
import { IntervencaoRegistroComponent } from './components/intervencao-registro/intervencao-registro.component';
import { AssistenteIaComponent } from './components/assistente-ia/assistente-ia.component';

export const routes: Routes = [
  { path: '', redirectTo: 'plantas', pathMatch: 'full' },
  { path: 'plantas', component: PlantasComponent },
  { path: 'plantas/nova', component: PlantaCadastroComponent },
  // "existente" antes de ":id" para não casar como parâmetro (UI_SPEC §5.1)
  { path: 'plantas/existente', component: PlantaExistenteCadastroComponent, title: 'Cadastrar Planta Existente' },
  { path: 'plantas/:id/etapa/:passo', component: PlantaEtapaDetalhesComponent },
  { path: 'plantas/:id/avaliacao', component: AvaliacaoEstadoComponent, title: 'Registrar Estado Físico' },
  { path: 'plantas/:id/intervencao', component: IntervencaoRegistroComponent, title: 'Registrar Intervenção' },
  { path: 'plantas/:id/assistente', component: AssistenteIaComponent, title: 'Assistente IA' },
  { path: 'plantas/:id', component: PlantaDetalhesComponent },
  { path: 'conquistas', component: ConquistasComponent, title: 'Conquistas' },
  { path: '**', redirectTo: 'plantas' }
];
