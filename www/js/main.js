/*
 * Canvas init sizes, AUTO => CANVAS OR WEBGL chosen automatically in 4rth parameter div (id), I didn't put it in because it fucks up the scaling
 */
var game = new Phaser.Game(448, 496, Phaser.AUTO);

//Number or position update infos sent to servers per second if fps is accurate
var howManyInfoPerSecond = 10;
var theoreticalFps = 60;

/*
 * Pacman Class constructor
 */
var Pacman = function(game) {
	this.map = null;
	this.layer = null;
	this.pacman = null;
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
	this.enemyLayer = null;
	this.players = {};
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
		this.load.tilemap('map', 'assets/pacman-map.json', null, Phaser.Tilemap.TILED_JSON);
	},
	/*
	 * Var initialisation of in game items
	 */
	create: function() {
		this.map = this.add.tilemap('map'); //pacman-map.json
		this.map.addTilesetImage('pacman-tiles', 'tiles'); //pacman-tiles.png
		this.layer = this.map.createLayer('Pacman');
		this.dots = this.add.physicsGroup(); //Group of dots (= things to catch could be removed later if we don't need for multiplayer aspect)
		this.map.createFromTiles(7, this.safetile, 'dot', this.layer, this.dots);
		//this.world.setBounds(0, 0, 1920, 1920);
		//  The dots will need to be offset by 6px to put them back in the middle of the grid => I trust the dude from the tutorial lmao
		this.dots.setAll('x', 6, false, false, 1);
		this.dots.setAll('y', 6, false, false, 1);
		//  Pacman should collide with everything except the safe tile
		this.map.setCollisionByExclusion([this.safetile], true, this.layer);
		//  Position Pacman at grid location 14x17 (the +8 accounts for his anchor) => still trusting
		this.pacman = this.add.sprite((14 * 16) + 8, (17 * 16) + 8, 'pacman', 0);
		this.pacman.anchor.set(0.5);
		this.pacman.animations.add('munch', [0, 1, 2, 1], 20, true); //Add crunching animation to the character with the pacman.png sprite
		this.physics.arcade.enable(this.pacman);
		this.pacman.body.setSize(16, 16, 0, 0);
		this.cursors = this.input.keyboard.createCursorKeys();
		this.pacman.play('munch'); //play animation
		this.move(Phaser.LEFT);
		this.camera.follow(this.pacman); //follow pacman with camera
		whenReady();
	},
	updatePlayer: function(data) {
		if (!this.players[data.playerId])
			return;
		this.players[data.playerId].x = data.x;
		this.players[data.playerId].y = data.y;
	},
	createPlayer: function(data) {
		var newPlayer = this.add.sprite((data.x * 16) + 8, (data.y * 16) + 8, 'pacman', 0);
		newPlayer.anchor.set(0.5);
		newPlayer.animations.add('munch', [0, 1, 2, 1], 20, true);
		this.physics.arcade.enable(newPlayer);
		newPlayer.body.setSize(16, 16, 0, 0);
		newPlayer.play('munch');
		this.players[data.playerId] = newPlayer;
	},
	checkKeys: function() {
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
	killPlayer: function(data) {
		if (!this.players[data.playerId])
			return;
		this.players[data.playerId].kill();
	},
	/*
	 * Called at each frame
	 */
	update: function() {
		//check collides
		this.physics.arcade.collide(this.pacman, this.layer);
		this.physics.arcade.overlap(this.pacman, this.dots, this.eatDot, null, this);

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
				y: this.pacman.y
			})
		}
	}
};

//starts game with defined Class
game.state.add('Game', Pacman, true);


function whenReady() {

	//Another player disconnected
	socket.on('disconnectedUser', function(data) {
		game.state.callbackContext.killPlayer(data);
	});

	//Getting all currently connected player
	socket.on('users', function(data) {
		//remove info about self
		delete data.players[data.playerId];
		for (var user in data.players) {
			game.state.callbackContext.createPlayer(data.players[user]);
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

	//Ask servers for currently connected players
	socket.emit('users');

}
