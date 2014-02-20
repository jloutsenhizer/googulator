define(["html5apps/HTML5_TICTACTOE/Header","modules/play/GameApp"],function(header,GameApp){
    "use strict";

    var game = new GameApp();

    game.baseHtml.css("backgroundColor","white");

    game.header = header;

    var boardContainer = $("<div style='background:white; display:inline-block;position:relative; vertical-align:top;'></div>")

    var controls = $("<div style='background:white; display:inline-block;position:relative;height:100%; width:140px;'><div style='font-weight:bold; font-size:28px; margin-top:1em;'>Turn</div><div class='currentTurn' style='font-size:28px; margin-top:1em; margin-bottom:2em;'>X's Turn</div><button class='newGameBtn'>New Game</button></div>");

    var currentTurnText = controls.find(".currentTurn");
    var newGameBtn = controls.find(".newGameBtn");

    var victoryLine = $('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="position:absolute; left:0;width:100%;top:0;height:100%;z-index:-1;" viewBox="0 0 90 90"></svg>');
    function parseSVG(s) {
        var div= document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        div.innerHTML= '<svg xmlns="http://www.w3.org/2000/svg">'+s+'</svg>';
        var frag= document.createDocumentFragment();
        while (div.firstChild.firstChild)
            frag.appendChild(div.firstChild.firstChild);
        return frag;
    }

    game.baseHtml.append(boardContainer);
    game.baseHtml.append(controls);
    boardContainer.append(victoryLine);

    game.onResize = function(width,height){
        width -= 140;
        width = height = Math.min(width,height);
        boardContainer.css('width',width + 'px');
        boardContainer.css('height',height  +"px");
    }

    var board = [[],[],[]];
    for (var i = 0; i < 3; i++){
        for (var j = 0; j < 3; j++){
            board[i][j] = $("<div></div>");
            board[i][j].css("display","inline-block");
            board[i][j].css("position","absolute");
            board[i][j].css("top",(j / 3 * 100) + "%");
            board[i][j].css("bottom",(100 - ((j+1) / 3 * 100)) + "%");
            board[i][j].css("left",(i / 3 * 100) + "%");
            board[i][j].css("right",(100 - ((i+1) / 3 * 100)) + "%");
            board[i][j].css("boxSizing","border-box");
            board[i][j].css("backgroundSize","80%");
            board[i][j].css("backgroundRepeat","no-repeat");
            board[i][j].css("backgroundPosition","center");
            board[i][j].css("cursor","pointer");

            if (i > 0){
                board[i][j].css("borderLeft","1px solid black");
            }
            if (i < 2){
                board[i][j].css("borderRight","1px solid black");
            }
            if (j > 0){
                board[i][j].css("borderTop","1px solid black");
            }
            if (j < 2){
                board[i][j].css("borderBottom","1px solid black");
            }

            board[i][j].mouseenter({
                i: i,
                j: j
            },function(event){
                cursorPosX = event.data.i;
                cursorPosY = event.data.j;
                resyncDisplay();
            })

            board[i][j].click({
                i: i,
                j: j
            },onBoardClick);

            boardContainer.append(board[i][j]);

        }
    }

    var NO_PIECE = 0;
    var PIECE_X = 1;
    var PIECE_O = 2;

    var boardState = [[],[],[]];

    var NO_PLAYER = 0;
    var PLAYER_X = 1;
    var PLAYER_O = 2;

    var cursorPosX = 0;
    var cursorPosY = 0;

    game.handleKey = function(event){
        if (event.pressed){
            switch (event.button){
                case App.constants.BUTTON_A:
                    board[cursorPosX][cursorPosY].click();
                    break;
                case App.constants.BUTTON_LEFT:
                    cursorPosX -= 1;
                    if (cursorPosX < 0) cursorPosX += 3;
                    break;
                case App.constants.BUTTON_RIGHT:
                    cursorPosX += 1;
                    if (cursorPosX >= 3) cursorPosX -= 3;
                    break;
                case App.constants.BUTTON_UP:
                    cursorPosY -= 1;
                    if (cursorPosY < 0) cursorPosY += 3;
                    break;
                case App.constants.BUTTON_DOWN:
                    cursorPosY += 1;
                    if (cursorPosY >= 3) cursorPosY -= 3;
                    break;
                case App.constants.BUTTON_SELECT:
                    newGameBtn.click();
                    break;
                default:
                    return false;
            }
        }
        resyncDisplay();
        return true;
    }

    var winner = null;

    var currentTurn = PLAYER_X;

    game.loadGame = function(){
        for (var i = 0, li = board.length; i < li; i++){
            for (var j = 0, lj = board[i].length; j < lj; j++){
                boardState[i][j] = NO_PIECE;
            }
        }
        currentTurn = PLAYER_X;
        winner = null;
        victoryLine.empty();
        victoryLine.css("zIndex","-1");
        resyncDisplay();

    }

    newGameBtn.click(function(){
        game.loadGame();
    });

    function onBoardClick(event){
        if (boardState[event.data.i][event.data.j] !== NO_PIECE)
            return;
        if (currentTurn == PLAYER_X){
            currentTurn = PLAYER_O;
            boardState[event.data.i][event.data.j] = PIECE_X;
        }
        else if (currentTurn == PLAYER_O){
            currentTurn = PLAYER_X;
            boardState[event.data.i][event.data.j] = PIECE_O;
        }
        checkVictory();
        resyncDisplay();

    }

    var xUrl = "url(/img/html5apps/HTML5_TICTACTOE/cross.svg)";
    var oUrl = "url(/img/html5apps/HTML5_TICTACTOE/circle.svg)";

    function resyncDisplay(){
        for (var i = 0, li = board.length; i < li; i++){
            for (var j = 0, lj = board[i].length; j < lj; j++){
                var t;
                switch (boardState[i][j]){
                    case PIECE_X:
                        t = xUrl;
                        break;
                    case PIECE_O:
                        t = oUrl;
                        break;
                    default:
                        t = "none";
                        break;
                }
                if (board[i][j].css("backgroundImage") !== t){
                    board[i][j].css("backgroundImage",t);
                    switch (boardState[i][j]){
                        case PIECE_X:
                            xUrl = board[i][j].css("backgroundImage");
                            break;
                        case PIECE_O:
                            oUrl = board[i][j].css("backgroundImage");
                            break;
                    }
                }
                if (i == cursorPosX && j == cursorPosY){
                    board[i][j].css("outline","2px solid orange");
                }
                else{
                    board[i][j].css("outline","none");
                }
            }
        }

        if (winner !== null){
            switch (winner){
                case PLAYER_X:
                    currentTurnText.text("X wins!");
                    break;
                case PLAYER_O:
                    currentTurnText.text("O wins!");
                    break;
                default:
                    currentTurnText.text("Tie game!");
                    break;
            }

        }
        else{
            if (currentTurn === PLAYER_X){
                currentTurnText.text("X's turn");
            }
            else{
                currentTurnText.text("O's turn");
            }

        }

    }

    function declareVictor(piece,x1,y1,x2,y2){
        currentTurn = NO_PLAYER;
        switch (piece){
            case PIECE_X:
                winner = PLAYER_X;
                break;
            case PIECE_O:
                winner = PLAYER_O;
                break;
            default:
                winner = NO_PLAYER;
                return;
        }

        victoryLine.empty().css("zIndex","1").append(parseSVG('<line x1="' + (x1 * 30 + 15) + '" y1="' + (y1 * 30 + 15) + '" x2="' + (x2 * 30 + 15) + '" y2="' + (y2 * 30 + 15) + '" style="stroke:black;stroke-width:3;stroke-linecap:round;" />'));




    }

    function checkVictory(){
        for (var i = 0, li = boardState.length; i < li; i++){
            if (boardState[i][0] == boardState[i][1] && boardState[i][1] == boardState[i][2] && boardState[i][0] !== NO_PIECE){
                declareVictor(boardState[i][0],i,0,i,2);
                return;
            }
            if (boardState[0][i] == boardState[1][i] && boardState[1][i] == boardState[2][i] && boardState[0][i] !== NO_PIECE){
                declareVictor(boardState[0][i],0,i,2,i);
                return;
            }
        }
        if (boardState[0][0] == boardState[1][1] && boardState[1][1] == boardState[2][2] && boardState[0][0] !== NO_PIECE){
            declareVictor(boardState[0][0],0,0,2,2);
            return;
        }
        if (boardState[0][2] == boardState[1][1] && boardState[1][1] == boardState[2][0] && boardState[0][2] !== NO_PIECE){
            declareVictor(boardState[0][2],0,2,2,0);
            return;
        }
        for (var i = 0, li = boardState.length; i < li; i++){
            for (var j = 0, lj = boardState[i].length; j < lj; j++){
                if (boardState[i][j] === NO_PIECE)
                    return;
            }
        }
        declareVictor(NO_PIECE)
    }

    return game;

});