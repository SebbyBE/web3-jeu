/*
 * Canvas init sizes, AUTO => CANVAS OR WEBGL chosen automatically in 4rth parameter div (id), I didn't put it in because it fucks up the scaling
 */

var size = 400
var game = new Phaser.Game(size, size, Phaser.AUTO, "gameDiv");
var map = "assets/pacman-map.json";

//Number or position update infos sent to servers per second if fps is accurate
var howManyInfoPerSecond = 20;
var theoreticalFps = 60;

var randTeam = Math.floor(Math.random() * 2) + 1;
alert("Vous êtes dans la team : " + randTeam);
/*
 * Pacman Class constructor
 */
var Pacman = function(game) {
	this.map = null;
	this.layer = null;
	this.pacman = null;
	this.skin = null;
	this.safetile = 14;
	this.gridsize = 16;
	this.speed = 150;
	this.threshold = 3;
	this.marker = new Phaser.Point();
	this.turnPoint = new Phaser.Point();
	this.directions = [null, null, null, null, null];
	this.opposites = [Phaser.NONE, Phaser.RIGHT, Phaser.LEFT, Phaser.DOWN, Phaser.UP];
	this.current = Phaser.NONE;
	this.turning = Phaser.NONE;
	this.updateNeeded = 0;
	this.enemies = null;
	this.allies = null;
	this.players = {};
	//Receives a random team, will be changed later
	this.team = null;
};

/*
 * Pacman class functions
 */
