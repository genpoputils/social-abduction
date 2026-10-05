import {
  PlayerGameState,
  ChatMessage,
  CharacterType,
  SabotageType
} from '../engine/types';

// ==========================================
// Client/Peer -> Host Messages
// ==========================================

export interface PlayerJoinMessage {
  type: 'PLAYER_JOIN';
  payload: {
    playerId: string;
    name: string;
    character?: CharacterType;
    color?: string;
  };
}

export interface PlayerUpdateCustomizationMessage {
  type: 'PLAYER_CUSTOMIZE';
  payload: {
    name?: string;
    character?: CharacterType;
    color?: string;
  };
}

export interface GameStartMessage {
  type: 'GAME_START';
  payload: Record<string, never>;
}

export interface PlayerMoveMessage {
  type: 'PLAYER_MOVE';
  payload: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: 'left' | 'right';
    isMoving: boolean;
  };
}

export interface CompleteTaskMessage {
  type: 'TASK_COMPLETED';
  payload: {
    taskId: string;
  };
}

export interface KillPlayerMessage {
  type: 'KILL_PLAYER';
  payload: {
    targetId: string;
  };
}

export interface ReportBodyMessage {
  type: 'REPORT_BODY';
  payload: {
    bodyId: string;
  };
}

export interface CallEmergencyMessage {
  type: 'CALL_EMERGENCY';
  payload: Record<string, never>;
}

export interface CastVoteMessage {
  type: 'CAST_VOTE';
  payload: {
    targetId: string | null; // null represents Skip
  };
}

export interface TriggerSabotageMessage {
  type: 'TRIGGER_SABOTAGE';
  payload: {
    type: SabotageType;
  };
}

export interface FixSabotageMessage {
  type: 'FIX_SABOTAGE';
  payload: Record<string, never>;
}

export interface SendChatMessage {
  type: 'CHAT_MESSAGE';
  payload: {
    text: string;
  };
}

export interface GameRematchMessage {
  type: 'GAME_REMATCH';
  payload: Record<string, never>;
}

export interface PingMessage {
  type: 'PING';
  payload: Record<string, never>;
}

export type PeerToHostMessage =
  | PlayerJoinMessage
  | PlayerUpdateCustomizationMessage
  | GameStartMessage
  | PlayerMoveMessage
  | CompleteTaskMessage
  | KillPlayerMessage
  | ReportBodyMessage
  | CallEmergencyMessage
  | CastVoteMessage
  | TriggerSabotageMessage
  | FixSabotageMessage
  | SendChatMessage
  | GameRematchMessage
  | PingMessage;

// ==========================================
// Host -> Client/Peer Messages
// ==========================================

export interface RoomJoinedMessage {
  type: 'ROOM_JOINED';
  payload: {
    roomId: string;
    playerId: string;
    isHost: boolean;
  };
}

export interface GameStateMessage {
  type: 'GAME_STATE';
  payload: {
    state: PlayerGameState;
  };
}

export interface PositionsSyncMessage {
  type: 'POSITIONS_SYNC';
  payload: {
    positions: Array<{
      playerId: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      facing: 'left' | 'right';
      isMoving: boolean;
    }>;
  };
}

export interface ChatBroadcastMessage {
  type: 'CHAT_BROADCAST';
  payload: {
    message: ChatMessage;
  };
}

export interface GameErrorMessage {
  type: 'GAME_ERROR';
  payload: {
    message: string;
  };
}

export interface PongMessage {
  type: 'PONG';
  payload: Record<string, never>;
}

export type HostToPeerMessage =
  | RoomJoinedMessage
  | GameStateMessage
  | PositionsSyncMessage
  | ChatBroadcastMessage
  | GameErrorMessage
  | PongMessage;

export type GameMessage = PeerToHostMessage | HostToPeerMessage;
