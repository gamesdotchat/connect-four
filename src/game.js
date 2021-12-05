import tmi from 'tmi.js'
import autoBind from 'auto-bind'

export default class Game {

  constructor (channel, user, pass) {
    autoBind(this)
    this.channel = channel
    this.ws = []
    this.reset_timer = 10
    this.last_msg_time = Date.now()
    this.resetBoard()
    let opts = {
      identity: {
        username: user,
        password: pass
      },
      connection: {
        reconnect: true
      },
      channels: [
        channel
      ]
    }
    this.chat = new tmi.client(opts)

    this.chat.on('chat', this.onChatHandler)
    this.chat.on('connected', this.onConnectedHandler)
    this.chat.on('disconnected', this.onDisconnectedHandler)

    this.players = {}

    // Connect to Twitch:
    this.chat.connect()

    // Watch reset timer
    let _this = this
    setInterval(function () {
      // are we past the reset time?
      if (Math.floor((Date.now() - _this.last_msg_time) / 1000) > _this.reset_timer) {
        _this.resetBoard()
        _this.last_msg_time = Date.now()
      }
    }, 1000, this)

  }

  addWS (ws) {
    this.ws.push(ws)
  }

  sendState (ws) {
    if (ws.isAlive === false) return
    ws.send("!timer " + this.reset_timer)
    ws.send("!status " + this.status)
    for (let x = 0; x < this.board.length; x++) {
      for (let y = 0; y < this.board[x].length; y++) {
        if (this.board[x][y] > 0) {
          ws.send("!drop slot" + (y + 1) + "" + (x + 1) + "." + (this.board[x][y] - 1))
        }
      }
    }
  }

  sendAllWS (msg) {
    // send message to all alive ws, remove any dead ones
    this.ws = this.ws.filter( ws => {
      if (ws.isAlive === false) return false
      ws.send(msg)
      return true
    })
  }

