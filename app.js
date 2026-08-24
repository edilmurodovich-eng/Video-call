"use strict";

/*
========================================
VIDEO CALL
WebRTC + PeerJS
========================================
*/

let peer = null;

let localStream = null;

let currentCall = null;

let pendingCall = null;

let currentCamera = "user";

let micEnabled = true;

let cameraEnabled = true;


/*
========================================
ELEMENTS
========================================
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
  document.getElementById(
    "remotePlaceholder"
  );

const localPlaceholder =
  document.getElementById(
    "localPlaceholder"
  );

const connectionStatus =
  document.getElementById(
    "connectionStatus"
  );

const myPeerId =
  document.getElementById(
    "myPeerId"
  );

const copyMyIdButton =
  document.getElementById(
    "copyMyIdButton"
  );

const copyIdButton =
  document.getElementById(
    "copyIdButton"
  );

const micButton =
  document.getElementById(
    "micButton"
  );

const cameraButton =
  document.getElementById(
    "cameraButton"
  );

const switchCameraButton =
  document.getElementById(
    "switchCameraButton"
  );

const hangupButton =
  document.getElementById(
    "hangupButton"
  );

const incomingCall =
  document.getElementById(
    "incomingCall"
  );

const acceptCallButton =
  document.getElementById(
    "acceptCallButton"
  );

const rejectCallButton =
  document.getElementById(
    "rejectCallButton"
  );

const toast =
  document.getElementById(
    "toast"
  );


/*
========================================
UTILITY
========================================
*/

function showToast(message) {

  toast.textContent = message;

  toast.classList.remove("hidden");

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      2500
    );

}


function setStatus(message) {

  startStatus.textContent =
    message;

}


function setConnectionStatus(
  message
) {

  connectionStatus.textContent =
    message;

}


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
========================================
LOCAL MEDIA
========================================
*/

async function getLocalMedia() {

  if (localStream) {

    return localStream;

  }

  try {

    localStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            facingMode:
              currentCamera
          }
        });

    localVideo.srcObject =
      localStream;

    localVideo.play()
      .catch(() => {});

    updateLocalVideoState();

    return localStream;

  } catch (error) {

    console.error(error);

    if (
      error.name ===
      "NotAllowedError"
    ) {

      throw new Error(
        "Разрешите доступ к камере и микрофону."
      );

    }

    if (
      error.name ===
      "NotFoundError"
    ) {

      throw new Error(
        "Камера или микрофон не найдены."
      );

    }

    throw new Error(
      "Не удалось получить доступ к камере."
    );

  }

}


/*
========================================
PEER INITIALIZATION
========================================
*/

function createPeer() {

  return new Promise(
    (resolve, reject) => {

      if (peer) {

        resolve(peer);

        return;

      }

      setStatus(
        "Подключение к серверу..."
      );

      peer =
        new Peer({
          debug: 1
        });

      peer.on(
        "open",
        id => {

          console.log(
            "Peer ID:",
            id
          );

          myPeerId.textContent =
            id;

          setStatus(
            "Готово. Передайте ID собеседнику."
          );

          resolve(peer);

        }
      );

      peer.on(
        "call",
        call => {

          handleIncomingCall(
            call
          );

        }
      );

      peer.on(
        "error",
        error => {

          console.error(
            "Peer error:",
            error
          );

          if (
            error.type ===
            "peer-unavailable"
          ) {

            showToast(
              "Собеседник не найден."
            );

            setConnectionStatus(
              "Собеседник не найден"
            );

          }

          else if (
            error.type ===
            "network"
          ) {

            showToast(
              "Ошибка сетевого соединения."
            );

          }

          else {

            showToast(
              "Ошибка: " +
              error.type
            );

          }

        }
      );

      peer.on(
        "disconnected",
        () => {

          setConnectionStatus(
            "Соединение с сервером потеряно"
          );

        }
      );

      peer.on(
        "close",
        () => {

          setConnectionStatus(
            "Соединение закрыто"
          );

        }
      );

    }
  );

}


/*
========================================
CREATE CALL
========================================
*/

async function createCall() {

  startButton.disabled =
    true;

  try {

    await getLocalMedia();

    await createPeer();

    showCallScreen();

    setConnectionStatus(
      "Ваш ID готов"
    );

  } catch (error) {

    console.error(error);

    showToast(
      error.message
    );

  } finally {

    startButton.disabled =
      false;

  }

}


/*
========================================
JOIN CALL
========================================
*/

