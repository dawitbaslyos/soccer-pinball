import { TacticalFormation } from '../types';

export const PRESET_FORMATIONS: TacticalFormation[] = [
  {
    id: 'classic',
    name: 'Classic Trio',
    badge: '📐 3 Players',
    description: 'Balanced lineup with 1 Defender, 1 Midfielder, and 1 Striker.',
    players: [
      { role: 'defender', x: 0, z: 4.2, facingAngle: 0 },
      { role: 'midfielder', x: -1.8, z: 0.8, facingAngle: -0.2 },
      { role: 'striker', x: 1.8, z: -2.6, facingAngle: 0.2 },
    ],
  },
  {
    id: 'all_out_attack',
    name: 'Attack Trio',
    badge: '🔥 3 Players',
    description: 'High forward pressure with Striker, Cannon, and Midfielder.',
    players: [
      { role: 'striker', x: -2.0, z: -3.8, facingAngle: 0.2 },
      { role: 'cannon', x: 1.8, z: -4.2, facingAngle: -0.2 },
      { role: 'midfielder', x: 0, z: 1.2, facingAngle: 0 },
    ],
  },
  {
    id: 'iron_wall',
    name: 'Iron Defense',
    badge: '🛡️ 3 Players',
    description: 'Deep defense with Defender, Midfielder, and Cannon counter.',
    players: [
      { role: 'defender', x: -1.8, z: 4.5, facingAngle: 0 },
      { role: 'midfielder', x: 1.5, z: 1.0, facingAngle: 0 },
      { role: 'cannon', x: 0, z: -2.5, facingAngle: 0 },
    ],
  },
  {
    id: 'counter_surge',
    name: 'Counter Surge',
    badge: '⚡ 3 Players',
    description: 'Direct transition counter with Defender, Striker, and Cannon.',
    players: [
      { role: 'defender', x: 0, z: 4.8, facingAngle: 0 },
      { role: 'cannon', x: -2.2, z: -2.0, facingAngle: 0.25 },
      { role: 'striker', x: 2.2, z: -4.0, facingAngle: -0.2 },
    ],
  },
];
