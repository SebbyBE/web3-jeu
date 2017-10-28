//Cryptage
var bcrypt = require('bcrypt');

//db
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect("mongodb://heroku_user_test:pacmanweb3@ds127375.mlab.com:27375/heroku_djnrjqpc");
var db = mongoose.connection;

//import models
var models = require('./MongoModels.js');
//objects ready to use
var Player = models.players;
var Skin = models.skins;
var Room = models.rooms;

//db connexion OK?
var connectedDB = false;

//verification connection db
db.on('error', console.error.bind(console, 'connection to db error:'));
db.once('open', function() {
    console.log("We are connected");
    //DB usable
    connectedDB = true;
});

exports.Mongo = function(){};

exports.Mongo.prototype = {
    insertPlayer: function(login,password){
        console.log("Mongo.js / mongo proto / IN FUNCTION INSERT");
        if(connectedDB){
            //crypting before insert
            password = bcrypt.hashSync(password, 10);   
            
            var p = new Player({login:login, password : password});
            //promise answer
            return new Promise(function(resolve, reject) {                
                //Check si le login name est deja utilise
                var found = false;
                Player.findOne({ "login" : login},function (err, player) {
                    if (err) return reject(err);
                    if(player==null) {
                        found = false;
                    }
                        else{
                            console.log('%s exists already.', player.login);
                            found = true;
                        }
                });
                if(!found){
                    console.log("Mongo.js / mongo proto / after find -> ready to insert in db");
                    //INSERT IN DB

                    Player.create(p, function(err,player){
                        if (err) {
                            return reject(err);
                        } else {
                            return resolve(true);
                        }
                    });
                }
            })
        }
    },
    connectPlayer: function(login,password, callback){
        console.log("Mongo.js / mongo proto / IN FUNCTION CONNECT");
        if(connectedDB){
            var p = new Player({login:login, password : password});
                     
            //promise answer
            return new Promise(function(resolve, reject) {   
                //Check si le login name est present et si oui recupere le player correspondant
                var gotPlayer = false;
                Player.findOne({"login" : login}).exec(function (err,player) {
                    if (err) {
                        return reject(err);
                    } else if (!player) {
                        var err = new Error("Player not found.");
                        gotPlayer = false;
                        err.status = 400;
                        return reject(false);
                    }
                    gotPlayer = true;
                    //compare
                    bcrypt.compare(p.password, player.password, function(err, res) {
                        if (res) {
                            console.log("Mongo.js / mongo proto / bon mdp");
                            return resolve(true);
                        } else {
                            console.log("Mongo.js / mongo proto / pas bon mdp");
                            return reject(false);
                        }
                    });  
                });
            })
        }
    },
};