"use strict";

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { WebSocketServer } from "ws";


/*
==================================================
PATHS
==================================================
*/

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

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
    process.env.PORT ||
    3000
  );


/*
==================================================
TURN CONFIG
==================================================

Добавь эти переменные
на сервере:

TURN_USERNAME
TURN_CREDENTIAL

TURN_URL можно не задавать.
==================================================
*/

const TURN_USERNAME =
  process.env.TURN_USERNAME ||
  "";

const TURN_CREDENTIAL =
  process.env.TURN_CREDENTIAL ||
  "";

const TURN_HOST =
  process.env.TURN_HOST ||
  "global.relay.metered.ca";


/*
==================================================
ROOMS
==================================================

roomId -> Set<WebSocket>
==================================================
*/

const rooms =
  new Map();


/*
==================================================
HTTP SERVER
==================================================
*/

const server =
  http.createServer(
    (req, res) => {

      /*
      -------------------------------
      TURN CONFIG
      -------------------------------
      */

      if (
        req.url ===
        "/turn"
      ) {

        const iceServers = [

          {
            urls:
              "stun:stun.relay.metered.ca:80"
          }

        ];


        if (
          TURN_USERNAME &&
          TURN_CREDENTIAL
        ) {

          iceServers.push(

            {
              urls:
                `turn:${TURN_HOST}:80`,

              username:
                TURN_USERNAME,

              credential:
                TURN_CREDENTIAL
            },

            {
              urls:
                `turn:${TURN_HOST}:80?transport=tcp`,

              username:
                TURN_USERNAME,

              credential:
                TURN_CREDENTIAL
            },

            {
              urls:
                `turn:${TURN_HOST}:443`,

              username:
                TURN_USERNAME,

              credential:
                TURN_CREDENTIAL
            },

            {
              urls:
                `turns:${TURN_HOST}:443?transport=tcp`,

              username:
                TURN_USERNAME,

              credential:
                TURN_CREDENTIAL
            }

          );

        }


        res.writeHead(
          200,
          {
            "Content-Type":
              "application/json",

            "Cache-Control":
              "no-store",

            "Access-Control-Allow-Origin":
              "*"
          }
        );

        res.end(
          JSON.stringify(
            {
              iceServers
            }
          )
        );

        return;

      }


      /*
      -------------------------------
      STATIC FILE
      -------------------------------
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

    }
  );


/*
==================================================
WEBSOCKET
==================================================
*/

const wss =
  new WebSocketServer(
    {
      server
    }
  );


/*
==================================================
HELPERS
==================================================
*/

function send(
  ws,
  message
) {

  if (
    ws.readyState ===
      ws.OPEN
  ) {

    ws.send(
      JSON.stringify(
        message
      )
    );

  }

}


function broadcast(
  room,
  sender,
  message
) {

  for (
    const client of room
  ) {

    if (
      client !== sender
    ) {

      send(
        client,
        message
      );

    }

  }

}


/*
==================================================
ROOM CLEANUP
==================================================
*/

function removeFromRoom(
  ws
) {

  const roomId =
    ws.roomId;

  if (!roomId) {

    return;

  }


  const room =
    rooms.get(
      roomId
    );

  if (!room) {

    return;

  }


  room.delete(
    ws
  );


  /*
  Сообщаем второму пользователю.
  */

  broadcast(
    room,
    ws,
    {
      type:
        "peer-left"
    }
  );


  if (
    room.size === 0
  ) {

    rooms.delete(
      roomId
    );

  }


  ws.roomId =
    null;

}


/*
==================================================
WEBSOCKET CONNECTION
==================================================
*/

wss.on(
  "connection",
  ws => {

    ws.id =
      crypto.randomUUID();

    ws.roomId =
      null;


    send(
      ws,
      {
        type:
          "connected"
      }
    );


    ws.on(
      "message",
      raw => {

        try {

          const message =
            JSON.parse(
              raw.toString()
            );


          const type =
            message.type;


          const roomId =
            String(
              message.roomId ||
              ""
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


          /*
          ========================================
          CREATE
          ========================================
          */

          if (
            type ===
            "create"
          ) {

            if (
              !roomId
            ) {

              return;

            }


            /*
            Если сокет уже был
            в другой комнате.
            */

            removeFromRoom(
              ws
            );


            let room =
              rooms.get(
                roomId
              );


            if (
              room &&
              room.size
            ) {

              send(
                ws,
                {
                  type:
                    "room-full"
                }
              );

              return;

            }


            if (!room) {

              room =
                new Set();

              rooms.set(
                roomId,
                room
              );

            }


            room.add(
              ws
            );

            ws.roomId =
              roomId;


            send(
              ws,
              {
                type:
                  "created"
              }
            );

            return;

          }


          /*
          ========================================
          JOIN
          ========================================
          */

          if (
            type ===
            "join"
          ) {

            if (
              !roomId
            ) {

              return;

            }


            const room =
              rooms.get(
                roomId
              );


            if (!room) {

              send(
                ws,
                {
                  type:
                    "room-not-found"
                }
              );

              return;

            }


            if (
              room.size >= 2
            ) {

              send(
                ws,
                {
                  type:
                    "room-full"
                }
              );

              return;

            }


            room.add(
              ws
            );

            ws.roomId =
              roomId;


            send(
              ws,
              {
                type:
                  "joined"
              }
            );


            broadcast(
              room,
              ws,
              {
                type:
                  "peer-joined"
              }
            );

            return;

          }


          /*
          ========================================
          OFFER
          ========================================
          */

          if (
            type ===
            "offer"
          ) {

            const room =
              rooms.get(
                ws.roomId
              );

            if (!room) {

              return;

            }

            broadcast(
              room,
              ws,
              {
                type:
                  "offer",

                offer:
                  message.offer
              }
            );

            return;

          }


          /*
          ========================================
          ANSWER
          ========================================
          */

          if (
            type ===
            "answer"
          ) {

            const room =
              rooms.get(
                ws.roomId
              );

            if (!room) {

              return;

            }

            broadcast(
              room,
              ws,
              {
                type:
                  "answer",

                answer:
                  message.answer
              }
            );

            return;

          }


          /*
          ========================================
          ICE
          ========================================
          */

          if (
            type ===
            "ice"
          ) {

            const room =
              rooms.get(
                ws.roomId
              );

            if (!room) {

              return;

            }

            broadcast(
              room,
              ws,
              {
                type:
                  "ice",

                candidate:
                  message.candidate
              }
            );

            return;

          }


          /*
          ========================================
          LEAVE
          ========================================
          */

          if (
            type ===
            "leave"
          ) {

            removeFromRoom(
              ws
            );

            return;

          }


          /*
          ========================================
          REJECT
          ========================================
          */

          if (
            type ===
            "reject"
          ) {

            const room =
              rooms.get(
                ws.roomId
              );

            if (!room) {

              return;

            }

            broadcast(
              room,
              ws,
              {
                type:
                  "rejected"
              }
            );

            return;

          }

        } catch (error) {

          console.error(
            "WebSocket message error:",
            error
          );

        }

      }
    );


    ws.on(
      "close",
      () => {

        removeFromRoom(
          ws
        );

      }
    );


    ws.on(
      "error",
      error => {

        console.error(
          "WebSocket error:",
          error
        );

      }
    );

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

  }
);
