$(function(){
    $('#seConnecter').on('click',function(e){
        console.log("SeConnecter");
        var login = document.getElementById('pseudoInscription');
        var mdp = document.getElementById('mdpConnexion');
        /*
        var res = db.players.find({
          "login": login,
          "mdp": mdp
        });
        */

        $.ajax({
          url:"/tonurl",
          type:"POST",
          data:s
        });
        console.log(res);
      });

});
