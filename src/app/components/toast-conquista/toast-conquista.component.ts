import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';
import { TIER_VISUAL } from '../../models/gamificacao.models';

/** Toast global "Conquista desbloqueada!" (RN-022) e feedback de ações de XP (RN-013). */
@Component({
  selector: 'app-toast-conquista',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-conquista.component.html',
  styleUrls: ['./toast-conquista.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastConquistaComponent {
  protected readonly toastService = inject(GamificacaoToastService);
  protected readonly tierVisual = TIER_VISUAL;
}
