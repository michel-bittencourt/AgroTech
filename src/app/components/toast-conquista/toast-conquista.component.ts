import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GamificacaoToastService } from '../../services/gamificacao-toast.service';
import { TIER_VISUAL } from '../../models/gamificacao.models';

/** Toast global "Conquista desbloqueada!" (RN-022), feedback de XP (RN-013) e "Nova recomendação da IA" (RN-034). */
@Component({
  selector: 'app-toast-conquista',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './toast-conquista.component.html',
  styleUrls: ['./toast-conquista.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastConquistaComponent {
  protected readonly toastService = inject(GamificacaoToastService);
  protected readonly tierVisual = TIER_VISUAL;
}
