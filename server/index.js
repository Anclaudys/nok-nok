const PORT = 8080;
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);
const io = require('socket.io').listen(server);
const path = require('path');
//io.set('log level', 2);

app.use(express.static(path.join(__dirname, '..', 'public')));

server.listen(PORT, null, function () {
  console.log('Listening on port ' + PORT);
});
//main.use(express.bodyParser());

app.get('/', function (req, res) {
  res.sendFile(
    '/home/anclaudys/Documents/mine/start/PairExercise.ContactList/public/index.html'
  );
});
// main.get('/index.html', function(req, res){ res.sendfile('newclient.html'); });
// main.get('/client.html', function(req, res){ res.sendfile('newclient.html'); });

/*************************/
/*** INTERESTING STUFF ***/
/*************************/
const channels = {};
const sockets = {};

/**
 * Users will connect to the signaling server, after which they'll issue a "join"
 * to join a particular channel. The signaling server keeps track of all sockets
 * who are in a channel, and on join will send out 'addPeer' events to each pair
 * of users in a channel. When clients receive the 'addPeer' even they'll begin
 * setting up an RTCPeerConnection with one another. During this process they'll
 * need to relay ICECandidate information to one another, as well as SessionDescription
 * information. After all of that happens, they'll finally be able to complete
 * the peer connection and will be streaming audio/video between eachother.
 */
io.sockets.on('connection', (socket) => {
  socket.channels = {};
  sockets[socket.id] = socket;

  console.log('[' + socket.id + '] connection accepted');
  socket.on('disconnect', () => {
    for (let channel in socket.channels) {
      part(channel);
    }
    console.log('[' + socket.id + '] disconnected');
    delete sockets[socket.id];
  });

  socket.on('join', (config) => {
    console.log('[' + socket.id + '] join ', config);
    const channel = config.channel;
    const userdata = config.userdata;

    if (channel in socket.channels) {
      console.log('[' + socket.id + '] ERROR: already joined ', channel);
      return;
    }

    if (!(channel in channels)) {
      channels[channel] = {};
    }

    for (id in channels[channel]) {
      channels[channel][id].emit('addPeer', {
        peer_id: socket.id,
        should_create_offer: false,
      });
      socket.emit('addPeer', { peer_id: id, should_create_offer: true });
    }

    channels[channel][socket.id] = socket;
    socket.channels[channel] = channel;
  });

  function part(channel) {
    console.log('[' + socket.id + '] part ');

    if (!(channel in socket.channels)) {
      console.log('[' + socket.id + '] ERROR: not in ', channel);
      return;
    }

    delete socket.channels[channel];
    delete channels[channel][socket.id];

    for (id in channels[channel]) {
      channels[channel][id].emit('removePeer', { peer_id: socket.id });
      socket.emit('removePeer', { peer_id: id });
    }
  }
  socket.on('part', part);

  socket.on('relayICECandidate', (config) => {
    const peer_id = config.peer_id;
    const ice_candidate = config.ice_candidate;
    console.log(
      '[' + socket.id + '] relaying ICE candidate to [' + peer_id + '] ',
      ice_candidate
    );

    if (peer_id in sockets) {
      sockets[peer_id].emit('iceCandidate', {
        peer_id: socket.id,
        ice_candidate: ice_candidate,
      });
    }
  });

  socket.on('relaySessionDescription', (config) => {
    const peer_id = config.peer_id;
    const session_description = config.session_description;
    console.log(
      '[' + socket.id + '] relaying session description to [' + peer_id + '] ',
      session_description
    );

    if (peer_id in sockets) {
      sockets[peer_id].emit('sessionDescription', {
        peer_id: socket.id,
        session_description: session_description,
      });
    }
  });
});