Pacman.prototype = {
	/*
	 * Window auto adjust to client window size + start physics managing in phase
	 */
	init: function() {
		this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.scale.pageAlignHorizontally = true;
		this.scale.pageAlignVertically = true;
		Phaser.Canvas.setImageRenderingCrisp(this.game.canvas);
		this.physics.startSystem(Phaser.Physics.ARCADE);
	},
	/*
	 * fetch all assets in /assets directory
	 */
	preload: function() {
		this.load.image('dot', 'assets/dot.png');
		this.load.image('tiles', 'assets/pacman-tiles.png');
		this.load.spritesheet('pacman', 'assets/pacman.png', 32, 32);
		this.load.tilemap('map', map, null, Phaser.Tilemap.TILED_JSON);
	},
	/*
	 * Var initialisation of in game items
	 */
	create: function() {
		this.map = this.add.tilemap('map'); //pacman-map.json
		this.map.addTilesetImage('pacman-tiles', 'tiles'); //pacman-tiles.png
		this.layer = this.map.createLayer('Pacman');
		this.dots = this.add.physicsGroup(); //Group of dots (= things to catch could be removed later if we don't need for multiplayer aspect)
		this.enemies = this.add.physicsGroup();
		this.allies = this.add.physicsGroup();
		this.map.createFromTiles(7, this.safetile, 'dot', this.layer, this.dots);
		this.world.setBounds(0, 0, 1920, 1920);
		//  The dots will need to be offset by 6px to put them back in the middle of the grid => I trust the dude from the tutorial lmao
		this.dots.setAll('x', 6, false, false, 1);
		this.dots.setAll('y', 6, false, false, 1);
		//  Pacman should collide with everything except the safe tile
		this.map.setCollisionByExclusion([this.safetile], true, this.layer);
		//skin is hardcoded, should be added to GUI later
		this.createLocalPlayer({
			skin: 'pacman'
		});
		this.team = randTeam;
		//Enabling gamepad
		game.input.gamepad.start();
		pad1 = game.input.gamepad.pad1;

		whenReady();
	},
	updatePlayer: function(data) {
		var player;
		if (!(player = this.players[data.playerId]))
			return;
		player.x = data.x;
		player.y = data.y;

		//change angle
		player.scale.x = 1;
		player.angle = 0;
		if (data.dir === Phaser.LEFT) {
			player.scale.x = -1; //invert the sprite
		} else if (data.dir === Phaser.UP) {
			player.angle = 270;
		} else if (data.dir === Phaser.DOWN) {
			player.angle = 90;
		}
	},
	//create player movable with keys
	createLocalPlayer: function(data) {
		if (this.pacman) { // this.pacman is not null
			if (this.pacman.alive) { //check if alive before reinstancing
				console.log(this.pacman.alive);
				return;
			}
		}
		this.skin = data.skin;
		//  Position Pacman at grid location 14x17 (the +8 accounts for his anchor) => still trusting
		this.pacman = this.add.sprite((14 * 16) + 8, (17 * 16) + 8, data.skin, 0);
		this.pacman.anchor.set(0.5);
		this.pacman.animations.add('munch', [0, 1, 2, 1], 20, true); //Add crunching animation to the character with the pacman.png sprite
		this.physics.arcade.enable(this.pacman);
		this.pacman.body.setSize(16, 16, 0, 0);
		this.cursors = this.input.keyboard.createCursorKeys();
		this.pacman.play('munch'); //play animation
		this.move(Phaser.LEFT); //initial movement
		this.camera.follow(this.pacman); //follow pacman with camera
	},
	//instanciate external player
	createPlayer: function(data) {
		var newPlayer;
		if (data.team === this.team) {
			newPlayer = this.allies.create(data.x, data.y, data.skin);
		} else {
			newPlayer = this.enemies.create(data.x, data.y, data.skin);
		}
		newPlayer.anchor.set(0.5);
		newPlayer.animations.add('munch', [0, 1, 2, 1], 20, true);
		this.physics.arcade.enable(newPlayer);
		newPlayer.body.setSize(16, 16, 0, 0);
		newPlayer.play('munch');
		this.players[data.playerId] = newPlayer;
	},
	checkKeys: function() {

		if (game.input.gamepad.supported && game.input.gamepad.active && pad1.connected) {
			if ((pad1.isDown(Phaser.Gamepad.XBOX360_DPAD_LEFT) || pad1.axis(Phaser.Gamepad.XBOX360_STICK_LEFT_X) < -0.1) && this.current !== Phaser.LEFT) {
				this.checkDirection(Phaser.LEFT);
			} else if ((pad1.isDown(Phaser.Gamepad.XBOX360_DPAD_RIGHT) || pad1.axis(Phaser.Gamepad.XBOX360_STICK_LEFT_X) > 0.1) && this.current !== Phaser.RIGHT) {
				this.checkDirection(Phaser.RIGHT);
			} else if ((pad1.isDown(Phaser.Gamepad.XBOX360_DPAD_UP) || pad1.axis(Phaser.Gamepad.XBOX360_STICK_LEFT_Y) < -0.1) && this.current !== Phaser.UP) {
				this.checkDirection(Phaser.UP);
			} else if ((pad1.isDown(Phaser.Gamepad.XBOX360_DPAD_DOWN) || pad1.axis(Phaser.Gamepad.XBOX360_STICK_LEFT_Y) > 0.1) && this.current !== Phaser.DOWN) {
				this.checkDirection(Phaser.DOWN);
			} else {
				//  This forces them to hold the key down to turn the corner
				this.turning = Phaser.NONE;
			}
		} else {
			if (this.cursors.left.isDown && this.current !== Phaser.LEFT) {
				this.checkDirection(Phaser.LEFT);
			} else if (this.cursors.right.isDown && this.current !== Phaser.RIGHT) {
				this.checkDirection(Phaser.RIGHT);
			} else if (this.cursors.up.isDown && this.current !== Phaser.UP) {
				this.checkDirection(Phaser.UP);
			} else if (this.cursors.down.isDown && this.current !== Phaser.DOWN) {
				this.checkDirection(Phaser.DOWN);
			} else {
				//  This forces them to hold the key down to turn the corner
				this.turning = Phaser.NONE;
			}
		}
	},
	/*
	 * Check if player can go in the requested direction (there is no tile in the way)
	 */
	checkDirection: function(turnTo) {
		if (this.turning === turnTo || this.directions[turnTo] === null || this.directions[turnTo].index !== this.safetile) {
			//  Invalid direction if they're already set to turn that way
			//  Or there is no tile there, or the tile isn't index 1 (a floor tile)
			return;
		}
		//  Check if they want to turn around and can
		if (this.current === this.opposites[turnTo]) {
			this.move(turnTo);
		} else {
			this.turning = turnTo;
			this.turnPoint.x = (this.marker.x * this.gridsize) + (this.gridsize / 2);
			this.turnPoint.y = (this.marker.y * this.gridsize) + (this.gridsize / 2);
		}
	},
	turn: function() {
		var cx = Math.floor(this.pacman.x);
		var cy = Math.floor(this.pacman.y);
		//  This needs a threshold, because at high speeds you can't turn because the coordinates skip past
		if (!this.math.fuzzyEqual(cx, this.turnPoint.x, this.threshold) || !this.math.fuzzyEqual(cy, this.turnPoint.y, this.threshold)) {
			return false;
		}
		//  Grid align before turning
		this.pacman.x = this.turnPoint.x;
		this.pacman.y = this.turnPoint.y;
		this.pacman.body.reset(this.turnPoint.x, this.turnPoint.y);
		this.move(this.turning);
		this.turning = Phaser.NONE;
		return true;
		//We should send info over socket for multiplayer at least here to tell server something moved
	},
	move: function(direction) {
		var speed = this.speed;
		if (direction === Phaser.LEFT || direction === Phaser.UP) {
			speed = -speed; //pacman is going towards negative x and y value (a canvas 0,0 is at top left)
		}
		if (direction === Phaser.LEFT || direction === Phaser.RIGHT) {
			this.pacman.body.velocity.x = speed;
		} else {
			this.pacman.body.velocity.y = speed;
		}
		//  Reset the scale and angle (Pacman is facing to the right in the sprite sheet)
		this.pacman.scale.x = 1;
		this.pacman.angle = 0;
		if (direction === Phaser.LEFT) {
			this.pacman.scale.x = -1; //invert the sprite
		} else if (direction === Phaser.UP) {
			this.pacman.angle = 270;
		} else if (direction === Phaser.DOWN) {
			this.pacman.angle = 90;
		}
		this.current = direction;
	},
	eatDot: function(pacman, dot) {
		dot.kill();
		if (this.dots.total === 0) {
			this.dots.callAll('revive');
		}
	},
	//kill local player
	destroyPlayer: function(pacman, pacmanEnemy) {
		pacman.kill();
		socket.emit('playerIsDead');
		/*game.state.callbackContext.createLocalPlayer({
			skin: 'pacman'
		});*/
		//respawn
	},
	//kill not local player
	killPlayer: function(data) {
		if (!this.players[data.playerId])
			return;
		this.players[data.playerId].kill();
		delete this.players[data.playerId];
		if (this.enemies[data.playerId]) {
			delete this.enemies[data.playerId];
		} else {
			delete this.allies[data.playerId];
		}
	},
	/*
	 * Called at each frame
	 */
	update: function() {
		//check collides
		this.physics.arcade.collide(this.pacman, this.layer);
		this.physics.arcade.overlap(this.pacman, this.dots, this.eatDot, null, this);
		//collision entre le joueur et les ennemis
		this.physics.arcade.collide(this.pacman, this.enemies, this.destroyPlayer);
		this.physics.arcade.collide(this.pacman, this.allies);
		//collision entre les pacmans et le décor
		this.physics.arcade.collide(this.enemies, this.layer);
		this.physics.arcade.collide(this.allies, this.layer);

		this.marker.x = this.math.snapToFloor(Math.floor(this.pacman.x), this.gridsize) / this.gridsize;
		this.marker.y = this.math.snapToFloor(Math.floor(this.pacman.y), this.gridsize) / this.gridsize;
		//  Update our grid sensors
		this.directions[1] = this.map.getTileLeft(this.layer.index, this.marker.x, this.marker.y);
		this.directions[2] = this.map.getTileRight(this.layer.index, this.marker.x, this.marker.y);
		this.directions[3] = this.map.getTileAbove(this.layer.index, this.marker.x, this.marker.y);
		this.directions[4] = this.map.getTileBelow(this.layer.index, this.marker.x, this.marker.y);
		this.checkKeys();
		if (this.turning !== Phaser.NONE) {
			this.turn();
		}
		//sends info $HowManyInfoPerSecond times per second of current position
		//less should decrease server load but might bring collision problems and lags
		//FPS should be 60, if less performance problems, lags
		this.updateNeeded++;
		if (this.updateNeeded == (theoreticalFps / howManyInfoPerSecond)) {
			this.updateNeeded = 0;
			socket.emit('positionUpdate', {
				x: this.pacman.x,
				y: this.pacman.y,
				dir: this.current
			})
		}
	}
};

