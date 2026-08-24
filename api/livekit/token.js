import { AccessToken } from "livekit-server-sdk";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const {
      roomCode,
      identity,
    } = req.body || {};

    if (!roomCode) {
      return res.status(400).json({
        ok: false,
        error: "roomCode обязателен",
      });
    }

    const apiKey =
      process.env.LIVEKIT_API_KEY;

    const apiSecret =
      process.env.LIVEKIT_API_SECRET;

    const serverUrl =
      process.env.LIVEKIT_URL;

    if (
      !apiKey ||
      !apiSecret ||
      !serverUrl
    ) {
      return res.status(500).json({
        ok: false,
        error:
          "LiveKit credentials не настроены",
      });
    }

    const cleanRoomCode =
      String(roomCode)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);

    if (cleanRoomCode.length !== 6) {
      return res.status(400).json({
        ok: false,
        error:
          "Код комнаты должен содержать 6 символов",
      });
    }

    const roomName =
      "vc-" + cleanRoomCode;

    const participantName =
      String(
        identity ||
        "user-" +
          Math.random()
            .toString(36)
            .slice(2)
      ).slice(0, 100);

    const token =
      new AccessToken(
        apiKey,
        apiSecret,
        {
          identity:
            participantName,

          name:
            participantName,

          ttl:
            "2h",
        }
      );

    token.addGrant({
      roomJoin: true,

      room:
        roomName,

      canPublish: true,

      canSubscribe: true,

      canPublishData: true,
    });

    const jwt =
      await token.toJwt();

    return res.status(200).json({
      ok: true,

      token: jwt,

      participantToken: jwt,

      serverUrl,

      roomName,

      identity:
        participantName,
    });

  } catch (error) {

    console.error(
      "LiveKit token error:",
      error
    );

    return res.status(500).json({
      ok: false,

      error:
        error?.message ||
        "Не удалось создать LiveKit token",
    });
  }
}
