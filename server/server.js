"use strict";

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  AccessToken,
  RoomServiceClient
} from "livekit-server-sdk";


/*
==================================================
PATHS
==================================================
*/

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const ROOT =
  path.resolve(
    __dirname,
    ".."
  );


/*
==================================================
PORT
==================================================
*/

const PORT =
  Number(
    process.env.PORT || 3000
  );


/*
==================================================
LIVEKIT
==================================================

ВАЖНО:

Эти значения должны находиться
ТОЛЬКО в переменных окружения сервера.

LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET

API SECRET никогда не помещаем
в frontend.
==================================================
*/

const LIVEKIT_URL =
  process.env.LIVEKIT_URL ||
  "wss://videocall-p12xui02.livekit.cloud";

const LIVEKIT_API_KEY =
  process.env.LIVEKIT_API_KEY ||
  "";

const LIVEKIT_API_SECRET =
  process.env.LIVEKIT_API_SECRET ||
  "";


/*
==================================================
ПРОВЕРКА LIVEKIT
==================================================
*/

function livekitConfigured() {

  return (
    Boolean(LIVEKIT_URL) &&
    Boolean(LIVEKIT_API_KEY) &&
    Boolean(LIVEKIT_API_SECRET)
  );

}


/*
==================================================
LIVEKIT ROOM SERVICE
==================================================
*/

const livekitHost =
  LIVEKIT_URL
    .replace(
      /^wss:/,
      "https:"
    )
    .replace(
      /^ws:/,
      "http:"
    );

const roomService =
  livekitConfigured()
    ? new RoomServiceClient(
        livekitHost,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
      )
    : null;


/*
==================================================
HTTP HELPERS
==================================================
*/

function sendJSON(
  res,
  status,
  data
) {

  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Cache-Control":
        "no-store",

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Headers":
        "Content-Type",

      "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS"
    }
  );

  res.end(
    JSON.stringify(data)
  );

}


/*
==================================================
READ JSON BODY
==================================================
*/

function readJSON(req) {

  return new Promise(
    (resolve, reject) => {

      let body = "";

      req.on(
        "data",
        chunk => {

          body += chunk.toString();

          if (
            body.length >
            1024 * 100
          ) {

            reject(
              new Error(
                "Request body too large"
              )
            );

            req.destroy();

          }

        }
      );

      req.on(
        "end",
        () => {

          if (!body) {

            resolve({});

            return;

          }

          try {

            resolve(
              JSON.parse(body)
            );

          } catch {

            reject(
              new Error(
                "Invalid JSON"
              )
            );

          }

        }
      );

      req.on(
        "error",
        reject
      );

    }
  );

}


/*
==================================================
ROOM CODE
==================================================
*/

function normalizeRoomCode(
  value
) {

  return String(
    value || ""
  )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    )
    .slice(
      0,
      6
    );

}


/*
==================================================
IDENTITY
==================================================
*/

function normalizeIdentity(
  value
) {

  const identity =
    String(
      value || ""
    )
      .trim()
      .slice(
        0,
        100
      );

  if (!identity) {

    return (
      "user-" +
      crypto.randomUUID()
    );

  }

  return identity;

}


/*
==================================================
CREATE LIVEKIT TOKEN
==================================================
*/

async function createLiveKitToken(
  roomCode,
  identity
) {

  if (!livekitConfigured()) {

    throw new Error(
      "LiveKit не настроен на сервере. " +
      "Добавьте LIVEKIT_API_KEY и LIVEKIT_API_SECRET."
    );

  }

  const roomName =
    "vc-" +
    roomCode;


  /*
  Создаём комнату заранее.

  Если она уже существует —
  просто продолжаем.

  Максимум 2 участника.
  */

  if (roomService) {

    try {

      await roomService.createRoom({

        name:
          roomName,

        emptyTimeout:
          300,

        maxParticipants:
          2

      });

    } catch (error) {

      /*
      Комната уже существует —
      это нормально.

      Для других ошибок
      продолжаем к token generation,
      потому что LiveKit может
      сообщить о состоянии комнаты
      отдельно.
      */

      const message =
        String(
          error?.message ||
          ""
        ).toLowerCase();

      if (
        !message.includes(
          "already exists"
        ) &&
        !message.includes(
          "already_exist"
        ) &&
        !message.includes(
          "resource_exhausted"
        )
      ) {

        console.warn(
          "LiveKit createRoom:",
          error.message
        );

      }

    }

  }


  /*
  Создаём короткоживущий токен.

  TTL = 2 часа.
  */

  const token =
    new AccessToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      {
        identity,

        ttl:
          "2h"
      }
    );


  token.addGrant({

    roomJoin:
      true,

    room:
      roomName,

    canPublish:
      true,

    canSubscribe:
      true

  });


  const participantToken =
    await token.toJwt();


  return {

    serverUrl:
      LIVEKIT_URL,

    participantToken,

    roomName

  };

}


