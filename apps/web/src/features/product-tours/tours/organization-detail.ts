import type { ProductTour } from '../product-tour.js';

/**
 * "Organization" (§2.4, §7.3): where the Administrator maps the e-mail domains of a customer
 * company, grants it projects and adds its end users. The members step is shown only with
 * `manage_members`, i.e. not for an archived organization.
 */
export const ORGANIZATION_DETAIL_TOUR: ProductTour = {
  id: 'organization_detail',
  version: 1,
  view: '/admin/organizations/[organizationId]',
  audience: 'team',
  nameKey: 'tours.organization_detail.name',
  steps: [
    {
      target: 'organization-detail-domains',
      titleKey: 'tours.organization_detail.steps.domains.title',
      descriptionKey: 'tours.organization_detail.steps.domains.description',
    },
    {
      target: 'organization-detail-projects',
      titleKey: 'tours.organization_detail.steps.projects.title',
      descriptionKey: 'tours.organization_detail.steps.projects.description',
    },
    {
      target: 'organization-detail-add-member',
      titleKey: 'tours.organization_detail.steps.members.title',
      descriptionKey: 'tours.organization_detail.steps.members.description',
      isOptional: true,
    },
  ],
};
