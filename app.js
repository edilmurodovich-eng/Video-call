"use strict";


/*
==================================================
LIVEKIT
==================================================
*/

const LIVEKIT =
  window.LivekitClient;

if (!LIVEKIT) {
  console.error("LiveKit SDK не загружен.");
} else {
  console.log("LiveKit SDK загружен:", LIVEKIT);
}

const Room =
  LIVEKIT?.Room;

const RoomEvent =
  LIVEKIT?.RoomEvent;

const Track =
  LIVEKIT?.Track;


/*
==================================================
DOM
==================================================
*/

const startScreen =
  document.getElementById(
    "startScreen"
  );

const callScreen =
  document.getElementById(
    "callScreen"
  );

const startButton =
  document.getElementById(
    "startButton"
  );

const joinButton =
  document.getElementById(
    "joinButton"
  );

const remoteIdInput =
  document.getElementById(
    "remoteIdInput"
  );

const startStatus =
  document.getElementById(
    "startStatus"
  );

const localVideo =
  document.getElementById(
    "localVideo"
  );

const remoteVideo =
  document.getElementById(
    "remoteVideo"
  );

const localPlaceholder =
  document.getElementById(
    "localPlaceholder"
  );

const remotePlaceholder =
  document.getElementById(
    "remotePlaceholder"
  );

const remotePlaceholderText =
  document.getElementById(
    "remotePlaceholderText"
  );

const connectionStatus =
  document.getElementById(
    "connectionStatus"
  );

const myPeerId =
  document.getElementById(
    "myPeerId"
  );

const copyIdButton =
  document.getElementById(
    "copyIdButton"
  );

const copyMyIdButton =
  document.getElementById(
    "copyMyIdButton"
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

const toast =
  document.getElementById(
    "toast"
  );


/*
==================================================
STATE
==================================================
*/

let room = null;

let roomCode = "";

let identity = "";

let micEnabled = true;

let cameraEnabled = true;

let facingMode = "user";

let remoteAudioElements = [];


/*
==================================================
ROOM CODE
==================================================
*/

function generateRoomCode() {

  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    result +=
      alphabet[
        Math.floor(
          Math.random() *
          alphabet.length
        )
      ];

  }

  return result;

}


/*
==================================================
IDENTITY
==================================================
*/

function createIdentity() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {

    return (
      "user-" +
      window.crypto.randomUUID()
    );

  }

  return (
    "user-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


/*
==================================================
ROOM NAME
==================================================
*/

function getRoomName(
  code
) {

  return (
    "vc-" +
    String(code)
      .toUpperCase()
  );

}


/*
==================================================
STATUS
==================================================
*/

function setConnectionStatus(
  text
) {

  if (
    connectionStatus
  ) {

    connectionStatus.textContent =
      text;

  }

}


/*
==================================================
START STATUS
==================================================
*/

function setStartStatus(
  text
) {

  if (
    startStatus
  ) {

    startStatus.textContent =
      text;

  }

}


/*
==================================================
TOAST
==================================================
*/

function showToast(
  message
) {

  if (!toast) {

    return;

  }

  toast.textContent =
    message;

  toast.classList.remove(
    "hidden"
  );


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


/*
==================================================
SHOW START
==================================================
*/

function showStartScreen() {

  startScreen
    ?.classList
    .remove(
      "hidden"
    );

  callScreen
    ?.classList
    .add(
      "hidden"
    );

}


/*
==================================================
SHOW CALL
==================================================
*/

function showCallScreen() {

  startScreen
    ?.classList
    .add(
      "hidden"
    );

  callScreen
    ?.classList
    .remove(
      "hidden"
    );

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
      "Код скопирован."
    );

  } catch {

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
      "Код скопирован."
    );

  }

}


/*
==================================================
GET TOKEN
==================================================
*/

async function getLiveKitToken(
  code
) {

  const response =
    await fetch(
      "/api/livekit/token",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            roomCode:
              code,

            identity

          })

      }
    );


  const data =
    await response.json();


  if (
    !response.ok ||
    !data.ok
  ) {

    throw new Error(
      data.error ||
      "Не удалось получить токен LiveKit."
    );

  }


  return data;

}


/*
==================================================
CONNECT TO LIVEKIT
==================================================
*/

