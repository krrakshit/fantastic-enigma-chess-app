import WebSocket, { WebSocketServer } from "ws";

type Type = "start" | "join";

type Message = {
  content: Type;
  uid: string;
};

type Room = {
  roomId: string;
  player1Id: string;
  player1Socket: WebSocket;
  player2Id?: string;
  player2Socket?: WebSocket;
};

// Queue to store waiting rooms
const roomQueue: Room[] = [];

// Store active connections with player ID
const playerConnections = new Map<string, WebSocket>();

// Store rooms by roomId
const activeRooms = new Map<string, Room>();

// Generate random room ID
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Send message as JSON
function sendMessage(ws: WebSocket, type: string, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws: WebSocket) => {
  const clientId = Math.random().toString(36).substring(2, 11);
  console.log("Player connected:", clientId);

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const message: Message = JSON.parse(data.toString());
      console.log(`Received message from ${clientId}:`, message);

      if (message.content === "start") {
        console.log(`Player ${message.uid} wants to start a game`);

        // Store connection mapping
        playerConnections.set(message.uid, ws);

        if (roomQueue.length === 0) {
          // Queue is empty - create new room with player 1
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
          // Queue has waiting room - match with player 2
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
          if (existingRoom.player1Socket.readyState === WebSocket.OPEN) {
            sendMessage(existingRoom.player1Socket, "opponent_joined", {
              roomId: existingRoom.roomId,
              player2Id: existingRoom.player2Id,
            });
          }

          console.log(`Match ready: ${existingRoom.roomId}`);
        }
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Player disconnected:", clientId);
  });

  ws.on("error", (error: any) => {
    console.error("WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:3000");