//starts game with defined Class
game.state.add('Game', Pacman, true);

//Start when game is ready
function whenReady() {

	//Another player disconnected
	socket.on('disconnectedUser', function(data) {
		game.state.callbackContext.killPlayer(data);
	});

	//Getting all currently connected player
	socket.on('users', function(data) {
		console.log("DEBUG : Players already in game sent by server at init:");
		console.log(data);
		for (var user in data) {
			console.log("DEBUG : creating player ...");
			console.log(data[user]);
			game.state.callbackContext.createPlayer(data[user]);
		}
	});

	//A new player connected
	socket.on('user', function(data) {
		game.state.callbackContext.createPlayer(data);
	});

	//Anoter player sent his moving informations
	socket.on('positionUpdate', function(data) {
		game.state.callbackContext.updatePlayer(data);
	});

	//another player died
	socket.on('playerIsDead', function(playerId) {
		game.state.callbackContext.killPlayer({
			playerId: playerId
		});
	});


	//Ask servers for currently connected players
	//And send personal informations
	socket.emit('firstInit', {
		team: game.state.callbackContext.team,
		skin: game.state.callbackContext.skin,
		x: game.state.callbackContext.pacman.x,
		y: game.state.callbackContext.pacman.y,
		dir: game.state.callbackContext.current
	});
}
