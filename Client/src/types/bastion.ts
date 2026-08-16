export const BASTION_FACILITY_TYPE_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'special', label: 'Special' },
];

export const BASTION_SPACE_OPTIONS = [
  { value: 'cramped', label: 'Cramped' },
  { value: 'roomy', label: 'Roomy' },
  { value: 'vast', label: 'Vast' },
];

export type BastionFacilityInstanceStatus = 'under_construction' | 'built' | 'decommissioned';

export const BASTION_FACILITY_INSTANCE_STATUS_OPTIONS: { value: BastionFacilityInstanceStatus; label: string }[] = [
  { value: 'under_construction', label: 'Under Construction' },
  { value: 'built', label: 'Built' },
  { value: 'decommissioned', label: 'Decommissioned' },
];

/** Read-only reference catalog entry - the D&D 2024 Bastion system's facility list. */
export interface BastionFacility {
  id: string;
  name: string;
  facilityType: string;
  space: string[];
  prerequisiteLevel: number | null;
  orders: string[];
  description: string;
  imageSrc: string;
  page: number | null;
}

/** One facility a specific PC's bastion has actually built. */
export interface BastionFacilityInstance {
  id: string;
  facilityId: string | null;
  customName: string;
  status: BastionFacilityInstanceStatus;
  defendersAssigned: number;
  notes: string;
  sortOrder: number;
}

/** A PC's bastion/stronghold. `ownerName` is freeform (no Character picker exists in the
 * client yet, so it's stored in the Bastion row's raw_data rather than the real
 * character_id FK column, same overflow convention as Quest's raw_data fields). */
export interface Bastion {
  id: string;
  characterId: string | null;
  ownerName: string;
  name: string;
  notes: string;
  treasury: number;
  facilities: BastionFacilityInstance[];
  createdAt: number;
  updatedAt: number;
}