async function connectToRoom(
  code
) {

  if (!LIVEKIT) {

    throw new Error(
      "LiveKit SDK не загружен."
    );

  }


  roomCode =
    String(code)
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        ""
      )
      .slice(
        0,
        6
      );


  if (
    roomCode.length !==
    6
  ) {

    throw new Error(
      "Код должен содержать 6 символов."
    );

  }


  if (!identity) {

    identity =
      createIdentity();

  }


  setConnectionStatus(
    "Подключение..."
  );


  setStartStatus(
    "Подключение к видеозвонку..."
  );


  const credentials =
    await getLiveKitToken(
      roomCode
    );


  room =
    new Room({

      adaptiveStream:
        true,

      dynacast:
        true

    });


  /*
  ========================================
  EVENTS
  ========================================
  */

  room.on(
    RoomEvent.Connected,
    () => {

      setConnectionStatus(
        "Вы подключены"
      );

    }
  );


  room.on(
    RoomEvent.ParticipantConnected,
    participant => {

      console.log(
        "Participant connected:",
        participant.identity
      );

      setConnectionStatus(
        "Собеседник подключён"
      );

      if (
        remotePlaceholderText
      ) {

        remotePlaceholderText.textContent =
          "Собеседник подключён";

      }

    }
  );


  room.on(
    RoomEvent.ParticipantDisconnected,
    participant => {

      console.log(
        "Participant disconnected:",
        participant.identity
      );

      clearRemoteMedia();

      setConnectionStatus(
        "Собеседник отключился"
      );

      if (
        remotePlaceholderText
      ) {

        remotePlaceholderText.textContent =
          "Ожидание собеседника...";

      }

      remotePlaceholder
        ?.classList
        .remove(
          "hidden"
        );

    }
  );


  room.on(
    RoomEvent.TrackSubscribed,
    (
      track,
      publication,
      participant
    ) => {

      handleRemoteTrack(
        track,
        participant
      );

    }
  );


  room.on(
    RoomEvent.TrackUnsubscribed,
    track => {

      try {

        track.detach();

      } catch {}

      updateRemotePlaceholder();

    }
  );


  room.on(
    RoomEvent.Disconnected,
    () => {

      setConnectionStatus(
        "Соединение завершено"
      );

    }
  );


  room.on(
    RoomEvent.Reconnecting,
    () => {

      setConnectionStatus(
        "Восстановление соединения..."
      );

    }
  );


  room.on(
    RoomEvent.Reconnected,
    () => {

      setConnectionStatus(
        "Соединение восстановлено"
      );

    }
  );


  /*
  ========================================
  CONNECT
  ========================================
  */

  await room.connect(
    credentials.serverUrl,
    credentials.participantToken
  );


  console.log(
    "Connected to LiveKit room:",
    room.name
  );


  /*
  ========================================
  LOCAL CAMERA + MICROPHONE
  ========================================
  */

  await room
    .localParticipant
    .enableCameraAndMicrophone();


  attachLocalTracks();


  /*
  ========================================
  EXISTING PARTICIPANTS
  ========================================
  */

  for (
    const participant of
      room.remoteParticipants.values()
  ) {

    for (
      const publication of
        participant.trackPublications.values()
    ) {

      if (
        publication.isSubscribed &&
        publication.track
      ) {

        handleRemoteTrack(
          publication.track,
          participant
        );

      }

    }

  }


  /*
  ========================================
  UI
  ========================================
  */

  showCallScreen();

  updateControls();

  updateRemotePlaceholder();

}


/*
==================================================
LOCAL TRACKS
==================================================
*/

function attachLocalTracks() {

  if (!room) {

    return;

  }


  const participant =
    room.localParticipant;


  /*
  CAMERA
  */

  const cameraPublication =
    participant.getTrackPublication(
      Track.Source.Camera
    );


  if (
    cameraPublication &&
    cameraPublication.track
  ) {

    try {

      cameraPublication.track.attach(
        localVideo
      );

      localPlaceholder
        ?.classList
        .add(
          "hidden"
        );

    } catch (error) {

      console.error(
        "Local video attach error:",
        error
      );

    }

  }


  /*
  MICROPHONE

  Audio is sent to LiveKit,
  therefore no local audio
  element is required.
  */

}


/*
==================================================
REMOTE TRACK
==================================================
*/

function handleRemoteTrack(
  track,
  participant
) {

  console.log(
    "Remote track:",
    track.kind,
    participant.identity
  );


  if (
    track.kind ===
    Track.Kind.Video
  ) {

    try {

      track.attach(
        remoteVideo
      );

      remotePlaceholder
        ?.classList
        .add(
          "hidden"
        );

    } catch (error) {

      console.error(
        "Remote video attach error:",
        error
      );

    }

  }


  if (
    track.kind ===
    Track.Kind.Audio
  ) {

    try {

      const audio =
        track.attach();

      audio.autoplay =
        true;

      audio.playsInline =
        true;

      audio.style.display =
        "none";

      document.body.appendChild(
        audio
      );

      remoteAudioElements.push(
        audio
      );

    } catch (error) {

      console.error(
        "Remote audio attach error:",
        error
      );

    }

  }


  updateRemotePlaceholder();

}


