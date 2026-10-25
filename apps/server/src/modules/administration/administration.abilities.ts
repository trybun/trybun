import type { AbilityRules } from '../../platform/authorization/ability-factory.js';

/** The subject of the Administrator panel, a part of the system without records (§15.6). */
export const ADMINISTRATION = 'Administration';

/** Only Administrators open the Administrator panel (§7.5). */
export const administrationAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.isAdmin) {
    can('read', ADMINISTRATION);
  }
};
