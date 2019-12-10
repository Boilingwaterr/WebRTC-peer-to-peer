'use strict';

const localVideo = document.querySelector('#localVideo');
const remoteVideo1 = document.querySelector('#remoteVideo');
const remoteVideo2 = document.querySelector('#remoteVideo');
const sendText = document.querySelector('#message_input');
const receiveText = document.querySelector('#chat_log');
const sendButton = document.querySelector('#send_Button');
const nickName = document.querySelector('#nick-name');
const servers = null;


let peers = {};
let localStream;
let remoteStream;
// let localPeerConnection;
// let remotePeerConnection;
let pc, turnReady, sendChannel, receiveChannel;

let isStarted = false;
let isInitiator = false;
let isChannelReady = false;

//генерируем информацию от пользователя.
let min = 1;
let max = 6;
let random = Math.floor(Math.random() * (max - min)) + min;
let alertClass;
switch (random) {
    case 1:
        alertClass = 'secondary';
        break;
    case 2:
        alertClass = 'danger';
        break;
    case 3:
        alertClass = 'success';
        break;
    case 4:
        alertClass = 'warning';
        break;
    case 5:
        alertClass = 'info';
        break;
    case 6:
        alertClass = 'light';
        break;
}


function id() {
    return (Math.random() * 10000 + 10000 | 0).toString();
}

// подключение socket io.
let numOfClients, toPeer, myID;
let room = 'Room_one'
let myInfo = { 'id': myID, 'myColor': alertClass, 'room': room };
let socket = io.connect();
if (room !== '') {
    socket.emit('create or join', room, JSON.stringify(myInfo)); //
    console.log(`Attempted to create or join room: ${room}`);
}
socket.on('created', (room) => {
    console.log(`Created room: ${room}.`);
});

socket.on('full', (room) => {
    console.log(`Room ${room} is full`);
});

socket.on('new', (message) => {
    let json = JSON.parse(message);
    console.log(json);
})

socket.on('join', (room, numClients) => { //new string for some test
    isInitiator = true;
    numOfClients = numClients;
    console.log(`Another peer made a request to join room ${room}.`); //new string for some test
    console.log(`This peer is the initiator of room ${room}.`);
    isChannelReady = true;
    //new string for some test
    maybeStart();
});

socket.on('joined', (room, socket_id) => {
    myID = socket_id;
    isChannelReady = true;
    console.log(`joined to ${room}.`);
});

socket.on('log', function(logArray) {
    console.log.apply(console, logArray);
});

// клиент отсылает сообщение.
function sendMessage(message, toPeer) {
    console.log(`Client send message ${message}.`);
    socket.emit('message', message, JSON.stringify({
        room: room,
        id: myID,
        to: toPeer,
    })); //message
}

//
socket.on('new', (socket_id) => {
    toPeer = JSON.parse(socket_id);
    console.log(toPeer);
    socket.emit('topeer', JSON.stringify(toPeer));
});
socket.on('topeer', (msg) => {
    console.log(msg);
});

socket.on('message', (message) => {

    console.log(`Client received message: ${message}.`);


    if (message === 'got user media.') {
        maybeStart();


    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            maybeStart();

        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();


    } else if (message.type === 'answer' && isStarted) {
        pc.setRemoteDescription(new RTCSessionDescription(message));


    } else if (message.type === 'candidate' && isStarted) {
        let candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }
});
////////////////////////////////////////////////////////////////////

// разрешения медиа
const mediaStreamConstraints = {
    video: true,
    audio: false
};

//настройка обмена видео
const offerOptions = {
    offerToReceiveVideo: 1,
};

//определяем начало сессии
let startTime = null;

//настраиваем медиапоток в плеере
function gotLocalMediaStream(mediaStream) {
    localVideo.srcObject = mediaStream;
    localStream = mediaStream;
    trace('Received local stream.');
    sendMessage('got user media.');
}
navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    .then(gotLocalMediaStream).catch(StreamError);
trace(`requeststing local stream.`);

console.log('Getting user media with constraints.');

