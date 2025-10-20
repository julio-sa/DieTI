import { NgModule } from '@angular/core';
import { SavedRecipesComponent } from './saved-recipes.component';
import { SavedRecipesRoutingModule } from './saved-recipes-routing.module';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    SavedRecipesComponent,
    SavedRecipesRoutingModule,
    CommonModule
  ]
})
export class SavedRecipesModule {}