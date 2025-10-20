import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SavedRecipesComponent } from './saved-recipes.component';

const routes: Routes = [
  {
    path: '',
    component: SavedRecipesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SavedRecipesRoutingModule {}