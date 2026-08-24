"use strict";

/*
==================================================
VIDEO CALL
ЧИСТЫЙ WEBRTC + WEBSOCKET SIGNALING
==================================================
*/

/*
==================================================
DOM
==================================================
*/

const startScreen =
  document.getElementById("startScreen");

const callScreen =
  document.getElementById("callScreen");

const startButton =
  document.getElementById("startButton");

const joinButton =
  document.getElementById("joinButton");

const remoteIdInput =
  document.getElementById("remoteIdInput");

const startStatus =
  document.getElementById("startStatus");

const remoteVideo =
  document.getElementById("remoteVideo");

const localVideo =
  document.getElementById("localVideo");

const remotePlaceholder =
  document.getElementById("remotePlaceholder");

const remotePlaceholderText =
  document.getElementById("remotePlaceholderText");

const localPlaceholder =
  document.getElementById("localPlaceholder");

const connectionStatus =
  document.getElementById("connectionStatus");

const myPeerId =
  document.getElementById("myPeerId");

const copyMyIdButton =
  document.getElementById("copyMyIdButton");

const copyIdButton =
  document.getElementById("copyIdButton");

const micButton =
  document.getElementById("micButton");

const cameraButton =
  document.getElementById("cameraButton");

const switchCameraButton =
  document.getElementById(
    "switchCameraButton"
  );

const hangupButton =
  document.getElementById("hangupButton");

const incomingCall =
  document.getElementById("incomingCall");

const acceptCallButton =
  document.getElementById(
    "acceptCallButton"
  );

const rejectCallButton =
  document.getElementById(
    "rejectCallButton"
  );

const toast =
  document.getElementById("toast");


/*
==================================================
STATE
==================================================
*/

let socket = null;

let roomId = null;

let isHost = false;

let peerConnection = null;

let localStream = null;

let pendingIceCandidates = [];

let pendingIncoming = false;

let micEnabled = true;

let cameraEnabled = true;

let currentCamera = "user";

let reconnectTimer = null;


/*
==================================================
TURN / STUN
==================================================

Важное:
TURN credentials берём с signaling server
через /turn.

Постоянные Metered credentials
не храним здесь.
==================================================
*/

let iceServers = [
  {
    urls: [
      "stun:stun.relay.metered.ca:80"
    ]
  }
];


/*
==================================================
WEBSOCKET URL
==================================================
*/

function getWebSocketUrl() {

  const protocol =
    location.protocol === "https:"
      ? "wss:"
      : "ws:";

  return (
    protocol +
    "//" +
    location.host
  );

}


/*
==================================================
STATUS
==================================================
*/

function setStartStatus(text) {

  startStatus.textContent =
    text || "";

}


function setConnectionStatus(text) {

  connectionStatus.textContent =
    text || "";

}


/*
==================================================
TOAST
==================================================
*/

let toastTimer = null;

function showToast(message) {

  toast.textContent =
    message;

  toast.classList.remove(
    "hidden"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      2500
    );

}


/*
==================================================
SHOW SCREENS
==================================================
*/

function showStartScreen() {

  startScreen.classList.remove(
    "hidden"
  );

  callScreen.classList.add(
    "hidden"
  );

}


function showCallScreen() {

  startScreen.classList.add(
    "hidden"
  );

  callScreen.classList.remove(
    "hidden"
  );

}


/*
==================================================
GENERATE ROOM
==================================================
*/

function generateRoomId() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    result +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }

  return result;

}


/*
==================================================
NORMALIZE ROOM
==================================================
*/

function normalizeRoomId(value) {

  return String(
    value || ""
  )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    )
    .slice(0, 6);

}


/*
==================================================
LOAD TURN
==================================================
*/

