var app = require("express")();
var server = require("http").Server(app);
var io = require("socket.io")(server);
var cors = require("cors"); // Import the cors middleware

app.use(cors());

server.listen(3000, () => {
	console.log("running server..");
})

//var enemies = []
var clients = []
var playerInitialSpawnPoints = []
var countdownIntervalId = 0;

let countdown = 100; // Initial countdown value in seconds

app.get("/", (req, res) => {
	res.send("hey got back response");
})

gameTimerJson = {
	TimerText: 0,
}

// Function to emit countdown updates every second
function startCountdown() {
	
	countdownIntervalId = setInterval(()=>{
		if (countdown > 0) {
			countdown--;
			gameTimerJson.TimerText = countdown;
			io.emit('game timer', gameTimerJson);
		}
		else{
			clearInterval(countdownIntervalId); // Stop the interval after 5 seconds
			runGameOver();
		}
		
	}, 1000); // 1000 milliseconds = 1 second

	
	console.log("countdown  after strated  "+countdownIntervalId);

}

function runGameOver() {

	let maxKills = 0;
	let maxKillsPlayer;
	for (let i = 0; i < clients.length; i++) {
		if (maxKills <= clients[i].Kills) {
			maxKills = clients[i].Kills;
			maxKillsPlayer = clients[i];
		}
	}

	gameOverData = {
		WinnerName: maxKillsPlayer.Name,
		WinnerId: maxKillsPlayer.Id,
		MaxKills: maxKills,
		PlayersList: clients,
	}

	console.log("game over data send "+ JSON.stringify(gameOverData));
	io.emit("game over", gameOverData);
}

io.on("connection", (socket) => {

	var currentPlayer = {};
	currentPlayer.Name = "unknown";

	socket.on('message', (data) => {

		//Client have sent some message please do something about it.  
		console.log('Message from client', data);
		//sending response to client side
		socket.emit('message', { date: new Date().getTime(), data: data });
	});

	socket.on("PlayerConnect", () => {
		console.log(currentPlayer.Name + " recv : player connect ");
		console.log("total clients connected " + clients.length);

		if(clients.length!=0 && clients.length == playerInitialSpawnPoints.length){
			return;
		}

		for (var i = 0; i < clients.length; i++) {

			var playerConnected = {
				Name: clients[i].Name,
				Id: clients[i].Id,
				TankType: clients[i].TankType,
				Position: clients[i].Position,
				Rotation: clients[i].Rotation,
				Health: clients[i].Health
			}

			socket.emit("other player connected", playerConnected);
			console.log(currentPlayer.Name + " emit other player connected " + JSON.stringify(playerConnected));
		}

		gameTimerJson.TimerText = countdown;
		socket.emit('game timer', gameTimerJson);

		if(countdownIntervalId == 0){
			startCountdown();
		}
	});

	var result;

	socket.on("play", (data) => {
		
		if(clients.length!=0 && clients.length == playerInitialSpawnPoints.length){
			return;
		}

		console.log(currentPlayer.Name + " recv : player name " + JSON.stringify(data));
		result = JSON.parse(data);

		if (clients.length == 0) {

			result.PlayerSpawnPoints.forEach(element => {
				var playerSpawnPoint = {
					position: element.position,
					rotation: element.rotation,
				}
				playerInitialSpawnPoints.push(playerSpawnPoint);
			});
		}

		let index = clients.length;

		let randomSpawnPoint = playerInitialSpawnPoints[index];

		currentPlayer = {
			Name: result.Name,
			TankType: result.TankType,
			Id: guid(),
			Kills: 0,
			Position: randomSpawnPoint.position,
			Rotation: randomSpawnPoint.rotation,
			Health: 100
		};
		clients.push(currentPlayer);

		// in your current game, tell you that you have joined
		console.log(currentPlayer.Name + ' emit: play: ' + JSON.stringify(currentPlayer));
		socket.emit('play', currentPlayer);

		// in your current game, we need to tell the other players about you.
		socket.broadcast.emit('other player connected', currentPlayer);
	});

	socket.on('player move', function (data) {
		let positionData = JSON.parse(data);
		currentPlayer.Position = positionData.Position;
		socket.broadcast.emit('player move', currentPlayer);
	});

	socket.on('player turn', function (data) {
		let rotationData = JSON.parse(data);
		currentPlayer.Rotation = rotationData.Rotation;
		socket.broadcast.emit('player turn', currentPlayer);
	});

	socket.on('player shoot', function () {
		var data = {
			Name: currentPlayer.Name,
			Id: currentPlayer.Id
		};
		
		socket.broadcast.emit('player shoot', data);
	});

	socket.on("killed", function (data) {

		console.log(currentPlayer.Name + ' recv: killed: ' + JSON.stringify(data));
		let killedData = JSON.parse(data);

		currentPlayer.Kills = killedData.Kills;

	});

	socket.on("died self", function () {

		let killedClientIndex = 0;

		console.log(currentPlayer.Name + ' recv: died: ');

		if (countdown <= 0) {
			console.log("countdown finish do not spawn");
			return;
		}

		for (let i = 0; i < clients.length; i++) {
			if (currentPlayer.Id == clients[i].Id) {
				killedClientIndex = i;
				break;
			}
		}

		currentPlayer.Position = playerInitialSpawnPoints[killedClientIndex].position;
		currentPlayer.Rotation = playerInitialSpawnPoints[killedClientIndex].rotation;
		currentPlayer.Health = 100;

		socket.emit("died", currentPlayer);

		// in your current game, we need to tell the other players about you.
		socket.broadcast.emit("died respawn", currentPlayer);

	});

	socket.on('health', function (data) {

		let healthData = JSON.parse(data);

		currentPlayer.Health = healthData.CurrentHealth;

		let changedHealthUser = {
			Id: currentPlayer.Id,
			CurrentHealth: currentPlayer.Health
		};
		socket.broadcast.emit("update health", changedHealthUser);

	});

	socket.on('disconnect', function () {

		console.log(currentPlayer.Name + ' recv: disconnect ' + currentPlayer.Name);
		socket.broadcast.emit('other player disconnected', currentPlayer);
		console.log(currentPlayer.Name + ' bcst: other player disconnected ' + JSON.stringify(currentPlayer));

		disconnectedClientIndex = -1;

		for (var i = 0; i < clients.length; i++) {
			if (clients[i].Id === currentPlayer.Id) {
				disconnectedClientIndex = i;
				break;
			}
		}
		
		if(disconnectedClientIndex == -1) return;

		clients.splice(disconnectedClientIndex, 1);
	});

})

console.log("listening to 3000.. " + guid());

function guid() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