/*
==================================================
HTTP SERVER
==================================================
*/

const server =
  http.createServer(
    async (
      req,
      res
    ) => {

      try {

        /*
        ==========================================
        OPTIONS
        ==========================================
        */

        if (
          req.method ===
          "OPTIONS"
        ) {

          sendJSON(
            res,
            204,
            {}
          );

          return;

        }


        /*
        ==========================================
        HEALTH
        ==========================================
        */

        if (
          req.url ===
            "/health" ||
          req.url ===
            "/api/health"
        ) {

          sendJSON(
            res,
            200,
            {
              ok:
                true,

              livekit:
                livekitConfigured()
            }
          );

          return;

        }


        /*
        ==========================================
        LIVEKIT TOKEN
        ==========================================
        */

        if (
          req.url ===
            "/api/livekit/token" &&
          req.method ===
            "POST"
        ) {

          const body =
            await readJSON(req);


          const roomCode =
            normalizeRoomCode(
              body.roomCode
            );


          if (
            roomCode.length !==
            6
          ) {

            sendJSON(
              res,
              400,
              {
                ok:
                  false,

                error:
                  "Неверный код звонка."
              }
            );

            return;

          }


          const identity =
            normalizeIdentity(
              body.identity
            );


          const result =
            await createLiveKitToken(
              roomCode,
              identity
            );


          sendJSON(
            res,
            200,
            {
              ok:
                true,

              ...result
            }
          );

          return;

        }


        /*
        ==========================================
        STATIC FILES
        ==========================================
        */

        let requestPath =
          req.url
            .split("?")[0];


        if (
          requestPath ===
          "/"
        ) {

          requestPath =
            "/index.html";

        }


        /*
        Защита от path traversal.
        */

        const safePath =
          path.normalize(
            requestPath
          );


        if (
          safePath.includes(
            ".."
          )
        ) {

          res.writeHead(
            400
          );

          res.end(
            "Bad request"
          );

          return;

        }


        const filePath =
          path.join(
            ROOT,
            safePath
          );


        if (
          !filePath.startsWith(
            ROOT
          )
        ) {

          res.writeHead(
            403
          );

          res.end(
            "Forbidden"
          );

          return;

        }


        fs.readFile(
          filePath,
          (
            error,
            data
          ) => {

            if (error) {

              res.writeHead(
                404
              );

              res.end(
                "Not found"
              );

              return;

            }


            const ext =
              path.extname(
                filePath
              )
                .toLowerCase();


            const contentTypes = {

              ".html":
                "text/html; charset=utf-8",

              ".css":
                "text/css; charset=utf-8",

              ".js":
                "application/javascript; charset=utf-8",

              ".json":
                "application/json; charset=utf-8",

              ".svg":
                "image/svg+xml",

              ".png":
                "image/png",

              ".jpg":
                "image/jpeg",

              ".jpeg":
                "image/jpeg",

              ".webp":
                "image/webp"

            };


            res.writeHead(
              200,
              {

                "Content-Type":
                  contentTypes[ext] ||
                  "application/octet-stream",

                "Cache-Control":
                  ext === ".html"
                    ? "no-cache"
                    : "public, max-age=3600"

              }
            );


            res.end(
              data
            );

          }
        );

      } catch (error) {

        console.error(
          "Server error:",
          error
        );


        sendJSON(
          res,
          500,
          {
            ok:
              false,

            error:
              error.message ||
              "Внутренняя ошибка сервера"
          }
        );

      }

    }
  );


/*
==================================================
START
==================================================
*/

server.listen(
  PORT,
  () => {

    console.log(
      `Video Call server listening on port ${PORT}`
    );

    console.log(
      `LiveKit URL: ${LIVEKIT_URL}`
    );

    console.log(
      `LiveKit configured: ${livekitConfigured()}`
    );

  }
);
