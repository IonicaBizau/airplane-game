$(function () {

    // Initialize Firebase
    var config = {
        apiKey: "AIzaSyAsFK9oDTtsCdqrHAfQKs8_TmNtBOoIkBY",
        authDomain: "emma-ea74d.firebaseapp.com",
        databaseURL: "https://emma-ea74d.firebaseio.com",
        storageBucket: "emma-ea74d.appspot.com",
        messagingSenderId: "95300595436"
    };

    var SOUNDS = {
        GAME_ENDED: new Audio("sounds/game-ended.wav"),
        YOU_HIT: new Audio("sounds/you-hit.wav"),
        YOU_HAVE_BEEN_HIT: new Audio("sounds/you-have-been-hit.wav"),
        MOVE: new Audio("sounds/move.wav"),
    };

    function playSound(type) {
        type.play()
    }

    var SIZE = [10, 10];
    var SQUARE_SIZE = 20;
    var $grid = $(".grid");
    var PLANE_ORIENTATION = "TOP";
    var PLAYER_NAME;
    var gameEnded = false;
    var youWon = null;

    function resetGameClasses() {
        $(".game-row > div").attr("class", "square");
    }

    function getSquareCoordinates($s) {
        return [$s.index(), $s.parent().index()];
    }

    var gameIsStarted = false;
    var invalidPlanePosition = true;
    var choosingPlanePosition = true;
    var $planeOrientation = $("#plane-orientation");
    function prepareToChoosePlanePosition () {
        if (!choosingPlanePosition) { return; }
        resetGameClasses();
        PLANE_ORIENTATION = $planeOrientation.val();
        renderPlane(getSquareCoordinates($(this)), PLANE_ORIENTATION);
    }

    $grid.on("mouseenter", ".square", prepareToChoosePlanePosition);

    function renderGame() {
        var SQUARE_SIZE = $grid.parent().width() / SIZE[0] - 4;

        $(".loading-text-wrapper").fadeOut();

        $grid.empty();
        for (var y = 0; y < SIZE[1]; ++y) {
            var $row = $("<div>", { "class": "game-row" });
            for (var x = 0; x < SIZE[0]; ++x) {
                $row.append($("<div>", {
                    "class": "square"
                  , css: {
                        width: SQUARE_SIZE
                      , height: SQUARE_SIZE
                    }
                }));
            }
            $grid.append($row);
        }

        $(".square").click(function () {
            if (choosingPlanePosition) {
                if (invalidPlanePosition) {
		    return swal(
			'Oops...',
			'Invalid plane position.',
			'error'
		    );
                }
                choosingPlanePosition = false;
                $planeOrientation.remove();
                log("You've entered in the game.", "success");
                registerPlayer();
                return;
            }

            var $t = $(this);
            var coors = getSquareCoordinates($t);
            sendAttack(
                coors[0]
              , coors[1]
            );
        });
    }

    var $waitingOverlay = $(".waiting-overlay");
    $waitingOverlay.hide();
    function showWaiting() {
        updateOverlaySize();
        $waitingOverlay.stop().fadeIn();
    }
    function hideWaiting() {
        $waitingOverlay.stop().fadeOut();
    }

    firebase.initializeApp(config);
    var gameId = Url.queryString("id");
    if (!gameId) {
        gameId = new Date().getTime().toString();
        Url.updateSearchParam("id", gameId);
    }

    var planePoints = [];
    var db = firebase.database().ref();
    var gamesRef = db.child("games");
    var thisGameRef = gamesRef.child(gameId);
    var opponentRef = null;
    var currentPlayerRef = null;

    function log(msg, cls) {
        var $msg = $("<span>", { html: msg + "<br>", "class": "console-" + cls });
        $("#logs").prepend($msg);
    }

    function sendAttack(x, y) {
        if (!gameIsStarted) {
            return log("The game is not started yet. The opponent should join.", "warning");
        }
        log("Attacking opponent plane at " + x + ":" + y + ".", "info");
        opponentRef.child("attacked").push({
            x: x
          , y: y
        });
    }

    function sendResponse(x, y, t, isCabin) {
        opponentRef.child("received").push({
            x: x
          , y: y
          , is_plane: t
          , is_cabin: isCabin
        });
    }

    function endGame() {
        gameEnded = true;
        hideWaiting();
        $(".square").css({ cursor: "default" });
        if (youWon === true) {
	    swal({
                type: "success",
                title: 'Good job!',
		text: 'You won!',
                allowOutsideClick: false,
                confirmButtonText: "Play again."
            }).then(function () {
                location.reload();
            });
        } else if (youWon === false) {
	    swal({
                type: "error",
                title: 'Whoups!',
		text: 'You lost.',
                allowOutsideClick: false,
                confirmButtonText: "Try again."
            }).then(function () {
                location.reload();
            });
        } else {
	    swal({
                type: "error",
                title: 'Whoups!',
		text: 'Your opponent left the game.',
                allowOutsideClick: false,
                confirmButtonText: "Play again."
            }).then(function () {
                location.reload();
            });
        }
        playSound(SOUNDS.GAME_ENDED);
    }

    function startGame() {
        gameIsStarted = true;
        log("The game is starting. Any of you can start.", "success");
        playSound(SOUNDS.MOVE);
        opponentRef = thisGameRef.child(PLAYER_NAME === "player_1" ? "player_2" : "player_1");
        currentPlayerRef.child("received").on("child_added", function (c) {
            if (c.key === "_") { return; }
            var data = c.val();
            var sq = getSquare([data.x, data.y]);
            log("Opponent's plane was " + (data.is_plane ? "" : "not ") + "hit on position " + data.x + ":" + data.y + ".", data.is_plane ? "warning" : "info");
            if (data.is_cabin) {
                log("Opponent's aircraft cabin was hit. You won!", "important");
                youWon = true;
                thisGameRef.update({
                    ended: {
                        reason: "The game was ended."
                    }
                });
            } else {
                showWaiting();
                if (data.is_plane) {
                    playSound(SOUNDS.YOU_HIT);
                } else {
                    playSound(SOUNDS.MOVE);
                }
            }

            sq.addClass(data.is_plane ? "opponent-plane-point" : "empty-point");
        });

        currentPlayerRef.child("attacked").on("child_added", function (c) {
            if (c.key === "_") { return; }
            var data = c.val();
            var sq = getSquare([data.x, data.y]);
            var is_plane = sq.hasClass("plane-point");
            sq.addClass(is_plane ? "my-plane-hit" : "hit-by-opponent");
            log("Opponent attacked position " + data.x + ":" + data.y + ". Plane was " + (is_plane ? "" : "not ") + "hit.", is_plane ? "warning" : "info");
            var isCabin = data.x === planePoints[0][0] && data.y === planePoints[0][1];
            if (isCabin) {
                log("Aircraft cabin was hit. You lost.", "important");
                youWon = false;
            } else {
                if (is_plane) {
                    playSound(SOUNDS.YOU_HAVE_BEEN_HIT);
                } else {
                    playSound(SOUNDS.MOVE);
                }
            }
            sendResponse(data.x, data.y, is_plane, isCabin);
            hideWaiting();
        });

        hideWaiting();
        thisGameRef.child("ended").on("child_added", function (snap) {
            if (snap.key === "reason") {
                endGame();
            }
        });
        thisGameRef.onDisconnect().update({
            ended: {
                reason: "One of the players was disconnected."
            }
        });
    }

    var players = 0;
    thisGameRef.on("child_added", function (snap) {
        if (snap.key === "player_2" || snap.key === "player_1") {
            log(({ player_1: "Player 1", player_2: "Player 2"})[snap.key] + " joined.", "info");
            if (++players === 2) {
                swal.close();
                startGame();
            }
        }
    });

    function registerPlayer() {
        thisGameRef.once("value").then(function (data) {
            var game = data.val();
            PLAYER_NAME = game.player_1 ? "player_2" : "player_1";
            var data = {
                createdAt: new Date().getTime()
            };

            data[PLAYER_NAME] = {
                joined_at: new Date().getTime()
              , received: { _: 1 }
              , attacked: { _: 1 }
            };

            currentPlayerRef = thisGameRef.child(PLAYER_NAME);
            swal({
                title: 'Share the url with your best friend. <3',
                html: [
                    '<input class="share-url" onClick="this.setSelectionRange(0, this.value.length)" value="' + location.href + '" />'
                ].join(""),
                allowOutsideClick: false,
            });
            thisGameRef.update(data);
            $(".share-url").focus().click();
        }).catch(function (e) {
          console.error(e);
        });
    }

    thisGameRef.once("value").then(function (data) {
        renderGame();
        var game = data.val();
        if (!game) {
            thisGameRef.update({
                createdAt: new Date().getTime()
            });
            opponentRef = -1;
            log("You are the first player. Waiting for your opponent.", "info");
        } else if (game.player_2) {
            Url.removeQuery("id")
            location.reload();
        } else {
        }
    }).catch(function (e) {
        console.error(e);
    });

    function getSquare(p) {
        return $grid.children().eq(p[1]).children().eq(p[0]);
    }

    function renderPlane(p, orientation) {
        var points = [];

        var x = p[0];
        var y = p[1];

        switch (orientation) {
            case "TOP":
                points = [
                    p
                  , [x - 2, y + 1]
                  , [x - 1, y + 1]
                  , [x, y + 1]
                  , [x + 1, y + 1]
                  , [x + 2, y + 1]
                  , [x, y + 2]
                  , [x - 1, y + 3]
                  , [x, y + 3]
                  , [x + 1, y + 3]
                ];
                break;
            case "RIGHT":
                points = [
                    p
                  , [x - 1, y - 1]
                  , [x - 1, y - 2]
                  , [x - 1, y]
                  , [x - 1, y + 1]
                  , [x - 1, y + 2]
                  , [x - 2, y]
                  , [x - 3, y - 1]
                  , [x - 3, y]
                  , [x - 3, y + 1]
                ];
                break;
            case "DOWN":
                points = [
                    p
                  , [x - 2, y - 1]
                  , [x - 1, y - 1]
                  , [x, y - 1]
                  , [x + 1, y - 1]
                  , [x + 2, y - 1]
                  , [x, y - 2]
                  , [x - 1, y - 3]
                  , [x, y - 3]
                  , [x + 1, y - 3]
                ];
                break;
            case "LEFT":
                points = [
                    p
                  , [x + 1, y - 1]
                  , [x + 1, y - 2]
                  , [x + 1, y]
                  , [x + 1, y + 1]
                  , [x + 1, y + 2]
                  , [x + 2, y]
                  , [x + 3, y - 1]
                  , [x + 3, y]
                  , [x + 3, y + 1]
                ];
                break;
        }

        planePoints = points;
        invalidPlanePosition = !!points.filter(function (c) {
            if (c[0] < 0 || c[1] < 0) {
                return true;
            }
            return !getSquare(c).addClass("plane-point").length;
        }).length;
    }

    function updateOverlaySize() {
        var offset = $grid.offset()
        $waitingOverlay.css({
            top: offset.top
          , left: offset.left
          , width: $grid.width()
          , height: $grid.height()
        });
    }

    $(window).resize(updateOverlaySize);

    var msgPresentation =  "This is a two-player game. Each player has an airplane. Before the game starts, you have to place your airplane on the map."
    var initialMessages = [
        "╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮"
      , "┊   Airplane   ┊"
      , "┊  ╌╌╌╌╌╌╌╌╌╌  ┊"
      , "┊   Welcome!   ┊"
      , "╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯"
      , msgPresentation
    ];

    log(initialMessages.join("\n"), "info");
    swal({
        title: msgPresentation + '<br><br> Please choose the plane orientation and then tap/click the green square where you want to place the plane.',
        html: [
            "<img src='img/orientations/top.png' data-orientation='TOP'>"
          , "<img src='img/orientations/right.png' data-orientation='RIGHT'>"
          , "<img src='img/orientations/bottom.png' data-orientation='DOWN'>"
          , "<img src='img/orientations/left.png' data-orientation='LEFT'>"
        ].join(""),
        allowOutsideClick: false,
    });

    $("button.swal2-confirm.swal2-styled").hide();
    $("[data-orientation]").click(function () {
        $planeOrientation.val($(this).data("orientation")).change();
        $("button.swal2-confirm.swal2-styled").click();
    });
})
