import { AccessToken } from "livekit-server-sdk";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const { roomName, participantName } = req.body || {};

    if (!roomName || !participantName) {
      return res.status(400).json({
        error: "roomName и participantName обязательны",
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: "LiveKit credentials не настроены",
      });
    }

    const token = new AccessToken(
      apiKey,
      apiSecret,
      {
        identity: participantName,
        name: participantName,
      }
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return res.status(200).json({
      token: jwt,
    });

  } catch (error) {
    console.error(
      "LiveKit token error:",
      error
    );

    return res.status(500).json({
      error: "Не удалось создать LiveKit token",
    });
  }
}