async function loadTurnServers() {

  try {

    const response =
      await fetch(
        "/turn",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {

      throw new Error(
        "TURN server unavailable"
      );

    }

    const data =
      await response.json();

    if (
      Array.isArray(
        data.iceServers
      ) &&
      data.iceServers.length
    ) {

      iceServers =
        data.iceServers;

    }

  } catch (error) {

    console.warn(
      "TURN не загружен:",
      error
    );

    /*
    STUN всё равно оставляем.
    */

  }

}


/*
==================================================
MEDIA
==================================================
*/

async function getLocalMedia() {

  if (localStream) {

    return localStream;

  }

  setConnectionStatus(
    "Запрашиваем камеру и микрофон..."
  );

  localStream =
    await navigator.mediaDevices.getUserMedia(
      {
        audio: true,

        video: {
          facingMode:
            currentCamera
        }
      }
    );

  localVideo.srcObject =
    localStream;

  localVideo.play().catch(
    () => {}
  );

  updateLocalVideoState();

  return localStream;

}


/*
==================================================
CREATE PEER CONNECTION
==================================================
*/

function createPeerConnection() {

  if (peerConnection) {

    try {

      peerConnection.close();

    } catch {}

  }

  pendingIceCandidates = [];

  peerConnection =
    new RTCPeerConnection(
      {
        iceServers,

        iceCandidatePoolSize: 10
      }
    );


  /*
  -----------------------------------------------
  LOCAL TRACKS
  -----------------------------------------------
  */

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {

          peerConnection.addTrack(
            track,
            localStream
          );

        }
      );

  }


  /*
  -----------------------------------------------
  REMOTE TRACK
  -----------------------------------------------
  */

  peerConnection.ontrack =
    event => {

      const stream =
        event.streams &&
        event.streams[0];

      if (!stream) {

        return;

      }

      remoteVideo.srcObject =
        stream;

      remotePlaceholder.classList.add(
        "hidden"
      );

      remoteVideo.play().catch(
        () => {}
      );

      setConnectionStatus(
        "Собеседник подключён"
      );

    };


  /*
  -----------------------------------------------
  ICE
  -----------------------------------------------
  */

  peerConnection.onicecandidate =
    event => {

      if (
        event.candidate &&
        socket &&
        socket.readyState ===
          WebSocket.OPEN
      ) {

        sendSignal(
          {
            type: "ice",

            candidate:
              event.candidate
          }
        );

      }

    };


  /*
  -----------------------------------------------
  CONNECTION
  -----------------------------------------------
  */

  peerConnection.onconnectionstatechange =
    () => {

      if (!peerConnection) {

        return;

      }

      const state =
        peerConnection.connectionState;

      console.log(
        "WebRTC:",
        state
      );

      if (
        state === "connected"
      ) {

        setConnectionStatus(
          "Соединение установлено"
        );

        remotePlaceholder.classList.add(
          "hidden"
        );

      }

      else if (
        state === "connecting"
      ) {

        setConnectionStatus(
          "Соединение..."
        );

      }

      else if (
        state === "disconnected"
      ) {

        setConnectionStatus(
          "Соединение потеряно..."
        );

      }

      else if (
        state === "failed"
      ) {

        setConnectionStatus(
          "Не удалось установить соединение"
        );

        showToast(
          "WebRTC-соединение не установлено."
        );

      }

      else if (
        state === "closed"
      ) {

        setConnectionStatus(
          "Звонок завершён"
        );

      }

    };


  /*
  -----------------------------------------------
  ICE CONNECTION
  -----------------------------------------------
  */

  peerConnection.oniceconnectionstatechange =
    () => {

      console.log(
        "ICE:",
        peerConnection.iceConnectionState
      );

    };


  /*
  -----------------------------------------------
  SIGNALING STATE
  -----------------------------------------------
  */

  peerConnection.onsignalingstatechange =
    () => {

      console.log(
        "Signaling:",
        peerConnection.signalingState
      );

    };


  return peerConnection;

}


/*
==================================================
CONNECT SIGNALING
==================================================
*/

