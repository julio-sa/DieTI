import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { RouterModule } from '@angular/router';
@Component({
  selector: "app-sign-in",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./sign-in.component.html",
  styleUrls: ["./sign-in.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInComponent {}