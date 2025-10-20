  // src/app/create-recipe/create-recipe.module.ts
  import { NgModule } from '@angular/core';
  import { CreateRecipeComponent } from './create-recipe.component';
  import { CreateRecipeRoutingModule } from './create-recipe-routing.module';
  import { CommonModule } from '@angular/common';

  @NgModule({
    imports: [CreateRecipeComponent, CreateRecipeRoutingModule, CommonModule]
  })
  export class CreateRecipeModule {}