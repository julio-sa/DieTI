import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  standalone: true,
  imports: [],
  templateUrl: './progress-ring.component.html',
  styleUrls: ['./progress-ring.component.css']
})
export class ProgressRingComponent implements OnInit {
  @Input() value!: number;
  @Input() max!: number;
  @Input() label!: string;
  @Input() unit!: string;

  percentage = 0;
  strokeDasharray = 0;
  strokeDashoffset = 0;

  ngOnInit(): void {
    this.percentage = (this.value / this.max) * 100;
    this.strokeDasharray = 2 * Math.PI * 80; // Circunferência do círculo (raio = 80)
    this.strokeDashoffset = this.strokeDasharray * (1 - this.percentage / 100);
  }
}