function connectSocket() {

  return new Promise(
    (resolve, reject) => {

      if (
        socket &&
        socket.readyState ===
          WebSocket.OPEN
      ) {

        resolve();

        return;

      }

      const ws =
        new WebSocket(
          getWebSocketUrl()
        );

      socket = ws;


      let opened = false;


      ws.onopen =
        () => {

          opened = true;

          console.log(
            "Signaling connected"
          );

          resolve();

        };


      ws.onerror =
        error => {

          console.error(
            "WebSocket error:",
            error
          );

          if (!opened) {

            reject(
              new Error(
                "Не удалось подключиться к signaling server"
              )
            );

          }

        };


      ws.onclose =
        () => {

          console.log(
            "Signaling disconnected"
          );

          if (
            socket === ws
          ) {

            socket = null;

          }

          if (roomId) {

            setConnectionStatus(
              "Сигнализация отключена"
            );

          }

        };


      ws.onmessage =
        event => {

          try {

            const message =
              JSON.parse(
                event.data
              );

            handleSignal(
              message
            );

          } catch (error) {

            console.error(
              "Bad signaling message:",
              error
            );

          }

        };

    }
  );

}


/*
==================================================
SEND SIGNAL
==================================================
*/

function sendSignal(payload) {

  if (
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {

    console.warn(
      "Socket is not connected"
    );

    return;

  }

  socket.send(
    JSON.stringify(
      {
        roomId,

        ...payload
      }
    )
  );

}


/*
==================================================
CREATE ROOM
==================================================
*/

async function createRoom() {

  try {

    startButton.disabled =
      true;

    joinButton.disabled =
      true;

    setStartStatus(
      "Подключение..."
    );


    await loadTurnServers();

    await getLocalMedia();

    roomId =
      generateRoomId();

    isHost = true;

    await connectSocket();


    sendSignal(
      {
        type: "create"
      }
    );


    showCallScreen();

    myPeerId.textContent =
      roomId;

    setConnectionStatus(
      "Комната создана. Ожидание собеседника..."
    );

    remotePlaceholderText.textContent =
      "Ожидание собеседника...";


    showToast(
      "Код звонка создан"
    );

  } catch (error) {

    console.error(
      error
    );

    cleanupCall();

    setStartStatus(
      getErrorMessage(error)
    );

  } finally {

    startButton.disabled =
      false;

    joinButton.disabled =
      false;

  }

}


/*
==================================================
JOIN ROOM
==================================================
*/

async function joinRoom() {

  const id =
    normalizeRoomId(
      remoteIdInput.value
    );

  if (
    id.length !== 6
  ) {

    setStartStatus(
      "Введите правильный 6-значный код."
    );

    return;

  }

  try {

    startButton.disabled =
      true;

    joinButton.disabled =
      true;

    setStartStatus(
      "Подключение..."
    );


    await loadTurnServers();

    await getLocalMedia();

    roomId =
      id;

    isHost = false;

    await connectSocket();


    sendSignal(
      {
        type: "join"
      }
    );


    showCallScreen();

    myPeerId.textContent =
      roomId;

    setConnectionStatus(
      "Подключение к собеседнику..."
    );

    remotePlaceholderText.textContent =
      "Подключение...";

  } catch (error) {

    console.error(
      error
    );

    cleanupCall();

    setStartStatus(
      getErrorMessage(error)
    );

  } finally {

    startButton.disabled =
      false;

    joinButton.disabled =
      false;

  }

}


/*
==================================================
SIGNAL HANDLER
==================================================
*/

async function handleSignal(message) {

  console.log(
    "SIGNAL:",
    message.type
  );


  if (
    message.type ===
    "created"
  ) {

    setConnectionStatus(
      "Комната создана. Ожидание собеседника..."
    );

    return;

  }


  if (
    message.type ===
    "joined"
  ) {

    if (!isHost) {

      setConnectionStatus(
        "Собеседник найден..."
      );

    }

    return;

  }


  if (
    message.type ===
    "peer-joined"
  ) {

    if (!isHost) {

      return;

    }

    setConnectionStatus(
      "Собеседник найден. Создание соединения..."
    );

    await startOffer();

    return;

  }


  if (
    message.type ===
    "offer"
  ) {

    await handleOffer(
      message.offer
    );

    return;

  }


  if (
    message.type ===
    "answer"
  ) {

    await handleAnswer(
      message.answer
    );

    return;

  }


  if (
    message.type ===
    "ice"
  ) {

    await handleRemoteIce(
      message.candidate
    );

    return;

  }


  if (
    message.type ===
    "peer-left"
  ) {

    setConnectionStatus(
      "Собеседник отключился"
    );

    remotePlaceholder.classList.remove(
      "hidden"
    );

    remotePlaceholderText.textContent =
      "Собеседник отключился";

    remoteVideo.srcObject =
      null;

    if (peerConnection) {

      try {

        peerConnection.close();

      } catch {}

      peerConnection =
        null;

    }

    showToast(
      "Собеседник завершил звонок."
    );

    return;

  }


  if (
    message.type ===
    "room-full"
  ) {

    showToast(
      "Эта комната уже занята."
    );

    cleanupCall();

    setStartStatus(
      "Комната уже занята."
    );

    return;

  }


  if (
    message.type ===
    "room-not-found"
  ) {

    showToast(
      "Комната не найдена."
    );

    cleanupCall();

    setStartStatus(
      "Комната не найдена."
    );

    return;

  }


  if (
    message.type ===
    "rejected"
  ) {

    showToast(
      "Звонок отклонён."
    );

    cleanupCall();

    return;

  }

}


/*
==================================================
START OFFER
==================================================
*/

async function startOffer() {

  if (!peerConnection) {

    createPeerConnection();

  }

  const offer =
    await peerConnection.createOffer(
      {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }
    );

  await peerConnection.setLocalDescription(
    offer
  );

  sendSignal(
    {
      type: "offer",

      offer:
        peerConnection.localDescription
    }
  );

}


/*
==================================================
HANDLE OFFER
==================================================
*/

async function handleOffer(
  offer
) {

  if (!peerConnection) {

    createPeerConnection();

  }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(
      offer
    )
  );

  await flushPendingIce();

  const answer =
    await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(
    answer
  );

  sendSignal(
    {
      type: "answer",

      answer:
        peerConnection.localDescription
    }
  );

}