function maybeStart() {
    if (isStarted === false && typeof localStream !== 'undefined' && isChannelReady) {

        createPeerConnection();
        // localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        pc.addStream(localStream); //same gettracks
        isStarted = true;
        console.log('isInitiator', isInitiator);

        if (isInitiator) {
            trace(`starting call.`);
            startTime = window.performance.now();
            console.log(isStarted, isInitiator);
            doCall();
        }
    }
}

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(servers);
        sendChannel = pc.createDataChannel('chat', null);
        pc.onicecandidate = handleIceCandidate;
        // pc.ontrack = gotRemoteMediaStream;
        pc.onaddstream = gotRemoteMediaStream;
        pc.onremovestream = handleRemoteStreamRemoved;
        pc.ondatachannel = receiveChannelCallback;
        trace('Created peer connection.')
    } catch (err) {
        trace(`Failed to create PeerConnection, exception: ${err.message}`);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    trace(`icecandidate event: ${event}`);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        }, toPeer);
    } else {
        trace('End of candidates.');
    }
}

//обработчик ошибок вывод в консоль
function StreamError(error) {
    trace(`navigator.getUserMedia error: ${error.toString()}.`);
}

//обработчик удаленного медапотока в случае успеха добавляет в remoteVideo src;
function gotRemoteMediaStream(event) {
    // const mediaStream = event.stream;
    remoteStream = event.stream;
    remoteVideo1.srcObject = remoteStream;
    // remoteVideo1.srcObject = event.streams[0]; //remoteStream;
    trace('Remote peer connection received remote stream.');
    isStarted = false;

}

// Добавить поведение для видеопотоков.

// логи с id и размером видеоэлемента
function logVideoLoaded(event) {
    const video = event.target;
    trace(`${video.id} videoWidth: ${video.videoWidth}px, ` +
        ` videoHeight: ${video.videoHeight}px.`)
}

// лог который сработает после начала потока.
function logResizedVideo(event) {
    logVideoLoaded(event)
    if (startTime) {
        const elapsedTime = window.perfomance.now() - startTime;
        startTime = null;
        trace(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
    }
}

localVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo1.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo1.addEventListener('onresize', logResizedVideo);

function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
}

function doCall() {
    trace('Sending offer to peer');
    pc.createOffer().
    then(setLocalAndSendMessage, handleCreateOfferError);

}

function doAnswer() {

    console.log('Sending answer to peer.');
    pc.createAnswer().
    then(setLocalAndSendMessage, onCreateSessionDescriptionError);
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription, toPeer);
    // pc.currentLocalDescription = "";
    // pc.currentRemoteDescription = "";
}

function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
}

// sending data.
function sendData() { // using now.
    socket.emit('sendColor', { //sending color to server
        className: alertClass
    });
    let data = `${nickName.value.bold()}: ${sendText.value}`;
    if (sendText.value === '') {
        data = null
    } else {
        //adding message to log from self
        receiveText.innerHTML += `<div id='userMessage' class='alert alert-${alertClass}'>${data}</div><hr>`;
        sendChannel.send(data);
        sendText.value = '';
        receiveText.scrollTop = 99999;
        trace(`Sent Data: ${data}.`);
    }
}
sendButton.onclick = sendData;
let colorName;
socket.on('getColor', (data) => { //getting color
    colorName = data.className;
});
// send message to other peers
function onReceiveMessageCallback(event) {
    trace('Received Message');
    receiveText.innerHTML += `<div id='userMessage' class='alert alert-${colorName}'> ${event.data}</div><hr>`;
    receiveText.scrollTop = 99999;
}

function receiveChannelCallback(event) {
    trace('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
}


//обработчик hangUpButton: завершение звонка.
function hangUpAction() {
    stop();
    isInitiator = false;
    trace(`ending call.`);
}

function stop() {
    isStarted = false;
    pc.close();
    pc = null;
}

function handleRemoteStreamRemoved(event) {
    trace(`Remote stream removed. Event: ${event}`);
}
let hangUpButton = document.querySelector('.HangUpButton');
hangUpButton.addEventListener('click', hangUpAction);

//LOGS.
function trace(text) {
    let nowDateTrace = new Date();
    text = text.trim();
    const now = (window.performance.now() / 1000).toFixed(3);
    let nowTimeTrace, hoursTrace, minutesTrace, secondsTrace;
    hoursTrace = nowDateTrace.getHours();
    minutesTrace = nowDateTrace.getMinutes();
    secondsTrace = nowDateTrace.getSeconds();
    nowTimeTrace = `${hoursTrace}:${minutesTrace}:${secondsTrace}`;
    console.log(nowTimeTrace, text, now);
}



// //date setting for message.
// let nowDate = new Date();
// let nowTime, hours, minutes, seconds;
// hours = nowDate.getHours();
// minutes = nowDate.getMinutes();
// seconds = nowDate.getSeconds();
// nowTime = `${hours}:${minutes}:${seconds}`;