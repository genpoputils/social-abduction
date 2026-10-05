import { CharacterArchetype, CharacterType, GameSettings, Role, TaskDefinition } from './types';

export const CHARACTER_ARCHETYPES: Record<CharacterType, CharacterArchetype> = {
  engineer: {
    id: 'engineer',
    name: 'Chief Engineer',
    roleHint: 'Industrial cap, utility jacket & tool harness',
    color: '#f59e0b',
    accentColor: '#b45309',
    description: 'Maintains heavy settlement conduits, high-voltage transformers, and power relays.'
  },
  researcher: {
    id: 'researcher',
    name: 'Lead Researcher',
    roleHint: 'Scholar coat, data tablet & optical specs',
    color: '#3b82f6',
    accentColor: '#1d4ed8',
    description: 'Decodes celestial telemetry, star coordinates, and archives settlement records.'
  },
  medic: {
    id: 'medic',
    name: 'Settlement Physician',
    roleHint: 'Physician coat, medical cross & bio-pack',
    color: '#06b6d4',
    accentColor: '#0e7490',
    description: 'Monitors vital signs, quarantines biological samples, and treats injured crew.'
  },
  botanist: {
    id: 'botanist',
    name: 'Field Botanist',
    roleHint: 'Expedition brim hat, flora satchel & shears',
    color: '#10b981',
    accentColor: '#047857',
    description: 'Cultivates bioluminescent hydroponic flora and maintains oxygen filtration.'
  },
  mechanic: {
    id: 'mechanic',
    name: 'Master Machinist',
    roleHint: 'Heavy work overalls, bandanna & wrench',
    color: '#ef4444',
    accentColor: '#b91c1c',
    description: 'Operates heavy hydraulic valves, pressure regulators, and workshop machinery.'
  },
  scout: {
    id: 'scout',
    name: 'Perimeter Scout',
    roleHint: 'Hooded traveler cloak, brass lantern & compass',
    color: '#14b8a6',
    accentColor: '#0f766e',
    description: 'Navigates peripheral perimeter walls, ventilation passages, and storage routes.'
  },
  scientist: {
    id: 'scientist',
    name: 'Systems Technician',
    roleHint: 'Insulated synth-vest, sensor headset & antenna',
    color: '#a855f7',
    accentColor: '#7e22ce',
    description: 'Calibrates radio frequency relays, radar beacons, and automated laboratory diagnostics.'
  },
  security: {
    id: 'security',
    name: 'Watch Constable',
    roleHint: 'Tactical patrol coat, officer badge & flashlight',
    color: '#64748b',
    accentColor: '#334155',
    description: 'Enforces the midnight curfew, guards the central bell tower, and investigates security breaches.'
  }
};

export const CHARACTER_LIST: CharacterArchetype[] = Object.values(CHARACTER_ARCHETYPES);

export function getRoleDisplayName(role: Role | string): 'Resident' | 'Mimic' {
  return (role === 'impostor' || role === 'mimic') ? 'Mimic' : 'Resident';
}

export function getTeamDisplayName(team: string): string {
  return (team === 'impostors' || team === 'mimics') ? 'Mimics' : 'Residents';
}

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
  { id: 't_power_wiring', room: 'Power Station', name: 'Repair Generator Conduit Wiring', type: 'wiring', x: 450, y: 1450 },
  { id: 't_power_divert', room: 'Power Station', name: 'Calibrate Auxiliary Breakers', type: 'divert_power', x: 620, y: 1520 },
  { id: 't_lab_sample', room: 'Laboratory', name: 'Analyze Chemical Specimen', type: 'sample_scan', x: 420, y: 450 },
  { id: 't_lab_wiring', room: 'Laboratory', name: 'Rewire Centrifuge Terminal', type: 'wiring', x: 650, y: 380 },
  { id: 't_green_valve', room: 'Greenhouse', name: 'Calibrate Hydroponic Irrigation', type: 'valve_calibrate', x: 1950, y: 420 },
  { id: 't_green_sample', room: 'Greenhouse', name: 'Sample Bioluminescent Flora', type: 'sample_scan', x: 2150, y: 550 },
  { id: 't_comms_freq', room: 'Communications', name: 'Tune Radio Transceiver Frequency', type: 'frequency_tune', x: 2050, y: 1450 },
  { id: 't_comms_divert', room: 'Communications', name: 'Align Long-Range Radar Relay', type: 'divert_power', x: 1850, y: 1550 },
  { id: 't_obs_freq', room: 'Observatory', name: 'Calibrate Astronomical Telescope', type: 'frequency_tune', x: 1200, y: 250 },
  { id: 't_med_sample', room: 'Medical Center', name: 'Complete Physiological Bio-Scan', type: 'sample_scan', x: 850, y: 700 },
  { id: 't_store_valve', room: 'Storage', name: 'Purge Fuel Pressure Reservoir', type: 'valve_calibrate', x: 1200, y: 1600 },
  { id: 't_work_wiring', room: 'Workshop', name: 'Rewire Tool Calibration Bench', type: 'wiring', x: 1550, y: 700 }
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

  const distribution: Role[] = [];
  for (let i = 0; i < impostors; i++) {
    distribution.push('impostor');
  }
  while (distribution.length < playerCount) {
    distribution.push('villager');
  }
  return distribution;
}
