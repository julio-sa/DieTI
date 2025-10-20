import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { timer } from "rxjs";
;

@Component({
  selector: "app-init",
  standalone: true,
  templateUrl: "./init.component.html",
  styleUrls: ["./init.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class InitComponent implements OnInit {
  constructor(private router: Router) {
    // Redireciona após 5 segundos (5000ms)
    timer(5000).pipe(
      takeUntilDestroyed() // Limpeza automática
    ).subscribe(() => {
      this.router.navigate(['/sign-in']);
    });
  }

  ngOnInit() {}
}