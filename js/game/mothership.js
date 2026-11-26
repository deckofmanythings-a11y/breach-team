// Mothership actions (shared by the browser and boarding-api). New file: new names come from new files.
import { GameError } from './rules.js';
import { MS_ROOM_BY_ID, roomLevel, nextRoomPrice } from '../data/mothership-rooms.js';

// Build a room (level 0 -> 1) or upgrade it one level, paid in CREDs.
export function buildRoom(g, id) {
  const room = MS_ROOM_BY_ID[id];
  if (!room) throw new GameError('No such room.');
  if (room.soon) throw new GameError(`The ${room.name} arrives ${room.soon}.`);
  const price = nextRoomPrice(g, id);
  if (price === null) throw new GameError(`The ${room.name} is already fully upgraded.`);
  if ((g.creds || 0) < price) throw new GameError(`Not enough CREDs (need ${price.toLocaleString()}).`);
  g.creds -= price;
  g.mothership ||= {};
  g.mothership.rooms ||= {};
  const level = roomLevel(g, id) + 1;
  g.mothership.rooms[id] = level;
  return { room: id, level, spent: price };
}