/*
==================================================
REMOTE PLACEHOLDER
==================================================
*/

function updateRemotePlaceholder() {

  if (!room) {

    remotePlaceholder
      ?.classList
      .remove(
        "hidden"
      );

    return;

  }


  const hasRemoteParticipant =
    room.remoteParticipants.size >
    0;


  const cameraPublication =
    hasRemoteParticipant
      ? Array.from(
          room.remoteParticipants.values()
        )
          .map(
            participant =>
              participant.getTrackPublication(
                Track.Source.Camera
              )
          )
          .find(
            publication =>
              publication &&
              publication.isSubscribed &&
              publication.track
          )
      : null;


  if (
    cameraPublication
  ) {

    remotePlaceholder
      ?.classList
      .add(
        "hidden"
      );

  } else {

    remotePlaceholder
      ?.classList
      .remove(
        "hidden"
      );

  }

}


/*
==================================================
MICROPHONE
==================================================
*/

async function toggleMicrophone() {

  if (!room) {

    return;

  }


  try {

    micEnabled =
      !micEnabled;


    await room
      .localParticipant
      .setMicrophoneEnabled(
        micEnabled
      );


    updateControls();


  } catch (error) {

    micEnabled =
      !micEnabled;

    console.error(
      "Microphone error:",
      error
    );

    showToast(
      "Не удалось изменить микрофон."
    );

  }

}


/*
==================================================
CAMERA
==================================================
*/

async function toggleCamera() {

  if (!room) {

    return;

  }


  try {

    cameraEnabled =
      !cameraEnabled;


    await room
      .localParticipant
      .setCameraEnabled(
        cameraEnabled
      );


    if (
      cameraEnabled
    ) {

      attachLocalTracks();

    } else {

      const publication =
        room.localParticipant
          .getTrackPublication(
            Track.Source.Camera
          );


      if (
        publication &&
        publication.track
      ) {

        try {

          publication.track.detach(
            localVideo
          );

        } catch {}

      }


      localPlaceholder
        ?.classList
        .remove(
          "hidden"
        );

    }


    updateControls();


  } catch (error) {

    cameraEnabled =
      !cameraEnabled;

    console.error(
      "Camera error:",
      error
    );

    showToast(
      "Не удалось изменить камеру."
    );

  }

}


/*
==================================================
SWITCH CAMERA
==================================================
*/

async function switchCamera() {

  if (!room) {

    return;

  }


  if (!cameraEnabled) {

    showToast(
      "Сначала включите камеру."
    );

    return;

  }


  const publication =
    room.localParticipant
      .getTrackPublication(
        Track.Source.Camera
      );


  const track =
    publication?.track;


  if (
    !track
  ) {

    showToast(
      "Камера ещё не готова."
    );

    return;

  }


  try {

    facingMode =
      facingMode ===
      "user"
        ? "environment"
        : "user";


    await track.restartTrack({

      facingMode

    });


    track.attach(
      localVideo
    );


  } catch (error) {

    console.error(
      "Switch camera error:",
      error
    );


    /*
    Некоторые устройства
    не поддерживают facingMode.

    В этом случае пробуем
    переключить устройство
    через список камер.
    */

    try {

      const devices =
        await Room.getLocalDevices(
          "videoinput"
        );


      if (
        devices.length >=
        2
      ) {

        const currentDeviceId =
          await track.getDeviceId();


        const index =
          devices.findIndex(
            device =>
              device.deviceId ===
              currentDeviceId
          );


        const nextIndex =
          index >= 0
            ? (
                index + 1
              ) %
              devices.length
            : 0;


        await room.switchActiveDevice(
          "videoinput",
          devices[nextIndex]
            .deviceId
        );


        track.attach(
          localVideo
        );

      } else {

        throw new Error(
          "Вторая камера не найдена."
        );

      }

    } catch (
      fallbackError
    ) {

      console.error(
        "Fallback camera error:",
        fallbackError
      );

      showToast(
        "Не удалось переключить камеру."
      );

    }

  }

}


/*
==================================================
CONTROLS
==================================================
*/

function updateControls() {

  if (micButton) {

    micButton.textContent =
      micEnabled
        ? "🎙️"
        : "🔇";

    micButton.classList.toggle(
      "off",
      !micEnabled
    );

  }


  if (cameraButton) {

    cameraButton.textContent =
      cameraEnabled
        ? "📷"
        : "🚫";

    cameraButton.classList.toggle(
      "off",
      !cameraEnabled
    );

  }

}


/*
==================================================
CLEAR REMOTE
==================================================
*/

