var ws;
var isConnected = false
var recievedPong = "waiting"
var pingCounter = 0
var reset_timer = 10
var status = 'waiting'
const regex = /^!(\w*)\s(.*)/gm

function startWS() {
  let protocol = 'wss'
  let port = '8443'
  if (window.location.protocol == 'http:') {
    protocol = 'ws'
    port = '8080'
  }

  ws = new WebSocket(`${protocol}://${window.location.hostname}:${port}`)

  ws.onopen = function () {
      console.log('websocket is connected ...')
      ws.send("!channel " + window.location.pathname.replace("/",""))
      sendPing()
      isConnected = true
  }

  ws.onmessage = function (me) {
      console.log(me.data)
      let m = regex.exec(me.data)
      regex.lastIndex = 0
      //console.log(m)
      if (m === null) return
      switch (m[1]) {
        case 'timer':
          reset_timer = parseInt(m[2])
          break
        case 'drop':
          let values = m[2].split(".")
          document.getElementsByName(values[0]).item(values[1]).checked = true
          break
        case 'reset':
          document.getElementById("game").reset()
          document.getElementById("remaining").innerHTML = "\"VoteYea\" to Play"
          break
        case 'status':
          status = m[2]
          break
        case 'message':
          document.getElementById("remaining").innerHTML = m[2]
          break
        case 'pong':
          recievedPong = "yes"
          break
        case 'ping':
          ws.send('!pong ' + m[2])
          break
      }
  }

  ws.onerror = function () {
    isConnected = false
  }

  ws.onclose = function () {
    isConnected = false
  }

}

function sendPing () {
  if (ws.readyState !== WebSocket.OPEN) return
  setTimeout(function() {
    if (recievedPong !== "yes") {
      recievedPong = "no"
    }
  }, 2000)
  pingCounter++
  recievedPong = "waiting"
  ws.send("!ping " + pingCounter)
}

// connection test
startWS()
setInterval(function() {
  if (isConnected == false || recievedPong == "no") {
    if(ws && typeof ws.close === 'function') ws.close()
    ws = null
    startWS()
    pingCounter = 0
  }
  sendPing()
}, 10000)

// game timer
setInterval(function() {
  if (reset_timer !== null) {
    reset_timer--
    if (status == 'playing')
      document.getElementById("remaining").innerHTML = fancyTimeFormat(reset_timer)
    if (reset_timer <= 0 && ws.readyState === WebSocket.OPEN) {
      document.getElementById("remaining").innerHTML = "\"VoteYea\" to Play"
      ws.send("!reset 0")
      reset_timer = null
    }
  } 
}, 1000)

function fancyTimeFormat(duration) {   
    // Hours, minutes and seconds
    var hrs = ~~(duration / 3600);
    var mins = ~~((duration % 3600) / 60);
    var secs = ~~duration % 60;

    // Output like "1:01" or "4:03:59" or "123:03:59"
    var ret = "";

    if (hrs > 0) {
        ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
    }

    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;
    return ret;
}
