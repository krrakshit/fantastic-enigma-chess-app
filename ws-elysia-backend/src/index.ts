import { Elysia, t } from "elysia";

// --- Types ---
type Type = "start" | "join";

type Message = {
  content: Type;
  uid: string;
};

type Room = {
  roomId: string;
  player1Id: string;
  player1Socket: any;
  player2Id?: string;
  player2Socket?: any;
};

// --- State ---
// Queue to store waiting rooms
const roomQueue: Room[] = [];

// Store active connections with player ID
const playerConnections = new Map<string, any>();

// Store rooms by roomId
const activeRooms = new Map<string, Room>();

// --- Helpers ---
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function sendMessage(ws: any, type: string, data: Record<string, any>) {
  ws.send(JSON.stringify({ type, ...data }));
}

// --- Server ---
const app = new Elysia()
  .ws("/ws", {
    open(ws) {
      const clientId = Math.random().toString(36).substring(2, 11);
      console.log("Player connected:", clientId);
      sendMessage(ws, "connected", {
        status: "connected_to_server",
      });
    },
    message(ws, data) {
      try {
        // Bun's ws gives us the raw data; parse it
        const message: Message =
          typeof data === "string" ? JSON.parse(data) : data;
        console.log("Received message:", message);

        if (message.content === "start") {
          console.log(`Player ${message.uid} wants to start a game`);

          // Store connection mapping
          playerConnections.set(message.uid, ws);

          if (roomQueue.length === 0) {
            // Queue is empty ─ create new room with player 1
            const roomId = generateRoomId();
            const newRoom: Room = {
              roomId,
              player1Id: message.uid,
              player1Socket: ws,
            };
            roomQueue.push(newRoom);
            activeRooms.set(roomId, newRoom);
            console.log(`Room created: ${roomId} for player ${message.uid}`);

            // Send acknowledgment to player 1
            sendMessage(ws, "room_created", {
              roomId,
              status: "waiting_for_opponent",
            });
          } else {
            // Queue has waiting room ─ match with player 2
            const existingRoom = roomQueue.pop() as Room;
            existingRoom.player2Id = message.uid;
            existingRoom.player2Socket = ws;

            console.log(
              `Room ${existingRoom.roomId} matched: Player1=${existingRoom.player1Id}, Player2=${existingRoom.player2Id}`,
            );

            // Send room details to player 2
            sendMessage(ws, "room_matched", {
              roomId: existingRoom.roomId,
              player1Id: existingRoom.player1Id,
              player2Id: existingRoom.player2Id,
            });

            // Notify player 1 about the match
            sendMessage(existingRoom.player1Socket, "opponent_joined", {
              roomId: existingRoom.roomId,
              player2Id: existingRoom.player2Id,
            });

            console.log(`Match ready: ${existingRoom.roomId}`);
          }
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    },
    close(ws) {
      console.log("Player disconnected");
    },
  })
  .listen(3000);

console.log(
  `🦊 WebSocket server is running at ${app.server?.hostname}:${app.server?.port}`,
);
