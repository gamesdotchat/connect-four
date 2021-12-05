import Game from './src/game.js'
import WebSocket from 'ws'

const wss = new WebSocket.Server({ port: 8080 });

let games = []

const regex = /^!(\w*)\s(.*)/gm;

wss.on('connection', function (ws) {
  let _ws = ws
  _ws.isAlive = true
  _ws.game = false
  _ws.pings = 0
  _ws.on('message', function (message) {
    if (_ws.game !== false) {
      console.log(`${_ws.game.channel} received: ${message}`)
    } else {
      console.log('received: %s', message)
    }
    let m = regex.exec(message)
    regex.lastIndex = 0
    if (m === null) return
    switch (m[1]) {
      case 'channel':
        let wsGame = false
        let channel = m[2].toLowerCase()
        // find any open games
        games.forEach(game => {if (game.channel == channel) wsGame = game})
        // create new game when needed
        if (wsGame === false) {
          wsGame = new Game(m[2].toLowerCase(), process.env.TMI_USER, process.env.TMI_PASS)
          games.push(wsGame)
        }
        // attach ws to game
        _ws.game = wsGame
        _ws.game.addWS(_ws)
        _ws.game.sendState(_ws)
        break
      case 'reset':
        _ws.game.resetBoard()
        break
      case 'ping':
        _ws.isAlive = true
        ws.send('!pong ' + m[2])
        break
      case 'pong':
        _ws.isAlive = true
        break
    }
  })
  _ws.on('close', function () {
    // clean up twitch connection
    _ws.isAlive = false
    if (_ws.game !== false) {
      console.log("closing " + _ws.game.channel)      
    }
  })
  _ws.on('error', function (err) {
    console.log(err)
    //_ws.isAlive = false
    // clean up twitch connection
    if (_ws.game !== false) {
      console.log("error: " + _ws.game.channel)
    }
  })
})

/*
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      if (ws.game !== false) {
        console.log("terminating: " + ws.game.channel)
      }
      return ws.terminate()
    }

    ws.isAlive = false
    ws.pings++
    ws.send('!ping ' + ws.pings)
  });
}, 10000);
*/

wss.on('close', function close() {
  clearInterval(interval);
});