function clearRemoteMedia() {

  try {

    if (remoteVideo) {

      remoteVideo.srcObject =
        null;

    }

  } catch {}


  remoteAudioElements
    .forEach(
      audio => {

        try {

          audio.remove();

        } catch {}

      }
    );


  remoteAudioElements =
    [];


  if (
    room
  ) {

    for (
      const participant of
        room.remoteParticipants.values()
    ) {

      for (
        const publication of
          participant.trackPublications.values()
      ) {

        if (
          publication.track
        ) {

          try {

            publication.track.detach();

          } catch {}

        }

      }

    }

  }

}


/*
==================================================
HANGUP
==================================================
*/

async function hangup() {

  /*
  Отключаем LiveKit.
  LiveKit сам остановит
  опубликованные локальные
  tracks при disconnect(true).
  */

  if (room) {

    try {

      await room.disconnect(
        true
      );

    } catch (error) {

      console.error(
        "Disconnect error:",
        error
      );

    }

  }


  room =
    null;


  clearRemoteMedia();


  /*
  Локальное видео.
  */

  try {

    localVideo.srcObject =
      null;

  } catch {}


  /*
  Сбрасываем состояние.
  */

  micEnabled =
    true;

  cameraEnabled =
    true;

  facingMode =
    "user";


  updateControls();


  localPlaceholder
    ?.classList
    .remove(
      "hidden"
    );

  remotePlaceholder
    ?.classList
    .remove(
      "hidden"
    );


  setConnectionStatus(
    "Звонок завершён"
  );


  showStartScreen();


  setStartStatus(
    ""
  );


  showToast(
    "Звонок завершён."
  );

}


/*
==================================================
CREATE CALL
==================================================
*/

async function createCall() {

  try {

    startButton.disabled =
      true;

    joinButton.disabled =
      true;


    roomCode =
      generateRoomCode();


    identity =
      createIdentity();


    myPeerId.textContent =
      roomCode;


    await connectToRoom(
      roomCode
    );


    setConnectionStatus(
      "Ожидание собеседника..."
    );


    if (
      remotePlaceholderText
    ) {

      remotePlaceholderText.textContent =
        "Ожидание собеседника...";

    }


    showToast(
      "Звонок создан. Передайте код собеседнику."
    );


  } catch (error) {

    console.error(
      "Create call error:",
      error
    );

    showStartStatus(
      error.message ||
      "Не удалось создать звонок."
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
JOIN CALL
==================================================
*/

async function joinCall() {

  const code =
    String(
      remoteIdInput.value ||
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


  if (
    code.length !==
    6
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


    identity =
      createIdentity();


    roomCode =
      code;


    myPeerId.textContent =
      code;


    await connectToRoom(
      code
    );


    setConnectionStatus(
      "Подключено. Ожидание видео..."
    );


  } catch (error) {

    console.error(
      "Join call error:",
      error
    );


    setStartStatus(
      error.message ||
      "Не удалось подключиться."
    );


    if (room) {

      try {

        await room.disconnect(
          true
        );

      } catch {}

      room =
        null;

    }

  } finally {

    startButton.disabled =
      false;

    joinButton.disabled =
      false;

  }

}


/*
==================================================
COPY BUTTONS
==================================================
*/

copyIdButton?.addEventListener(
  "click",
  () => {

    if (
      roomCode
    ) {

      copyText(
        roomCode
      );

    }

  }
);


copyMyIdButton?.addEventListener(
  "click",
  () => {

    if (
      roomCode
    ) {

      copyText(
        roomCode
      );

    }

  }
);


/*
==================================================
BUTTONS
==================================================
*/

startButton?.addEventListener(
  "click",
  createCall
);


joinButton?.addEventListener(
  "click",
  joinCall
);


micButton?.addEventListener(
  "click",
  toggleMicrophone
);


cameraButton?.addEventListener(
  "click",
  toggleCamera
);


switchCameraButton?.addEventListener(
  "click",
  switchCamera
);


hangupButton?.addEventListener(
  "click",
  hangup
);


/*
==================================================
ENTER CODE
==================================================
*/

remoteIdInput?.addEventListener(
  "input",
  () => {

    remoteIdInput.value =
      remoteIdInput.value
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
);


remoteIdInput?.addEventListener(
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


/*
==================================================
PAGE VISIBILITY
==================================================
*/

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible" &&
      room
    ) {

      /*
      LiveKit сам занимается
      восстановлением соединения.
      */

      console.log(
        "PWA visible, room:",
        room.name
      );

    }

  }
);


/*
==================================================
INITIAL STATE
==================================================
*/

showStartScreen();

updateControls();

console.log(
  "Video Call PWA — LiveKit"
);
