var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname);


// -- Mount static files here--
// All static middleware should be registered at the end, as all requests
// passing the static middleware are hitting the file system
// Example:
var path = require('path');
app.use(loopback.static(path.resolve(__dirname, '../client')));



app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    console.log('Web server listening at: %s', app.get('url'));
  });
};

// start the server if `$ node server.js`
if (require.main === module) {
  app.start();
}








var http = require('http'), fs = require('fs'), index = fs.readFileSync(__dirname + '/index.html');

var appsocket = http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(index);
});

var io = require('socket.io').listen(appsocket);

var all_sockets = [];


io.sockets.on('connection', function(socket) {
	//socket.send({ "server_time": Date.now() })

	socket.on('join', function(room) {
		socket.join(room);
	});

	socket.on('leave', function(room) {
		socket.leave(room);
	});

    socket.on('ping', function(data) {
        // data.server_time = Date.now();
        io.to(data.name).emit('pong', data)
    });

    socket.on('sing', function(data) {
        io.to(data.name).emit('song', data)
    });

});



appsocket.listen(3001);





