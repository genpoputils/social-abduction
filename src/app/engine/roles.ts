import { CharacterArchetype, CharacterType, GameSettings, Role, TaskDefinition } from './types';

export const CHARACTER_ARCHETYPES: Record<CharacterType, CharacterArchetype> = {
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    roleHint: 'Maintains critical infrastructure and conduits',
    color: '#f59e0b',
    accentColor: '#d97706',
    description: 'Specializes in high-voltage grids and structural conduits.'
  },
  scientist: {
    id: 'scientist',
    name: 'Scientist',
    roleHint: 'Analyzes anomalies and chemical compounds',
    color: '#a855f7',
    accentColor: '#9333ea',
    description: 'Decodes alien botanical samples and radiation signatures.'
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    roleHint: 'Monitors vital signs and biological quarantines',
    color: '#06b6d4',
    accentColor: '#0891b2',
    description: 'Maintains crew physiological health and bio-scans.'
  },
  botanist: {
    id: 'botanist',
    name: 'Botanist',
    roleHint: 'Cultivates hydroponic oxygen and nutrient flora',
    color: '#10b981',
    accentColor: '#059669',
    description: 'Tends to the settlement’s bio-domes and greenhouse irrigation.'
  },
  mechanic: {
    id: 'mechanic',
    name: 'Mechanic',
    roleHint: 'Overhauls planetary rovers and hydraulic valves',
    color: '#ef4444',
    accentColor: '#dc2626',
    description: 'Expert in pneumatic systems and heavy power plant machinery.'
  },
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    roleHint: 'Collects stellar data and archives telemetry',
    color: '#3b82f6',
    accentColor: '#2563eb',
    description: 'Calibrates deep-space observatories and radio telemetry.'
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    roleHint: 'Navigates peripheral perimeters and storage routes',
    color: '#14b8a6',
    accentColor: '#0d9488',
    description: 'Swift surveyor of outer storage bays and ventilation ducts.'
  },
  security: {
    id: 'security',
    name: 'Security Officer',
    roleHint: 'Protects the settlement and investigates breaches',
    color: '#64748b',
    accentColor: '#475569',
    description: 'Equipped with tactical gear and monitors surveillance feeds.'
  }
};

export const CHARACTER_LIST: CharacterArchetype[] = Object.values(CHARACTER_ARCHETYPES);

export const DEFAULT_MIDNIGHT_SETTINGS: GameSettings = {
  minPlayers: 5,
  maxPlayers: 10,
  impostorCount: 1, // for 5 players, scales with count
  discussionSeconds: 30,
  votingSeconds: 25,
  killCooldownSeconds: 25,
  tasksPerPlayer: 4,
  speed: 220,
  sabotageTimerSeconds: 45
};

export const VILLAGE_TASKS: TaskDefinition[] = [
  { id: 't_power_wiring', room: 'Power Station', name: 'Fix Power Wiring', type: 'wiring', x: 450, y: 1450 },
  { id: 't_power_divert', room: 'Power Station', name: 'Divert Auxiliary Breakers', type: 'divert_power', x: 620, y: 1520 },
  { id: 't_lab_sample', room: 'Laboratory', name: 'Analyze Chemical Sample', type: 'sample_scan', x: 420, y: 450 },
  { id: 't_lab_wiring', room: 'Laboratory', name: 'Repair Microscope Wiring', type: 'wiring', x: 650, y: 380 },
  { id: 't_green_valve', room: 'Greenhouse', name: 'Calibrate Hydroponic Valve', type: 'valve_calibrate', x: 1950, y: 420 },
  { id: 't_green_sample', room: 'Greenhouse', name: 'Inspect Flora Culture', type: 'sample_scan', x: 2150, y: 550 },
  { id: 't_comms_freq', room: 'Communications', name: 'Tune Radio Frequency', type: 'frequency_tune', x: 2050, y: 1450 },
  { id: 't_comms_divert', room: 'Communications', name: 'Align Radar Relay', type: 'divert_power', x: 1850, y: 1550 },
  { id: 't_obs_freq', room: 'Observatory', name: 'Sync Telescope Oscilloscope', type: 'frequency_tune', x: 1200, y: 250 },
  { id: 't_med_sample', room: 'Medical Center', name: 'Complete Bio-Scan', type: 'sample_scan', x: 850, y: 700 },
  { id: 't_store_valve', room: 'Storage', name: 'Purge Fuel Pressure Valve', type: 'valve_calibrate', x: 1200, y: 1600 },
  { id: 't_work_wiring', room: 'Workshop', name: 'Rewire Calibration Rig', type: 'wiring', x: 1550, y: 700 }
];

export function calculateRoleDistribution(playerCount: number, requestedImpostors?: number): Role[] {
  let impostors = 1;
  if (requestedImpostors !== undefined && requestedImpostors > 0) {
    impostors = requestedImpostors;
  } else {
    if (playerCount >= 9) {
      impostors = 3;
    } else if (playerCount >= 6) {
      impostors = 2;
    } else {
      impostors = 1;
    }
  }

  // Ensure impostors never exceed parity at start
  const maxAllowedImpostors = Math.floor((playerCount - 1) / 2);
  impostors = Math.max(1, Math.min(impostors, maxAllowedImpostors));

  const villagers = playerCount - impostors;
  const roles: Role[] = [];

  for (let i = 0; i < impostors; i++) {
    roles.push('impostor');
  }
  for (let i = 0; i < villagers; i++) {
    roles.push('villager');
  }

  return roles;
}