async function joinCall() {

  const remoteId =
    remoteIdInput.value.trim();

  if (!remoteId) {

    showToast(
      "Введите ID собеседника."
    );

    return;

  }

  if (
    !peer ||
    !peer.open
  ) {

    try {

      await createPeer();

    } catch (error) {

      showToast(
        error.message
      );

      return;

    }

  }

  joinButton.disabled =
    true;

  try {

    await getLocalMedia();

    showCallScreen();

    setConnectionStatus(
      "Звоним..."
    );

    const call =
      peer.call(
        remoteId,
        localStream
      );

    if (!call) {

      throw new Error(
        "Не удалось начать звонок."
      );

    }

    currentCall =
      call;

    setupCall(
      call
    );

  } catch (error) {

    console.error(error);

    showToast(
      error.message
    );

  } finally {

    joinButton.disabled =
      false;

  }

}


/*
========================================
INCOMING CALL
========================================
*/

function handleIncomingCall(
  call
) {

  pendingCall =
    call;

  incomingCall.classList.remove(
    "hidden"
  );

}


/*
========================================
ACCEPT
========================================
*/

async function acceptIncomingCall() {

  if (!pendingCall) {

    return;

  }

  try {

    await getLocalMedia();

    incomingCall.classList.add(
      "hidden"
    );

    showCallScreen();

    setConnectionStatus(
      "Подключение..."
    );

    currentCall =
      pendingCall;

    pendingCall.answer(
      localStream
    );

    setupCall(
      pendingCall
    );

    pendingCall = null;

  } catch (error) {

    console.error(error);

    showToast(
      error.message
    );

  }

}


/*
========================================
REJECT
========================================
*/

function rejectIncomingCall() {

  if (pendingCall) {

    try {

      pendingCall.close();

    } catch {}

  }

  pendingCall = null;

  incomingCall.classList.add(
    "hidden"
  );

}


/*
========================================
SETUP CALL
========================================
*/

function setupCall(call) {

  call.on(
    "stream",
    remoteStream => {

      console.log(
        "Remote stream received"
      );

      remoteVideo.srcObject =
        remoteStream;

      remoteVideo.play()
        .catch(() => {});

      remotePlaceholder.classList.add(
        "hidden"
      );

      setConnectionStatus(
        "Соединение установлено"
      );

    }
  );

  call.on(
    "close",
    () => {

      setConnectionStatus(
        "Звонок завершён"
      );

      remoteVideo.srcObject =
        null;

      remotePlaceholder.classList.remove(
        "hidden"
      );

      currentCall = null;

      showToast(
        "Звонок завершён."
      );

    }
  );

  call.on(
    "error",
    error => {

      console.error(
        "Call error:",
        error
      );

      setConnectionStatus(
        "Ошибка соединения"
      );

      showToast(
        "Ошибка видеозвонка."
      );

    }
  );

}


/*
========================================
MICROPHONE
========================================
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

  micButton.textContent =
    micEnabled
      ? "🎙️"
      : "🔇";

  micButton.classList.toggle(
    "off",
    !micEnabled
  );

}


/*
========================================
CAMERA
========================================
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

  cameraButton.textContent =
    cameraEnabled
      ? "📷"
      : "🚫";

  cameraButton.classList.toggle(
    "off",
    !cameraEnabled
  );

  localPlaceholder.classList.toggle(
    "hidden",
    cameraEnabled
  );

}


/*
========================================
SWITCH CAMERA
========================================
*/

