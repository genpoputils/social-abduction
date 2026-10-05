import { MidnightVillageGame } from './midnight-village-game';
import { calculateRoleDistribution } from './roles';
import { Player } from './types';

function createMockPlayer(id: string, name: string, isHost = false): Player {
  return {
    id,
    name,
    isHost,
    isAlive: true,
    connected: true,
    character: 'engineer',
    color: '#f59e0b',
    x: 1200,
    y: 950,
    tasks: [],
    killCooldownRemaining: 0,
    emergencyMeetingsRemaining: 1
  };
}

describe('MidnightVillageGame 2D Engine', () => {
  let game: MidnightVillageGame;

  beforeEach(() => {
    game = new MidnightVillageGame({ id: 'TEST01', settings: { minPlayers: 5 } });
  });

  describe('Role Distribution & Scaling', () => {
    it('scales impostor count accurately for 5, 6, 8, 10 players', () => {
      const r5 = calculateRoleDistribution(5);
      expect(r5.filter(r => r === 'impostor').length).toBe(1);
      expect(r5.filter(r => r === 'villager').length).toBe(4);

      const r6 = calculateRoleDistribution(6);
      expect(r6.filter(r => r === 'impostor').length).toBe(2);
      expect(r6.filter(r => r === 'villager').length).toBe(4);

      const r8 = calculateRoleDistribution(8);
      expect(r8.filter(r => r === 'impostor').length).toBe(2);
      expect(r8.filter(r => r === 'villager').length).toBe(6);

      const r10 = calculateRoleDistribution(10);
      expect(r10.filter(r => r === 'impostor').length).toBe(3);
      expect(r10.filter(r => r === 'villager').length).toBe(7);
    });
  });

  describe('Game Lifecycle & Start', () => {
    it('adds players and assigns positions', () => {
      const p1 = createMockPlayer('p1', 'Alice', true);
      const p2 = createMockPlayer('p2', 'Bob');

      expect(game.addPlayer(p1).success).toBe(true);
      expect(game.addPlayer(p2).success).toBe(true);
      expect(game.players.size).toBe(2);
    });

    it('rejects start if below minimum player count', () => {
      game.addPlayer(createMockPlayer('p1', 'Alice', true));
      game.addPlayer(createMockPlayer('p2', 'Bob'));
      const startResult = game.start();
      expect(startResult.success).toBe(false);
      expect(startResult.error).toContain('At least 5 players are required');
    });

    it('starts game, assigns roles and tasks, and transitions to starting', () => {
      for (let i = 1; i <= 5; i++) {
        game.addPlayer(createMockPlayer(`p${i}`, `Player ${i}`, i === 1));
      }

      const startResult = game.start();
      expect(startResult.success).toBe(true);
      expect(game.phase).toBe('starting');

      const players = Array.from(game.players.values());
      const impostors = players.filter(p => p.role === 'impostor');
      const villagers = players.filter(p => p.role === 'villager');

      expect(impostors.length).toBe(1);
      expect(villagers.length).toBe(4);

      for (const p of players) {
        expect(p.tasks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Roaming, Tasks & Kill Actions', () => {
    let pImpostor: Player;
    let pVillager1: Player;
    let pVillager2: Player;

    beforeEach(() => {
      pImpostor = createMockPlayer('imp1', 'Bad Guy', true);
      pImpostor.role = 'impostor';
      pImpostor.killCooldownRemaining = 0;

      pVillager1 = createMockPlayer('v1', 'Good Guy 1');
      pVillager1.role = 'villager';
      pVillager1.tasks = [
        { taskId: 't1', name: 'Fix Wiring', room: 'Power', type: 'wiring', completed: false }
      ];

      pVillager2 = createMockPlayer('v2', 'Good Guy 2');
      pVillager2.role = 'villager';

      game.players.set(pImpostor.id, pImpostor);
      game.players.set(pVillager1.id, pVillager1);
      game.players.set(pVillager2.id, pVillager2);

      game.phase = 'roaming';
    });

    it('allows villager to complete a task and advances completion count', () => {
      const res = game.completeTask('v1', 't1');
      expect(res.success).toBe(true);
      expect(pVillager1.tasks[0].completed).toBe(true);
      expect(game.getTotalTasksCompleted()).toBe(1);
    });

    it('allows impostor to kill a nearby villager and drops dead body', () => {
      pImpostor.x = 1000;
      pImpostor.y = 1000;
      pVillager1.x = 1050;
      pVillager1.y = 1000;

      const killRes = game.killPlayer('imp1', 'v1');
      expect(killRes.success).toBe(true);
      expect(pVillager1.isAlive).toBe(false);
      expect(game.deadBodies.length).toBe(1);
      expect(game.deadBodies[0].playerId).toBe('v1');
      expect(pImpostor.killCooldownRemaining).toBeGreaterThan(0);
    });

    it('rejects kill if target is too far away', () => {
      pImpostor.x = 500;
      pImpostor.y = 500;
      pVillager1.x = 1500;
      pVillager1.y = 1500;

      const killRes = game.killPlayer('imp1', 'v1');
      expect(killRes.success).toBe(false);
      expect(killRes.error).toContain('too far away');
      expect(pVillager1.isAlive).toBe(true);
    });
  });

  describe('Body Reporting & Emergency Meetings', () => {
    beforeEach(() => {
      const p1 = createMockPlayer('p1', 'Alice', true);
      const p2 = createMockPlayer('p2', 'Bob');
      game.players.set(p1.id, p1);
      game.players.set(p2.id, p2);
      game.phase = 'roaming';
    });

    it('allows discovering a dead body and triggers meeting', () => {
      game.deadBodies.push({
        id: 'body_1',
        playerId: 'p2',
        playerName: 'Bob',
        character: 'scientist',
        color: '#a855f7',
        x: 1200,
        y: 950
      });

      const reportRes = game.reportBody('p1', 'body_1');
      expect(reportRes.success).toBe(true);
      expect(game.phase).toBe('meeting');
      expect(game.meetingInfo?.reason).toBe('body_report');
      expect(game.meetingInfo?.callerName).toBe('Alice');
      expect(game.meetingInfo?.victimName).toBe('Bob');
      expect(game.deadBodies.length).toBe(0);
    });

    it('allows calling emergency meeting from Central Square siren', () => {
      const emergencyRes = game.callEmergencyMeeting('p1');
      expect(emergencyRes.success).toBe(true);
      expect(game.phase).toBe('meeting');
      expect(game.meetingInfo?.reason).toBe('emergency_button');
    });
  });

  describe('Voting & Ejection', () => {
    let p1: Player;
    let p2: Player;
    let p3: Player;

    beforeEach(() => {
      p1 = createMockPlayer('p1', 'Player 1');
      p1.role = 'impostor';
      p2 = createMockPlayer('p2', 'Player 2');
      p2.role = 'villager';
      p3 = createMockPlayer('p3', 'Player 3');
      p3.role = 'villager';

      game.players.set(p1.id, p1);
      game.players.set(p2.id, p2);
      game.players.set(p3.id, p3);

      game.phase = 'voting';
      game.phaseRemainingSeconds = 25;
    });

    it('ejects player with majority votes and reveals role in ejection result', () => {
      game.castVote('p2', 'p1');
      game.castVote('p3', 'p1');
      game.castVote('p1', 'p2');

      game.tick(30); // advance past voting

      expect(p1.isAlive).toBe(false);
      expect(game.phase).toBe('ejection');
      expect(game.ejectionResult?.ejectedId).toBe('p1');
      expect(game.ejectionResult?.ejectedRole).toBe('impostor');
      expect(game.ejectionResult?.remainingImpostors).toBe(0);
    });

    it('handles ties without ejection', () => {
      game.castVote('p1', 'p2');
      game.castVote('p2', 'p1');
      game.castVote('p3', null); // skip

      game.tick(30);

      expect(p1.isAlive).toBe(true);
      expect(p2.isAlive).toBe(true);
      expect(game.ejectionResult?.isTie).toBe(true);
      expect(game.ejectionResult?.ejectedId).toBeNull();
    });
  });

  describe('Win Conditions', () => {
    it('declares Villagers win when all Impostors are eliminated', () => {
      const p1 = createMockPlayer('imp1', 'Impostor');
      p1.role = 'impostor';
      p1.isAlive = false;

      const p2 = createMockPlayer('v1', 'Villager');
      p2.role = 'villager';
      p2.isAlive = true;

      game.players.set(p1.id, p1);
      game.players.set(p2.id, p2);

      const won = game.checkWinConditions();
      expect(won).toBe(true);
      expect(game.winner).toBe('villagers');
    });

    it('declares Impostors win on parity', () => {
      const p1 = createMockPlayer('imp1', 'Impostor');
      p1.role = 'impostor';
      p1.isAlive = true;

      const p2 = createMockPlayer('v1', 'Villager');
      p2.role = 'villager';
      p2.isAlive = true;

      game.players.set(p1.id, p1);
      game.players.set(p2.id, p2);

      const won = game.checkWinConditions();
      expect(won).toBe(true);
      expect(game.winner).toBe('impostors');
    });
  });
});