/*
==================================================
HANDLE ANSWER
==================================================
*/

async function handleAnswer(
  answer
) {

  if (!peerConnection) {

    return;

  }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(
      answer
    )
  );

  await flushPendingIce();

}


/*
==================================================
HANDLE ICE
==================================================
*/

async function handleRemoteIce(
  candidate
) {

  if (!candidate) {

    return;

  }

  if (
    !peerConnection ||
    !peerConnection.remoteDescription
  ) {

    pendingIceCandidates.push(
      candidate
    );

    return;

  }

  try {

    await peerConnection.addIceCandidate(
      new RTCIceCandidate(
        candidate
      )
    );

  } catch (error) {

    console.warn(
      "ICE candidate error:",
      error
    );

  }

}


/*
==================================================
FLUSH ICE
==================================================
*/

async function flushPendingIce() {

  if (!peerConnection) {

    return;

  }

  if (
    !peerConnection.remoteDescription
  ) {

    return;

  }

  const candidates =
    pendingIceCandidates;

  pendingIceCandidates = [];


  for (
    const candidate of candidates
  ) {

    try {

      await peerConnection.addIceCandidate(
        new RTCIceCandidate(
          candidate
        )
      );

    } catch (error) {

      console.warn(
        "ICE flush error:",
        error
      );

    }

  }

}


/*
==================================================
MIC
==================================================
*/

