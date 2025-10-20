// app.routes.ts
import { Routes } from '@angular/router';
import { InitComponent } from './init/init.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'init',
    pathMatch: 'full'
  },
  {
    path: 'init',
    component: InitComponent,
    title: 'Init Screen'
  },
  {
    path: 'sign-in',
    loadChildren: () =>
      import('./sign-in/sign-in.module').then(m => m.SignInModule),
  },
  {
    path: 'password-recovery',
    loadChildren: () =>
      import('./auth/password-recovery/password-recovery.module').then(m => m.PasswordRecoveryModule)
  },
  {
    path: 'recovery-code',
    loadChildren: () =>
      import('./auth/recovery-code/recovery-code.module').then(m => m.RecoveryCodeModule)
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then(m => m.HomeModule),
    title: 'Home Page'
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./profile/profile.module').then(m => m.ProfileModule),
    title: 'Profile'
  },
  {
    path: 'create-recipe',
    loadChildren: () =>
      import('./create-recipe/create-recipe.module').then(m => m.CreateRecipeModule),
    title: 'Create Recipe'
  },
  {
    path: 'saved-recipes',
    loadChildren: () =>
      import('./shared/saved-recipes/saved-recipes.module').then(m => m.SavedRecipesModule),
    title: 'Saved Recipes'
  },
  { path: '**', redirectTo: 'init' }
];