async function switchCamera() {

  if (!localStream) {

    return;

  }

  const oldVideoTracks =
    localStream.getVideoTracks();

  if (!oldVideoTracks.length) {

    return;

  }

  currentCamera =
    currentCamera === "user"
      ? "environment"
      : "user";

  try {

    const newStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            facingMode:
              currentCamera
          }
        });

    const newTrack =
      newStream.getVideoTracks()[0];

    const oldTrack =
      oldVideoTracks[0];

    /*
    Меняем track
    в локальном MediaStream.
    */

    localStream.removeTrack(
      oldTrack
    );

    localStream.addTrack(
      newTrack
    );

    oldTrack.stop();

    localVideo.srcObject =
      localStream;

    /*
    Если звонок уже идёт,
    заменяем video track
    в RTCPeerConnection.
    */

    if (currentCall) {

      const sender =
        currentCall.peerConnection
          ?.getSenders()
          ?.find(
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

    showToast(
      currentCamera === "user"
        ? "Фронтальная камера"
        : "Основная камера"
    );

  } catch (error) {

    console.error(error);

    /*
    Некоторые устройства
    не поддерживают facingMode.
    */

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
========================================
HANG UP
========================================
*/

function hangup() {

  /*
  ========================================
  ЗАКРЫВАЕМ WEBRTC ЗВОНОК
  ========================================
  */

  if (currentCall) {

    try {

      currentCall.close();

    } catch (error) {

      console.error(
        "Ошибка завершения звонка:",
        error
      );

    }

  }

  currentCall = null;


  /*
  ========================================
  ОСТАНАВЛИВАЕМ КАМЕРУ И МИКРОФОН
  ========================================
  */

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

  localStream = null;


  /*
  ========================================
  ОЧИЩАЕМ VIDEO
  ========================================
  */

  if (localVideo) {

    localVideo.srcObject =
      null;

  }

  if (remoteVideo) {

    remoteVideo.srcObject =
      null;

  }


  /*
  ========================================
  ВОЗВРАЩАЕМ PLACEHOLDER
  ========================================
  */

  if (remotePlaceholder) {

    remotePlaceholder.classList.remove(
      "hidden"
    );

  }

  if (localPlaceholder) {

    localPlaceholder.classList.remove(
      "hidden"
    );

  }


  /*
  ========================================
  СБРАСЫВАЕМ СОСТОЯНИЕ
  ========================================
  */

  micEnabled = true;

  cameraEnabled = true;

  currentCamera = "user";


  /*
  ========================================
  СБРАСЫВАЕМ КНОПКИ
  ========================================
  */

  if (micButton) {

    micButton.textContent =
      "🎙️";

    micButton.classList.remove(
      "off"
    );

  }

  if (cameraButton) {

    cameraButton.textContent =
      "📷";

    cameraButton.classList.remove(
      "off"
    );

  }


  /*
  ========================================
  СТАТУС
  ========================================
  */

  setConnectionStatus(
    "Звонок завершён"
  );


  /*
  ========================================
  ВОЗВРАЩАЕМСЯ НА ГЛАВНЫЙ ЭКРАН
  ========================================
  */

  showStartScreen();


  /*
  ========================================
  СООБЩЕНИЕ
  ========================================
  */

  showToast(
    "Звонок завершён."
  );

}


/*
========================================
COPY ID
========================================
*/

async function copyText(text) {

  if (!text) {

    return;

  }

  try {

    await navigator.clipboard.writeText(
      text
    );

    showToast(
      "ID скопирован."
    );

  } catch {

    /*
    Fallback для старых браузеров.
    */

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value =
      text;

    textarea.style.position =
      "fixed";

    textarea.style.opacity =
      "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand(
      "copy"
    );

    textarea.remove();

    showToast(
      "ID скопирован."
    );

  }

}


/*
========================================
LOCAL VIDEO STATE
========================================
*/

function updateLocalVideoState() {

  if (!localStream) {

    return;

  }

  const videoTracks =
    localStream.getVideoTracks();

  const audioTracks =
    localStream.getAudioTracks();

  cameraEnabled =
    videoTracks.length
      ? videoTracks[0].enabled
      : false;

  micEnabled =
    audioTracks.length
      ? audioTracks[0].enabled
      : false;

  cameraButton.textContent =
    cameraEnabled
      ? "📷"
      : "🚫";

  micButton.textContent =
    micEnabled
      ? "🎙️"
      : "🔇";

}


/*
========================================
BUTTON EVENTS
========================================
*/

startButton.addEventListener(
  "click",
  createCall
);

joinButton.addEventListener(
  "click",
  joinCall
);

remoteIdInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      joinCall();

    }

  }
);

acceptCallButton.addEventListener(
  "click",
  acceptIncomingCall
);

rejectCallButton.addEventListener(
  "click",
  rejectIncomingCall
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

    copyText(
      myPeerId.textContent
    );

  }
);

copyIdButton.addEventListener(
  "click",
  () => {

    copyText(
      myPeerId.textContent
    );

  }
);


/*
========================================
START
========================================
*/

window.addEventListener(
  "load",
  () => {

    /*
    Создаём Peer ID заранее.
    Камеру пока НЕ включаем.
    */

    createPeer()
      .catch(
        error => {

          console.error(
            error
          );

          setStatus(
            "Не удалось подключиться. Обновите страницу."
          );

        }
      );

  }
);


/*
========================================
SERVICE WORKER
========================================
*/

if (
  "serviceWorker" in navigator
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
              "Service Worker:",
              error
            );

          }
        );

    }
  );

}
