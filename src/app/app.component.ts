import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShellComponent } from './components/shell/shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  title = 'AgroTech Frontend';
}
