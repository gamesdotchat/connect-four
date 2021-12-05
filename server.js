var express = require('express')
var ws = require('./ws')

const dotenv = require("dotenv")
dotenv.config()


var app = express()

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/site.html');
})

app.get('/site.css', function (req, res) {
    res.sendFile(__dirname + '/site.css');
})

app.get('/img/web-bg.jpg', function (req, res) {
    res.sendFile(__dirname + '/img/web-bg.jpg');
})

app.get('/client.css', function (req, res) {
    res.sendFile(__dirname + '/client.css');
})

app.get('/client.js', function (req, res) {
    res.sendFile(__dirname + '/client.js');
})

app.get('*', function (req, res) {
    res.sendFile(__dirname + '/client.html');
})

app.listen(3000, function () {
  console.log('Connect 4 app listening on port 3000!')
})
