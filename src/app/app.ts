import { Component } from '@angular/core';
import { DataGridComponent } from './components/data-grid/data-grid.component';

@Component({
  selector: 'app-root',
  imports: [DataGridComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
