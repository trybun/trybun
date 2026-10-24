import type { ProductTour } from '../product-tour.js';

/** "First login" (§2.4): where a new team member finds the views, the help and their account. */
export const FIRST_LOGIN_TOUR: ProductTour = {
  id: 'first_login',
  version: 1,
  view: '/',
  audience: 'team',
  nameKey: 'tours.first_login.name',
  steps: [
    {
      titleKey: 'tours.first_login.steps.welcome.title',
      descriptionKey: 'tours.first_login.steps.welcome.description',
    },
    {
      target: 'app-shell-navigation',
      titleKey: 'tours.first_login.steps.navigation.title',
      descriptionKey: 'tours.first_login.steps.navigation.description',
      phoneSheetSide: 'top',
    },
    {
      target: 'app-header-help',
      titleKey: 'tours.first_login.steps.help.title',
      descriptionKey: 'tours.first_login.steps.help.description',
    },
    {
      target: 'app-header-account-menu',
      titleKey: 'tours.first_login.steps.account.title',
      descriptionKey: 'tours.first_login.steps.account.description',
    },
  ],
};