function toggleMicrophone() {

  if (!localStream) {

    return;

  }

  const tracks =
    localStream.getAudioTracks();

  if (!tracks.length) {

    return;

  }

  micEnabled =
    !micEnabled;

  tracks.forEach(
    track => {

      track.enabled =
        micEnabled;

    }
  );

  micButton.classList.toggle(
    "off",
    !micEnabled
  );

  micButton.textContent =
    micEnabled
      ? "🎙️"
      : "🔇";

  showToast(
    micEnabled
      ? "Микрофон включён"
      : "Микрофон выключен"
  );

}


/*
==================================================
CAMERA
==================================================
*/

function toggleCamera() {

  if (!localStream) {

    return;

  }

  const tracks =
    localStream.getVideoTracks();

  if (!tracks.length) {

    return;

  }

  cameraEnabled =
    !cameraEnabled;

  tracks.forEach(
    track => {

      track.enabled =
        cameraEnabled;

    }
  );

  cameraButton.classList.toggle(
    "off",
    !cameraEnabled
  );

  cameraButton.textContent =
    cameraEnabled
      ? "📷"
      : "🚫";

  localPlaceholder.classList.toggle(
    "hidden",
    cameraEnabled
  );

  showToast(
    cameraEnabled
      ? "Камера включена"
      : "Камера выключена"
  );

}


/*
==================================================
SWITCH CAMERA
==================================================
*/

async function switchCamera() {

  if (!localStream) {

    return;

  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    return;

  }


  const oldTrack =
    localStream.getVideoTracks()[0];

  if (!oldTrack) {

    return;

  }


  currentCamera =
    currentCamera === "user"
      ? "environment"
      : "user";


  try {

    const newStream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: false,

          video: {
            facingMode:
              {
                ideal:
                  currentCamera
              }
          }
        }
      );


    const newTrack =
      newStream.getVideoTracks()[0];

    if (!newTrack) {

      throw new Error(
        "Камера недоступна"
      );

    }


    /*
    Заменяем track в WebRTC.
    */

    if (peerConnection) {

      const sender =
        peerConnection
          .getSenders()
          .find(
            item =>
              item.track &&
              item.track.kind ===
                "video"
          );

      if (sender) {

        await sender.replaceTrack(
          newTrack
        );

      }

    }


    localStream.removeTrack(
      oldTrack
    );

    oldTrack.stop();

    localStream.addTrack(
      newTrack
    );

    localVideo.srcObject =
      localStream;

    newTrack.enabled =
      cameraEnabled;

    localVideo.play().catch(
      () => {}
    );


    /*
    Mirror only front camera.
    */

    localVideo.style.transform =
      currentCamera === "user"
        ? "scaleX(-1)"
        : "scaleX(1)";


    showToast(
      currentCamera === "user"
        ? "Фронтальная камера"
        : "Основная камера"
    );

  } catch (error) {

    console.error(
      "Camera switch error:",
      error
    );

    currentCamera =
      currentCamera === "user"
        ? "environment"
        : "user";

    showToast(
      "Не удалось переключить камеру."
    );

  }

}


/*
==================================================
HANGUP
==================================================
*/

function hangup() {

  /*
  Сообщаем серверу,
  что пользователь вышел.
  */

  if (
    socket &&
    socket.readyState ===
      WebSocket.OPEN &&
    roomId
  ) {

    try {

      sendSignal(
        {
          type: "leave"
        }
      );

    } catch {}

  }

  cleanupCall();

  showToast(
    "Звонок завершён."
  );

}


/*
==================================================
CLEANUP
==================================================
*/