  resetBoard () {
    this.player1 = {name:null,color:null}
    this.player2 = {name:null,color:null}
    this.board = [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0]
    ]
    this.turn = 1
    this.plays = 0
    this.status = "waiting"
    this.sendAllWS("!status waiting")
    this.sendAllWS("!reset 0")
    console.log(this.channel + ": board reset")
  }

  close () {
    this.isConnected = false
  }

  // Called every time the bot connects to Twitch chat:
  onConnectedHandler (addr, port) {
    console.log(`${this.channel}: connected to ${addr}:${port}`)
    this.isConnected = true
  }

  // Called every time the bot disconnects from Twitch:
  onDisconnectedHandler (reason) {
    console.log(`Disconnected: ${reason}`)
    //process.exit(1)
    this.isConnected = false
  }

  onChatHandler (target, context, msg) {
    if (!this.isConnected) return
    if (context.username == 'gamesdotchat') return
    if (context.username == 'connect4bot') return
    if (context.username == 'nightbot') return
    if (context.username == 'streamlabs') return
    if (context.username == 'streamelements') return

    let msg_lower = msg.toLowerCase()
    // quick check to see if might be a play message
    if (msg_lower.indexOf('voteyea') === -1 && msg_lower.indexOf('votenay') === -1) return

    console.log(this.channel + ": " + msg)

    const regex = /(\S+)\s|(\w+)\b/gm
    let m
    let pick = null
    let color = null
    let i = 0
    while ((m = regex.exec(msg_lower)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }

      // The result can be accessed through the `m`-variable.
      switch (m[0]) {
        case 'voteyea':
          pick = i
          color = "green"
          break
        case 'votenay':
          pick = i
          color = "red"
          break
      }
      i++ // next row
    }

    if (pick != null) {
      this.last_msg_time = Date.now()
      if (pick > 6) pick = 6
      if (this.status == 'done') this.resetBoard()
      // begin a game
      if (this.player1.name === null) {
        if (!this.canPlay(context["display-name"])) return
        this.player1.name = context["display-name"]
        this.player1.color = color
        let nextColor = "VoteNay"
        if (color == 'red') nextColor = "VoteYea"
        this.status = 'playing'
        this.sendAllWS("!status playing")
        this.chat.say(this.channel, "/me How to play Connect 4 - Pick the column to drop the disc by offsetting it with other emotes.")
        this.chat.say(this.channel, this.player1.name + " started a new Connect 4 game. They are color " + this.player1.color + ". Another player needs to join using " + nextColor + ".")
        this.move(context["display-name"], pick, color)
        return
      } else if (this.player2.name === null && this.player1.color != color && this.player1.name != context["display-name"]) {
      //} else if (this.player2.name === null && this.player1.color != color) {
        if (!this.canPlay(context["display-name"])) return
        this.player2.name = context["display-name"]
        this.player2.color = color
        this.chat.say(this.channel, "/me How to play Connect 4 - Space your disc with other emotes like: PogChamp PogChamp PogChamp VoteNay")
        this.chat.say(this.channel, this.player2.name + " joined the Connect 4 game. They are color " + this.player2.color + ". It's your turn, " + this.player1.name + ".")
        this.move(context["display-name"], pick, color)
        return
      }
      if (this.status != 'playing') return
      if (this.move(context["display-name"], pick, color)) {
        this.nextMove()
      }
    }
  }

  canPlay(name) {
    if (!this.players[name] || !this.players[name].next || this.players[name].next < Date.now()) return true
    this.chat.say(this.channel, name + " you've recently played. Please wait 5 mins between playing.")
    return false
  }

  setNextPlayTime() {
    let wait = 5 * 60 * 1000 // five mins
    this.players[this.player1.name] = {
      next: Date.now() + wait
    }
    this.players[this.player2.name] = {
      next: Date.now() + wait
    }
  }

  nextMove() {
    // check for a winner
    if (this.hasWon(1)) {
      if (this.plays > 12) {
        this.chat.say(this.channel, this.player1.name + " has won!");
      }
      this.status = 'done'
      this.sendAllWS("!status done")
      this.reset_timer = 60
      this.sendAllWS("!timer 60")
      this.sendAllWS("!message " + this.player1.name + " Won!")
      this.setNextPlayTime()
      return;
    }
    if (this.hasWon(2)) {
      if (this.plays > 12) {
        this.chat.say(this.channel, this.player2.name + " has won!");
      }
      this.status = 'done'
      this.sendAllWS("!status done")
      this.reset_timer = 60
      this.sendAllWS("!timer 60")
      this.sendAllWS("!message " + this.player2.name + " Won!")
      this.setNextPlayTime()
      return;
    }

    // is a draw
    if (this.plays == 42) {
      this.chat.say(this.channel, "It's a draw!");
      this.status = 'done'
      this.sendAllWS("!status done")
      this.reset_timer = 60
      this.sendAllWS("!timer 60")
      this.sendAllWS("!message It's a draw!")
      markLastPlayTime()
      return;    
    }

    if (this.turn == 1) {
      this.chat.say(this.channel, "It's your turn, " + this.player1.name + ".");
    }
    if (this.turn == 2) {
      this.chat.say(this.channel, "It's your turn, " + this.player2.name + ".");
    }
  }

  hasWon(player) {
    // check horizontal 
    for (var x = 0; x < 6; x++) {
      for (var y = 0; y < 4; y++) {
        if (this.board[x][y] == player && this.board[x][y+1] == player && this.board[x][y+2] == player && this.board[x][y+3] == player) return true      
      }
    }

    // check vertical 
    for (var y = 0; y < 7; y++) {
      for (var x = 0; x < 3; x++) {
        if (this.board[x][y] == player && this.board[x+1][y] == player && this.board[x+2][y] == player && this.board[x+3][y] == player) return true      
      }
    }

    // check horizontal down 
    for (var x = 0; x < 3; x++) {
      for (var y = 0; y < 4; y++) {
        if (this.board[x][y] == player && this.board[x+1][y+1] == player && this.board[x+2][y+2] == player && this.board[x+3][y+3] == player) return true      
      }
    }

    // check horizontal up
    for (var x = 3; x < 6; x++) {
      for (var y = 0; y < 4; y++) {
        if (this.board[x][y] == player && this.board[x-1][y+1] == player && this.board[x-2][y+2] == player && this.board[x-3][y+3] == player) return true      
      }
    }

    return false
  }

  move(user, col, color) {
    if (user == this.player1.name && this.turn == 1 && this.player1.color == color) {
      if (this.drop(col)) {
        this.turn = 2
        this.reset_timer = 180
        this.sendAllWS("!timer 180")
        this.plays++
        return true
      }
    }
    if (user == this.player2.name && this.turn == 2 && this.player2.color == color) {
      if (this.drop(col)) {
        this.turn = 1
        this.reset_timer = 180
        this.sendAllWS("!timer 180")
        this.plays++
        return true
      }    
    }
    return false
  }

  drop(col) {
    for (let x = 5; x > -1; x--) {
      if (this.board[x][col] == 0) {
        this.board[x][col] = this.turn
        let c_index = 0 //green
        if (this.turn == 1 && this.player1.color == "red") c_index = 1
        if (this.turn == 2 && this.player2.color == "red") c_index = 1
        this.sendAllWS("!drop slot" + (col + 1) + "" + (x + 1) + "." + c_index)
        return true;
      }
    }
    return false;
  }


}
