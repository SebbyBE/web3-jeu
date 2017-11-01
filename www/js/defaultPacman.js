var map = "assets/pacman-map.json";

var randTeam = Math.floor(Math.random() * 2) + 1;
alert("Vous êtes dans la team : " + randTeam);

var spawn1 = {
	x: 24,
	y: 232
}

var spawn2 = {
	x: 424,
	y: 232
}

/*
 Default Pacman game
*/
var defaultState = {
	/*
	 * Window auto adjust to client window size + start physics managing in phase
	 */
	init: function() {
		this.map = null;
		this.layer = null;
		this.pacman = null;
		this.skin = null;
		this.safetile = 14;
		this.gridsize = 16;
		this.speed = 150;
		this.threshold = 3;
		this.networkThreshold = 15;
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
		this.scores = [0,0];
		this.scoresDisplay = null;
		//Receives a random team, will be changed later
		this.team = null;
		this.playerId = null;

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
		this.scoresDisplay = this.add.text(0, 0, "000 | 000",{ font: "12px Arial", backgroundColor: "#000000", fill: "#ffffff", align: "center",boundsAlignH: "center", boundsAlignV: "top" });
		this.scoresDisplay.setTextBounds(0,0,400,0);
		this.scoresDisplay.fixedToCamera = true;
		this.map.createFromTiles(7, this.safetile, 'dot', this.layer, this.dots);
		this.world.setBounds(0, 0, 1920, 1920);
		//  The dots will need to be offset by 6px to put them back in the middle of the grid => I trust the dude from the tutorial lmao
		this.dots.setAll('x', 6, false, false, 1);
		this.dots.setAll('y', 6, false, false, 1);
		//  Pacman should collide with everything except the safe tile
		this.map.setCollisionByExclusion([this.safetile], true, this.layer);
		//skin is hardcoded, should be added to GUI later
		this.team = randTeam;
		this.createLocalPlayer({
			skin: 'pacman'
		});
		//Enabling gamepad
		game.input.gamepad.start();
		pad1 = game.input.gamepad.pad1;

		defaultPacmanSockets();
	},
	updatePlayer: function(data) {
		var player;
		var speed = this.speed;
		if (!(player = this.players[data.playerId]))
			return;
		//player died
		if (!data.isAlive) {
			this.killPlayer({
				playerId: data.playerId
			});
			return;
		}

		player.scale.x = 1;
		player.angle = 0;
		if (data.dir === Phaser.LEFT) {
			player.scale.x = -1; //invert the sprite
			speed = -speed;
		} else if (data.dir === Phaser.UP) {
			player.angle = 270;
			speed = -speed
		} else if (data.dir === Phaser.DOWN) {
			player.angle = 90;
		}

		//regulate speed OR replace player if detla too big
		if(!this.math.fuzzyEqual(player.y, data.y, this.networkThreshold) || !this.math.fuzzyEqual(player.x, data.x, this.networkThreshold)){
			player.x = data.x;
			player.y = data.y;
		}else{
			speed += this.math.max((data.x - player.x)*2,(player.y - data.y));
		}
		
		if (data.dir === Phaser.LEFT || data.dir === Phaser.RIGHT) {
			player.body.velocity.x = speed;
		} else {
			player.body.velocity.y = speed;
		}
	},
	updateScores: function(scores) {
		this.scores = scores;
		this.scoresDisplay.setText(('000'+scores[0]).slice(-3)+" | "+('000'+scores[1]).slice(-3));
		('0000'+scores[0]).slice(-4);
	},
	//create player movable with keys
	createLocalPlayer: function(data) {
		if (this.pacman) { // this.pacman is not null
			if (this.pacman.alive) { //check if alive before reinstancing
				return;
			}
		}
		this.skin = data.skin;
		var xSpawn;
		var ySpawn;
		if (this.team === 1) {
			xSpawn = spawn1.x;
			ySpawn = spawn1.y;
		} else if (this.team === 2) {
			xSpawn = spawn2.x;
			ySpawn = spawn2.y;
		}
		//  Position Pacman at grid location 14x17 (the +8 accounts for his anchor) => still trusting
		this.pacman = this.add.sprite(xSpawn, ySpawn, data.skin, 0);
		this.pacman.anchor.set(0.5);
		this.pacman.animations.add('munch', [0, 1, 2, 1], 20, true); //Add crunching animation to the character with the pacman.png sprite
		this.physics.arcade.enable(this.pacman);
		this.pacman.body.setSize(16, 16, 8, 8);
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
		newPlayer.body.setSize(16, 16, 8, 8);
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
		//  Only update sprite when change direction (not at EVERY frame)
		//	Send update to server (reduce rubberbanding effect caused by lag)
		if(this.current != direction){
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
			this.positionUpdate();
		}
		
	},

	positionUpdate: function(){
		if(this.pacman===null){return;}
		socket.emit('positionUpdate', {
			x: this.pacman.x,
			y: this.pacman.y,
			dir: this.current
		})
	},

	eatDot: function(pacman, dot) {
		dot.kill();
		if (this.dots.total === 0) {
			this.dots.callAll('revive');
		}
	},
	eatDot: function(pacman, dot) {
		/*
		dot.kill();
		if (this.dots.total === 0) {
			this.dots.callAll('revive');
		}
		*/
		socket.emit('eatDot', this.dots.getChildIndex(dot));
	},
	//kill local player
	destroyPlayer: function() {
		this.pacman.kill();
		//socket.emit('playerIsDead');
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
	//Dot eated by not local player
	eatedDot: function(dot) {
		this.dots.getChildAt(dot).kill();
	},
	/*
	 * Called at each frame
	 */
	update: function() {
		//check collides
		this.physics.arcade.collide(this.pacman, this.layer);
		this.physics.arcade.overlap(this.pacman, this.dots, this.eatDot, null, this);

		/* gérer coté serveur
		//collision entre le joueur et les ennemis
		this.physics.arcade.collide(this.pacman, this.enemies, this.destroyPlayer);
		this.physics.arcade.collide(this.pacman, this.allies);
		*/

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
			this.positionUpdate();
		}
	}
}


function defaultPacmanSockets() {

	//Another player disconnected
	socket.on('disconnectedUser', function(data) {
		game.state.callbackContext.killPlayer(data);
	});

	//Receiption of eated dot
	socket.on('dotEated', function(dot, scores) {
		game.state.callbackContext.eatedDot(dot);
		game.state.callbackContext.updateScores(scores);
		
	});

	//Getting all currently connected player
	socket.on('users', function(data) {
		game.state.callbackContext.playerId = data.playerId;
		for (var player in data.players) {
			if (player === data.playerId) {
				//doesn't create itself
				continue;
			}
			game.state.callbackContext.createPlayer(data.players[player]);
		}
	});

	//A new player connected
	socket.on('user', function(data) {
		game.state.callbackContext.createPlayer(data);
	});

	socket.on('dotInit', function(grid, scores) {
		for (var i = 0; i < grid.length; i++) {
			if (grid[i] == 0) {
				game.state.callbackContext.eatedDot(i);
			}
		}
		game.state.callbackContext.updateScores(scores);
	})

	//Server sent current state
	socket.on('gameUpdate', function(players) {
		for (var player in players) {
			if (players[player].playerId === game.state.callbackContext.playerId) {
				//info sur sois même
				if (!players[player].isAlive) {
					game.state.callbackContext.destroyPlayer();
				}
				continue;
			}
			game.state.callbackContext.updatePlayer(players[player]);
		}
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