function cleanupCall() {

  if (peerConnection) {

    try {

      peerConnection.ontrack =
        null;

      peerConnection.onicecandidate =
        null;

      peerConnection.onconnectionstatechange =
        null;

      peerConnection.close();

    } catch {}

  }

  peerConnection =
    null;


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {

          try {

            track.stop();

          } catch {}

        }
      );

  }

  localStream =
    null;


  localVideo.srcObject =
    null;

  remoteVideo.srcObject =
    null;


  remotePlaceholder.classList.remove(
    "hidden"
  );

  localPlaceholder.classList.remove(
    "hidden"
  );


  pendingIceCandidates = [];

  roomId = null;

  isHost = false;

  pendingIncoming = false;

  micEnabled = true;

  cameraEnabled = true;

  currentCamera = "user";


  micButton.textContent =
    "🎙️";

  cameraButton.textContent =
    "📷";


  micButton.classList.remove(
    "off"
  );

  cameraButton.classList.remove(
    "off"
  );


  localVideo.style.transform =
    "scaleX(-1)";


  if (socket) {

    try {

      socket.close();

    } catch {}

  }

  socket = null;


  incomingCall.classList.add(
    "hidden"
  );


  myPeerId.textContent =
    "Создание...";


  setConnectionStatus(
    "Подключение..."
  );


  showStartScreen();

}


/*
==================================================
COPY
==================================================
*/

async function copyText(
  text
) {

  try {

    await navigator.clipboard.writeText(
      text
    );

    showToast(
      "Скопировано"
    );

  } catch {

    const input =
      document.createElement(
        "input"
      );

    input.value =
      text;

    document.body.appendChild(
      input
    );

    input.select();

    document.execCommand(
      "copy"
    );

    input.remove();

    showToast(
      "Скопировано"
    );

  }

}


/*
==================================================
ERROR MESSAGE
==================================================
*/

function getErrorMessage(
  error
) {

  if (
    error &&
    error.name ===
      "NotAllowedError"
  ) {

    return (
      "Разрешите доступ к камере и микрофону."
    );

  }

  if (
    error &&
    error.name ===
      "NotFoundError"
  ) {

    return (
      "Камера или микрофон не найдены."
    );

  }

  if (
    error &&
    error.name ===
      "NotReadableError"
  ) {

    return (
      "Камера или микрофон уже используются."
    );

  }

  return (
    error?.message ||
    "Произошла ошибка."
  );

}


/*
==================================================
BUTTONS
==================================================
*/

startButton.addEventListener(
  "click",
  createRoom
);

joinButton.addEventListener(
  "click",
  joinRoom
);

micButton.addEventListener(
  "click",
  toggleMicrophone
);

cameraButton.addEventListener(
  "click",
  toggleCamera
);

switchCameraButton.addEventListener(
  "click",
  switchCamera
);

hangupButton.addEventListener(
  "click",
  hangup
);


copyMyIdButton.addEventListener(
  "click",
  () => {

    if (roomId) {

      copyText(
        roomId
      );

    }

  }
);


copyIdButton.addEventListener(
  "click",
  () => {

    if (roomId) {

      copyText(
        roomId
      );

    }

  }
);


acceptCallButton.addEventListener(
  "click",
  () => {

    incomingCall.classList.add(
      "hidden"
    );

    pendingIncoming = false;

  }
);


rejectCallButton.addEventListener(
  "click",
  () => {

    sendSignal(
      {
        type: "reject"
      }
    );

    incomingCall.classList.add(
      "hidden"
    );

    pendingIncoming = false;

  }
);


/*
==================================================
ENTER KEY
==================================================
*/

remoteIdInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
        "Enter"
    ) {

      joinRoom();

    }

  }
);


/*
==================================================
PAGE EXIT
==================================================
*/

window.addEventListener(
  "beforeunload",
  () => {

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN &&
      roomId
    ) {

      try {

        sendSignal(
          {
            type: "leave"
          }
        );

      } catch {}

    }

  }
);


/*
==================================================
PWA
==================================================
*/

if (
  "serviceWorker" in
  navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register(
          "sw.js"
        )
        .catch(
          error => {

            console.warn(
              "Service worker:",
              error
            );

          }
        );

    }
  );

}


/*
==================================================
START
==================================================
*/

setStartStatus(
  "Создайте звонок или введите код собеседника."
);
