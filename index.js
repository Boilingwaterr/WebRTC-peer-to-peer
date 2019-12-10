'use strict';

const express = require('express');
const os = require('os');

let port = 3000;
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
let nowDate = new Date();
let users = {};
server.listen(port, '0.0.0.0', (error) => {
    if (!error) {
        console.log('work');
    } else {
        console.log(`we have a problem: ${error}`)
    }
});
app.use('/', express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/public`);
});

/////////////SOCKETS

io.sockets.on('connection', (socket) => {
    //logs
    function log() {
        let logArray = ['Message from server: '];
        logArray.push.apply(logArray, arguments);
        socket.emit('log', logArray);
    }
    socket.on('message', (message, userInfo) => {
        let json = JSON.parse(userInfo);
        log('Client said: ', message);
        socket.room = json.room;
        socket.user_id = json.id;

        if (json.to !== undefined && users[json.to] !== undefined) { //if we have target
            users[json.to].emit('message', message, userInfo);
            console.log(socket.id);
            // socket.broadcast.to(socket.room).emit('message', message, userInfo);
        } else {
            socket.broadcast.to(socket.room).emit('message', message, userInfo);
        }
    });

    socket.on('create or join', (room, myInfo) => { //
        log(`Received request to create or join room ${room}`);
        let clientsInRoom = io.sockets.adapter.rooms[room];
        let json = JSON.parse(myInfo); //Object with data from user
        users[json.id] = socket; //
        socket.room = json.room; // bind room
        socket.user_id = json.id; //

        //sending other peers about connection new peer
        socket.broadcast.to(socket.room).emit("new", JSON.stringify(json.id));

        console.log(clientsInRoom, socket.room); //
        let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
        log(`Room ${room} now has ${numClients} client(s).`);

        if (numClients === 0) {
            socket.join(socket.room); //socket.join(room);
            log(`Client id: ${socket.id} created room: ${room}.`);
            socket.emit('created', room, socket.id);
        } else if (numClients < 5) {
            log(`Client id: ${socket.id} joined room ${room}.`);
            io.in(socket.room).emit('join', room, numClients); //new string for some test(same io.sockets.in)
            socket.join(socket.room); //socket.join(room);
            socket.emit('joined', room, socket.id);
            io.sockets.in(socket.room).emit('ready');

        } else {
            socket.emit('full', room);
            log(`Room ${room} is full.`);
        } // max 5 clients.
    });

    socket.on('ipAddress', () => {
        let netWorkInterFaces = os.networkInterfaces();
        for (let key in netWorkInterFaces) {
            netWorkInterFaces[key].forEach(elements => {
                if (elements.family === 'IPv4' && elements.address !== '127.0.0.1') {
                    socket.emit('ipAddress', elements.address);
                    console.log(elements.family);
                }
            });
        };
    });
    socket.on('sendColor', (data) => {
        io.sockets.emit('getColor', { className: data.className });
    });
    socket.on('bye', () => {
        console.log('received bye');
    });

});