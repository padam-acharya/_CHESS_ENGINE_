// GLOBAL VARIABLE
var ai_turn = true
var play_against_engine = false
var engine_vs_sf = false
var COLOR
var play_as_black = false

var legal_moves = []
var GLOBAL_FEN = {}
var extract_sqs = []

// const boardEL = document.getElementById('chess-board')
// const rect = boardEL.getBoundingClientRect();
// const dist = rect.left;

// console.log("DISTANCE FROM LEFT: ", dist)

chess_unicode_html_decimal = {
   "K": "&#9812;",  
    "Q": "&#9813;",  
    "R": "&#9814;",  
    "B": "&#9815;",  
    "N": "&#9816;",  
    "P": "&#9817;",  
    "k": "&#9818;",   
    "q": "&#9819;",  
    "r": "&#9820;",  
    "b": "&#9821;",  
    "n": "&#9822;",  
    "p": "&#9823;",  
}


const image_num = []
let num = 101
for(let i = 0; i < 10; i++){
    image_num[i] = num
    num += 1
}

function randomNum(){
    return Math.floor(Math.random() * 9)
}

function displayResultWindow(resultText){
    const resultEl = document.getElementById('my-game-result')
    const resultTextEl = document.getElementById('result-text')
    const profileEl = document.getElementsByClassName('profile')
    profileEl[0].style.filter = "blur(5px)"
    profileEl[1].style.filter = "blur(5px)"
    resultTextEl.textContent = resultText
    resultEl.style.display = "block"
    setBoardBlurred(true)
    const memeImgEl = document.getElementById('meme-img-id')   
    
    memeImgEl.src = `static/chess_meme/chess_meme_${image_num[randomNum()]}.jpeg`
}


function playAudio(url){
    const audio = new Audio(url)
    audio.currentTime = 0
    audio.play().catch((error) => {
        console.error('Error playing audio:', error);
    })
}



async function dragstartHandler(event){
    if(ai_turn == true) return //prevent dragging if it's AI's turn

    event.dataTransfer.setData("text/plain", event.target.id)
    event.dataTransfer.effectAllowed = "move"
    // e.dataTransfer.dropEffect = "none"


    try {
        const response = await fetch('/legal_moves')
        const val = await response.json()
        console.log(val)
        legal_moves = val['legal_moves']
        const side = val['side_to_move']
        GLOBAL_FEN = val['fen']
        console.log(legal_moves)
        console.log(side)
    } catch (error) {
        console.error('Error fetching legal moves:', error)
    }

    console.log("DRAG STARTED")

    if(legal_moves.length != 0){
        const draggedPieceParentNodeId = event.target.parentNode.id
        extract_sqs = legal_moves.filter((move) => move.startsWith(draggedPieceParentNodeId.slice(0,2)))
        console.log("EXTRACTED SQS: ", extract_sqs)

        for(let i = 0; i < extract_sqs.length; i++){
            const square = document.getElementById(extract_sqs[i].slice(2,4))
            console.log("SQ: ",square)
            const circularDot = document.createElement('div')
            console.log("FIRST CHILD: ", square.firstChild)
            
            if(square.firstChild){
                circularDot.classList.add('highlight-square-occupied')
            }
            else{
                circularDot.classList.add('highlight-square')
            }
            square.appendChild(circularDot)
        }
    }
}

document.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('piece')) {
        e.target.style.opacity = '0.3';
    }
})
document.addEventListener('dragend', function(e) {
    if (e.target.classList.contains('piece')) {
        e.target.style.opacity = '1';
    }
})

function dragoverHandler(event) {
  event.preventDefault();
//   document.getElementById(event.target.id).style.cursor = "grab"
}

async function postData(path, data){
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    return response.json()
}

async function dropHandler(event) {

    var capture = false

    event.preventDefault();
    
    
    const data = event.dataTransfer.getData("text/plain");
    const draggedPiece = document.getElementById(data);

    document.querySelectorAll('.highlight-square, .highlight-square-occupied').forEach(square => square.remove())

    // Normalize drop target to always be the square
    let dropSquare = event.target;
    if (dropSquare.classList.contains("piece")) {
        dropSquare = dropSquare.parentNode;
    }

    if (!draggedPiece || !draggedPiece.parentNode) {
        console.error("Dragged piece or its parent is null", { draggedPiece, data });
        return;
    }

    const from = draggedPiece.parentNode.id;
    console.log(from)
    const to = dropSquare.id;
   
    // CHECK IF THE MOVE IS LEGAL

    const move = from + to;

    let i;
    for(i = 0; i < legal_moves.length; i++) {
        if(legal_moves[i].slice(0,4) == move) {
            console.log("Legal Move")
            break;
        }
    }

    if(i == legal_moves.length) return;

    var captureFlag = false;
    var promotionFlag = false;

    if(draggedPiece.classList.contains("white-pawn") && to[1] == "8" || draggedPiece.classList.contains("black-pawn") && to[1] == "1"){
        promotionFlag = true;

    }

    var response = {}
    if(!promotionFlag){
        response = await postData('/move', {move: move})
        console.log(response)
    }
    

    // Find any piece already on the square
    const targetPiece = dropSquare.querySelector('.piece');

    if (targetPiece && targetPiece !== draggedPiece) {
        // Check colors
        const draggedIsWhite = draggedPiece.classList.contains("white-piece");
        const draggedIsBlack = draggedPiece.classList.contains("black-piece");
        const targetIsWhite = targetPiece.classList.contains("white-piece");
        const targetIsBlack = targetPiece.classList.contains("black-piece");

        // Only allow capture if colors are opposite
        if ((draggedIsWhite && targetIsBlack) || (draggedIsBlack && targetIsWhite)) {
            dropSquare.removeChild(targetPiece) // Capture

            
            if(promotionFlag && draggedIsWhite){
                //remove the dragged piece from its original squar
                const draggedPieceParent = draggedPiece.parentNode
                if(draggedPieceParent)
                    draggedPieceParent.removeChild(draggedPiece)

                // promote white pawn 
                promPce = prompt("Enter the piece you want to promote to (q, r, b, n):", "q");
                const promotedPiece = `<span class="piece white-piece" id="${chess_unicode_html_decimal[promPce.toUpperCase()]}${to[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce.toUpperCase()]}</span>`

                
                dropSquare.innerHTML = promotedPiece
                

              
                // THE BELOW CODE SNIPPET ROTATES THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK

                setTimeout(() => {
                const promotedPieceEl = dropSquare.querySelector('.piece');
                const promotedPieceId = promotedPieceEl ? promotedPieceEl.id : null;
                   console.log("PROMOTED PIECE ROTATE ELEMENT :", promotedPieceEl);
                console.log("PROMOTED PIECE ID ROTATE:", promotedPieceId);
                const promPieceEL = document.getElementById(promotedPieceId)
                if(promotedPieceEl && play_as_black){
                    
                    promPieceEL.style.transform = "rotate(180deg)";
                    console.log("PROMOTED PIECE ROTATED: 123: ", promPieceEL)
                }
            }, 0);

            // ******************************END******************************************************
                // GET THE PROMOTED PIECE ELEMENT
                // const promotedPieceEl = dropSquare.querySelector('.piece');
                // const promotedPieceId = promotedPieceEl ? promotedPieceEl.id : null;
                // console.log("PROMOTED PIECE ROTATE ELEMENT :", promotedPieceEl);
                // console.log("PROMOTED PIECE ID ROTATE:", promotedPieceId);

                // //  ROTATE THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK
                // if(promotedPieceId && play_as_black){
                //     promotedPieceEl.style.transform = "rotate(180deg)"
                // }   
               
                capture = true
                response = await postData('/move', {move: move+promPce})
            }

            if(promotionFlag && draggedIsBlack){
                //remove the dragged piece from its original squar
                const draggedPieceParent = draggedPiece.parentNode
                if(draggedPieceParent)
                    draggedPieceParent.removeChild(draggedPiece)

                // promote black pawn
                promPce = prompt("Enter the piece you want to promote to (q, r, b, n):", "q");
                const promotedPiece = `<span class="piece black-piece" id="${chess_unicode_html_decimal[promPce]}${to[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce]}</span>`
                dropSquare.innerHTML = promotedPiece


                // THE BELOW CODE SNIPPET ROTATES THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK

                setTimeout(() => {
                const promotedPieceEl = dropSquare.querySelector('.piece');
                const promotedPieceId = promotedPieceEl ? promotedPieceEl.id : null;
                   console.log("PROMOTED PIECE ROTATE ELEMENT :", promotedPieceEl);
                console.log("PROMOTED PIECE ID ROTATE:", promotedPieceId);
                const promPieceEL = document.getElementById(promotedPieceId)
                if(promotedPieceEl && play_as_black){
                    
                    promPieceEL.style.transform = "rotate(180deg)";
                    console.log("PROMOTED PIECE ROTATED: 123: ", promPieceEL)
                }
            }, 0);

            // ******************************END******************************************************
                capture = true
                response = await postData('/move', {move: move+promPce})
            }

            if(!response.isCheck) playAudio('static/audio/capture.mp3')
            captureFlag = true;
        } else {
            // Same color: do not allow move
            return;
        }
    }
    
    //handle en passant
    const en_passant_square = GLOBAL_FEN.split(" ")[3]
    console.log("EN PASSANT SQUARE:", en_passant_square)

    if(move.slice(2) == en_passant_square){
         let pawn_square = GLOBAL_FEN.split(" ")[1] == 'w' ? en_passant_square[0] + (parseInt(en_passant_square[1]) - 1) : en_passant_square[0] + (parseInt(en_passant_square[1]) + 1)

         const pawn_square_element = document.getElementById(pawn_square)
         if(pawn_square_element.firstChild){
            pawn_square_element.removeChild(pawn_square_element.firstChild)
         }
         captureFlag = true
         playAudio('static/audio/capture.mp3')
    }

    // handles castling
    var castlingFlag = false
    const castle_rights = GLOBAL_FEN.split(" ")[2]
    console.log("CASTLE RIGHTS: ", castle_rights)
    if((move == "e1g1" && castle_rights.includes("K")) || (move == "e1c1" && castle_rights.includes("Q")) || (move == "e8g8" && castle_rights.includes("k"))  || (move == "e8c8" && castle_rights.includes("q"))){
        let extract_king_square
        let extract_rook_square

        switch(move) {
            case "e1g1":
                extract_rook_square = "h1"
                extract_king_square = "f1"
                break
            case "e8g8":
                extract_rook_square = "h8"
                extract_king_square = "f8"
                break
            case "e1c1":
                extract_rook_square = "a1"
                extract_king_square = "d1"
                break
            case "e8c8":
                extract_rook_square = "a8"
                extract_king_square = "d8"
                break
            default:
                console.log("Invalid move for castling")
                return;
        }

        console.log("KING SQUARE:", extract_king_square)
        console.log("ROOK SQUARE:", extract_rook_square)

        let rook_square = document.getElementById(extract_rook_square);
        let king_square = document.getElementById(extract_king_square);

        console.log("KING SQUARE:", king_square)
        console.log("ROOK SQUARE:", rook_square)

        castlingFlag = true;
        let rook_piece = rook_square.firstChild
        playAudio('static/audio/castle.mp3')

        rook_square.removeChild(rook_square.firstChild) //remove rook from the square 
        king_square.appendChild(rook_piece) //append rook to the king square
        castlingFlag = true
    }

    console.log("CHECKMATE: ", response.isCheckmate)
    console.log("PROMOTION: ", response.isPromotion)

    if(response['isCheckmate']){
        playAudio('static/audio/move-self.mp3')
        playAudio('static/audio/game-end.mp3')
        dropSquare.appendChild(draggedPiece);

        const resultText = draggedPiece.classList.contains("white-piece") ? "White won" : "Black won"
        setTimeout(() => {
            displayResultWindow(resultText)
        }, 500)

        return
    }


    //  PROMOTE TO BLACK ROOK/QUEEN/BISHOP/KNIGHT WHEN THERE IS NO CAPTURE
    if(promotionFlag && draggedPiece.classList.contains("white-pawn") && capture == false){
        //remove the dragged piece from its original square
        const draggedPieceParent = draggedPiece.parentNode
        if(draggedPieceParent)
            draggedPieceParent.removeChild(draggedPiece)

        const promPce = prompt("Enter the piece you want to promote to (q, r, b, n):", "q").toUpperCase()
        const promotedPiece = `<span class="piece white-piece" id="${chess_unicode_html_decimal[promPce]}${to[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce]}</span>`


        response = await postData('/move', {move: move+promPce.toLowerCase()})
        dropSquare.innerHTML = promotedPiece
    // THE BELOW CODE SNIPPET ROTATES THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK

        setTimeout(() => {
        const promotedPieceEl = dropSquare.querySelector('.piece');
        const promotedPieceId = promotedPieceEl ? promotedPieceEl.id : null;
            console.log("PROMOTED PIECE ROTATE ELEMENT :", promotedPieceEl);
        console.log("PROMOTED PIECE ID ROTATE:", promotedPieceId);
        const promPieceEL = document.getElementById(promotedPieceId)
        if(promotedPieceEl && play_as_black){
            
            promPieceEL.style.transform = "rotate(180deg)";
            console.log("PROMOTED PIECE ROTATED: 123: ", promPieceEL)
        }
    }, 0);

    // ******************************END******************************************************
                
       

        if(response['isCheckmate']){
            playAudio('static/audio/move-self.mp3')
            playAudio('static/audio/game-end.mp3')

            const resultText = draggedPiece.classList.contains("white-piece") ? "White won" : "Black won"
            setTimeout(() =>{
                displayResultWindow(resultText)
            },500)

            return
        }

        
    }
    
    //  PROMOTE TO WHITE ROOK/QUEEN/BISHOP/KNIGHT WHEN THERE IS NO CAPTURE
    if(promotionFlag && draggedPiece.classList.contains("black-pawn") && capture == false){
        const draggedPieceParent = draggedPiece.parentNode
        if(draggedPieceParent)
            draggedPieceParent.removeChild(draggedPiece)

        const promPce = prompt("Enter the piece you want to promote to (q, r, b, n):", "q").toLowerCase()
        const promotedPiece = `<span class="piece black-piece" id="${chess_unicode_html_decimal[promPce]}${to[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce]}</span>`
                
        response = await postData('/move', {move: move+promPce})
        dropSquare.innerHTML = promotedPiece
        // THE BELOW CODE SNIPPET ROTATES THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK

            setTimeout(() => {
            const promotedPieceEl = dropSquare.querySelector('.piece');
            const promotedPieceId = promotedPieceEl ? promotedPieceEl.id : null;
                console.log("PROMOTED PIECE ROTATE ELEMENT :", promotedPieceEl);
            console.log("PROMOTED PIECE ID ROTATE:", promotedPieceId);
            const promPieceEL = document.getElementById(promotedPieceId)
            if(promotedPieceEl && play_as_black){
                
                promPieceEL.style.transform = "rotate(180deg)";
                console.log("PROMOTED PIECE ROTATED: 123: ", promPieceEL)
            }
        }, 0);

        // ******************************END******************************************************


        

        
        if(response['isCheckmate']){
            playAudio('static/audio/move-self.mp3')
            playAudio('static/audio/game-end.mp3')

            // Display game result
            const resultText = draggedPiece.classList.contains("white-piece") ? "White won" : "Black won"
            setTimeout(() =>{
                displayResultWindow(resultText)
            },500)

            return
        }

    }

    if(!promotionFlag) dropSquare.appendChild(draggedPiece)

    if(response['isCheck']){
        playAudio('static/audio/move-check.mp3')
    }

    if(captureFlag == false && castlingFlag == false && !response['isCheck']) playAudio('static/audio/move-self.mp3')

    if(play_against_engine){
        // TOGGLE THE TURN VARIABLE SO THAT THE ENGINE CAN PLAY 
        ai_turn = !ai_turn
        playAgainstEngine('/play_against_engine', COLOR)
    }
}

let START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
let fen  = START_FEN.split(" ")[0]
let ranks  = fen.split("/")

function initial_board_setup(fen=START_FEN) {
    for (let i = 0; i < 8; i++) {
        let file = String.fromCharCode('a'.charCodeAt(0) + i);

        // 8th rank (black pieces)
        let piece8 = chess_unicode_html_decimal[ranks[0][i]];
        let sq8 = document.getElementById(file + "8");
        if (piece8) {
            sq8.innerHTML = `<span class="piece black-piece" id="${piece8}${file}8" draggable="True" ondragstart="dragstartHandler(event)">${piece8}</span>`;
        } else {
            sq8.innerHTML = "";
        }

        // 7th rank (black pawns)
        let piece7 = chess_unicode_html_decimal[ranks[1][i]];
        let sq7 = document.getElementById(file + "7");
        if (piece7) {
            sq7.innerHTML = `<span class="piece black-piece black-pawn" id="${piece7}${file}7" draggable="True" ondragstart="dragstartHandler(event)">${piece7}</span>`;
        } else {
            sq7.innerHTML = "";
        }

        // 6th rank (empty)
        let sq6 = document.getElementById(file + "6")
        if (sq6) {
            sq6.innerHTML = "";
        }

        // 5th rank (empty)
        let sq5 = document.getElementById(file + "5")
        if (sq5) {  
            sq5.innerHTML = "";
        }

        // 4th rank (empty)
        let sq4 = document.getElementById(file + "4")
        if (sq4) {
            sq4.innerHTML = "";
        }

        // 3rd rank (empty)
        let sq3 = document.getElementById(file + "3")
        if (sq3) {
            sq3.innerHTML = "";
        }

        // 2nd rank (white pawns)
        let piece2 = chess_unicode_html_decimal[ranks[6][i]];
        let sq2 = document.getElementById(file + "2");
        if (piece2) {
            sq2.innerHTML = `<span class="piece white-piece white-pawn" id="${piece2}${file}2" draggable="True" ondragstart="dragstartHandler(event)">${piece2}</span>`;
        } else {
            sq2.innerHTML = "";
        }

        // 1st rank (white pieces)
        let piece1 = chess_unicode_html_decimal[ranks[7][i]];
        let sq1 = document.getElementById(file + "1");
        if (piece1) {
            sq1.innerHTML = `<span class="piece white-piece" id="${piece1}${file}1" draggable="True" ondragstart="dragstartHandler(event)">${piece1}</span>`;
        } else {
            sq1.innerHTML = "";
        }
    }
}

function setBoardBlurred(blurred){
    const board = document.getElementById('chess-board')
    const pieces = document.querySelectorAll('.piece')
    const buttons = document.getElementsByClassName('buttons')
    if(blurred){
        board.classList.add('blurred')
        buttons[0].classList.add('buttons-z-idx')
        pieces.forEach(piece => {
            piece.setAttribute("draggable", "False")
        })
       
    }
    else{
        board.classList.remove('blurred')
        buttons[0].classList.remove('buttons-z-idx')
        pieces.forEach(piece => {
            piece.setAttribute("draggable", "True")
        })
        
    }
}

document.addEventListener("DOMContentLoaded", function() {
    initial_board_setup()
    setBoardBlurred(true)
    fetch('/initialize')
    .then(response => response.json())
    .then(data => {
        console.log("Game initialized:", data)
    })
    .catch(error =>{
        console.log("Error initializing game:", error)
    })
});

async function getMoves_(path, _color_){
    var color_ = _color_;
    const response = await fetch(path + '?color='+color_);
    const data = await response.json();
    if (data.status === 'error') {
        console.error("Backend error:", data.message);
    }
    return data;
}

function makeMove(move, fen, isCheck, isCheckmate) {
    console.log("Move:", move);

    if (!move) {
        console.warn("No move to make (game over or draw).");
        return;
    }

    let isPromotion = false;
    let promPce = "";

    if (move.length === 5) {
        promPce = move[4];
        move = move.slice(0, 4);
        isPromotion = true;
        console.log("Promoting to:", promPce);
    }

    const fromSquare = move.slice(0, 2);
    const toSquare = move.slice(2);

    const fromSquareEL = document.getElementById(fromSquare);
    const toSquareEL = document.getElementById(toSquare);

    if (!fromSquareEL || !toSquareEL) {
        console.error("Invalid squares:", fromSquare, toSquare);
        return;
    }

    const fromPiece = fromSquareEL.firstChild;
    if (!fromPiece) {
        console.error("No piece in from square:", fromSquare);
        return;
    }

    const toPiece = toSquareEL.firstChild;
    const fromIsWhite = fromPiece.classList.contains("white-piece");
    const fromIsBlack = fromPiece.classList.contains("black-piece");
    let captureFlag = false;

    // Handle captures
    if (toPiece && toPiece !== fromPiece) {
        const toIsWhite = toPiece.classList.contains("white-piece");
        const toIsBlack = toPiece.classList.contains("black-piece");

        if ((toIsWhite && fromIsBlack) || (toIsBlack && fromIsWhite)) {
            toSquareEL.removeChild(toPiece);
            captureFlag = true;
        } else {
            return; // illegal move
        }
    }

    // Handle en passant
    const enPassantSquare = fen.split(" ")[3];
    if (toSquare === enPassantSquare) {
        const turn = fen.split(" ")[1];
        const captureRow = turn === 'b'
            ? (parseInt(enPassantSquare[1]) - 1)
            : (parseInt(enPassantSquare[1]) + 1);
        const capturedPawnSquare = enPassantSquare[0] + captureRow;
        const capturedPawnEL = document.getElementById(capturedPawnSquare);
        if (capturedPawnEL && capturedPawnEL.firstChild) {
            capturedPawnEL.removeChild(capturedPawnEL.firstChild);
            captureFlag = true;
        }
    }

    // Handle castling
    const castlingMoves = {
        "e1g1": { rookFrom: "h1", rookTo: "f1" },
        "e1c1": { rookFrom: "a1", rookTo: "d1" },
        "e8g8": { rookFrom: "h8", rookTo: "f8" },
        "e8c8": { rookFrom: "a8", rookTo: "d8" }
    };
    let castlingFlag = false;

    if ((move in castlingMoves) && ((fromPiece.id == "♔e1") || (fromPiece.id == "♚e8"))) {
        const { rookFrom, rookTo } = castlingMoves[move];
        const rookFromEL = document.getElementById(rookFrom);
        const rookToEL = document.getElementById(rookTo);
        if (rookFromEL && rookFromEL.firstChild) {
            const rook = rookFromEL.firstChild;
            rookFromEL.removeChild(rook);
            rookToEL.appendChild(rook);
            castlingFlag = true;
            playAudio("static/audio/castle.mp3");
        }
    }

    // Handle checkmate
    if (isCheckmate) {
        toSquareEL.appendChild(fromPiece);
        playAudio('static/audio/move-self.mp3');
        playAudio('static/audio/game-end.mp3');

        // Display game result
        const resultText = fromIsWhite ? "White won" : "Black won"
        setTimeout(() =>{
                displayResultWindow(resultText)
        },500)
        return;
    }

    // Handle promotion
    if (isPromotion && fromPiece.classList.contains("white-pawn")) {
        const promoted = document.createElement("span");
        promoted.className = "piece white-piece";
        promoted.id = `${chess_unicode_html_decimal[promPce.toUpperCase()]}${toSquare[0]}${Math.floor(Math.random() * 1000)}`;
        promoted.setAttribute("draggable", "True");
        promoted.setAttribute("ondragstart", "dragstartHandler(event)");
        promoted.innerHTML = chess_unicode_html_decimal[promPce.toUpperCase()];
        toSquareEL.innerHTML = "";
        fromSquareEL.removeChild(fromPiece)
        toSquareEL.appendChild(promoted);

        // THE BELOW CODE SNIPPET ROTATES THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK

        setTimeout(() => {
            if(play_as_black){
                promoted.style.transform = "rotate(180deg)";
                // console.log("PROMOTED PIECE ROTATED: 123: ", promPieceEL)
            }
        }, 0);

    // ******************************END******************************************************
                
        if (!isCheck && !captureFlag) playAudio('static/audio/move-self.mp3');
        return;
    }

    if (isPromotion && fromPiece.classList.contains("black-pawn")) {
        const promoted = document.createElement("span");
        promoted.className = "piece black-piece";
        promoted.id = `${chess_unicode_html_decimal[promPce.toLowerCase()]}${toSquare[0]}${Math.floor(Math.random() * 1000)}`;
        promoted.setAttribute("draggable", "True");
        promoted.setAttribute("ondragstart", "dragstartHandler(event)");
        promoted.innerHTML = chess_unicode_html_decimal[promPce.toLowerCase()];
        toSquareEL.innerHTML = "";
        fromSquareEL.removeChild(fromPiece)
        toSquareEL.appendChild(promoted);


        // THE BELOW CODE SNIPPET ROTATES THE PROMOTED PIECE IF THE HUMAN IS PLAYING AS BLACK

        setTimeout(() => {
            if(play_as_black){
                promoted.style.transform = "rotate(180deg)";
                // console.log("PROMOTED PIECE ROTATED: 123: ", promPieceEL)
            }
        }, 0);

    // ******************************END******************************************************


        if (!isCheck && !captureFlag) playAudio('static/audio/move-self.mp3');
        return;
    }

    // Normal move
    fromSquareEL.removeChild(fromPiece);
    toSquareEL.appendChild(fromPiece);

    // Play appropriate sound
    if (isCheck) {
        playAudio("static/audio/move-check.mp3");
    } else if (captureFlag) {
        playAudio("static/audio/capture.mp3");
    } else if (!castlingFlag) {
        playAudio("static/audio/move-self.mp3");
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function selfPlayLoop(url, color) {
    
    const response = await getMoves_(url, color);
    console.log(response);
    if(response['draw']){
        console.log("Game is a draw")
        return
    }
    makeMove(response['move'], response['fen'], response['isCheck'], response['isCheckmate']);

    // Stop if game is over
    if (!response['isCheckmate'] && !response['gameOver']) {
        
        // setTimeout(selfPlayLoop, 500); // 500ms delay between moves
        await sleep(1000)
        await selfPlayLoop(url, color)
    }
}

// var turn = false; // true --> human plays || false --> AI plays
async function playAgainstEngine(url, color){
    
    if(ai_turn){
        const response = await getMoves_(url, color);
        console.log(response);
        if(response['draw']){
            console.log("Game is a draw")
            return
        }
        makeMove(response['move'], response['fen'], response['isCheck'], response['isCheckmate']);

        if (response['isCheckmate'] && response['gameOver']) {
            console.log('GAME OVER')
            return
        }
        ai_turn = !ai_turn

        // Stop if game is over
        // if (!response['isCheckmate'] && !response['gameOver']) {
            
        //     // setTimeout(selfPlayLoop, 500); // 500ms delay between moves
        //     await sleep(1000)
        //     await playAgainstEngine(url)
        // }
    }

}

function userProfileConfig(engine_color, engine_name = 'KDB-17', player_name, isPlayingSF){
        chessBoardEl = document.getElementById('chess-board')
        engineProfileEl = document.getElementById('engine-id')
        userProfileEl = document.getElementById('user-id')

        engineProfileIdEl = document.getElementById('engine-prof-id')
        userProfileIdEl = document.getElementById('user-prof-id')

        engineProfileIdEl.textContent = engine_name
        userProfileIdEl.textContent = player_name

        engineProfileEl.style.display = "flex"
        userProfileEl.style.display = "flex"

        

        if(!isPlayingSF && (engine_color == 'black' || engine_color == 'white')){
            engineProfileEl.style.order = "1"
            chessBoardEl.style.order = "2"
            userProfileEl.style.order = "3"
        }
        else{
            userProfileEl.style.order = "1"
            chessBoardEl.style.order = "2"  
            engineProfileEl.style.order = "3"
        }
}



document.getElementById("close-popup").addEventListener("click", () =>{
    document.getElementsByClassName('popup')[0].style.display = "none"
    document.getElementsByClassName('buttons')[0].style.display = "flex"
    setBoardBlurred(true)
})

document.getElementById('close-result').addEventListener("click", () =>{
    document.getElementById('my-game-result').style.display = "none"
    document.getElementsByClassName('buttons')[0].style.display = "flex"
    document.getElementsByClassName('profile')[0].style.display = "none"
    document.getElementsByClassName('profile')[1].style.display = "none"
    location.reload()
    setBoardBlurred(true)
})

document.getElementById('p-a-s-f').addEventListener("click", function(){
    // document.getElementById('chess-board').style.filter = "none"
    // setBoardBlurred(false)
    const popupEl = document.getElementsByClassName('popup')[0]
    popupEl.style.display = "block"

    document.getElementById('btn-white-player').onclick = null;
    document.getElementById('btn-white-player').addEventListener("click", ()=>{
        
        popupEl.style.display = "none"
        setBoardBlurred(false)
        engine_vs_sf = true
        // ENGINE COLOR IS WHITE
        COLOR = 'white'


       userProfileConfig(COLOR, 'KDB-17', 'SF-NNUE', true)
       selfPlayLoop('/play_against_stockfish_new_model', COLOR)
        // playAgainstEngine('/play_against_engine', COLOR)
    }, {once: true})

   
    document.getElementById('btn-black-player').onclick = null;
    document.getElementById('btn-black-player').addEventListener("click", ()=>{
        popupEl.style.display = "none"
        setBoardBlurred(false)
        engine_vs_sf = true
        // ENGINE COLOR IS BLACK
        COLOR = 'black'
        play_as_black = true

        userProfileConfig(COLOR, 'KDB-17', 'SF-NNUE', true)

        chessBoardEl = document.getElementById('chess-board')
        chessBoardEl.style.transform = "rotate(180deg)"

        pieces = document.querySelectorAll('.piece')

        pieces.forEach(piece => {
            piece.style.transform = "rotate(180deg)"
        })
        selfPlayLoop('/play_against_stockfish_new_model', COLOR)
        // playAgainstEngine('/play_against_engine', COLOR)
    }, {once: true})
    
    
})

document.getElementsByClassName('buttons')[0].addEventListener("click", function(event){
    document.getElementsByClassName('buttons')[0].style.display = "none"
    document.getElementById('chess-board').style.opacity = "0.75"
})

document.getElementById('play-again').addEventListener("click", async () =>{
    play_as_black = !play_as_black // toggle the play_as_black variable
    

    const res= await fetch('/initialize')
    const data = await res.json()
    initial_board_setup(data.fen)
    setBoardBlurred(false)
    const profileEl = document.getElementsByClassName('profile')
    profileEl[0].style.filter = "blur(0)"
    profileEl[1].style.filter = "blur(0)"

    document.getElementById('my-game-result').style.display = "none"
    chessBoardEl = document.getElementById('chess-board')
    // chessBoardEl.style.transform = "rotate(180deg)"

    if(COLOR === 'white') COLOR = 'black'
    else if(COLOR === 'black') COLOR = 'white'

    
    pieces = document.querySelectorAll('.piece')
    if(!playAgainstEngine || engine_vs_sf){
        if (COLOR === 'black') {
            chessBoardEl.style.transform = "rotate(180deg)"
            pieces.forEach(piece => piece.style.transform = "rotate(180deg)")
        } else {
            chessBoardEl.style.transform = ""
            pieces.forEach(piece => piece.style.transform = "")
        }
    }
    else{
        if(play_as_black){
            chessBoardEl.style.transform = "rotate(180deg)"
            pieces.forEach(piece => piece.style.transform = "rotate(180deg)")
        }
        else{
            chessBoardEl.style.transform = ""
            pieces.forEach(piece => piece.style.transform = "")
        }
    }    


    
    console.log("Play against Engine :", play_against_engine)
    if (play_against_engine) {
        ai_turn = (COLOR == 'white') ? true : false
        // COLOR = (COLOR === 'white') ? 'black' : 'white'; // toggle the COLOR variable
        playAgainstEngine('/play_against_engine', COLOR)
    } 
    else if(engine_vs_sf){
        selfPlayLoop('/play_against_stockfish_new_model', COLOR)
    }
})


document.getElementById('play-against-engine').addEventListener("click", function(){

    // setBoardBlurred(false)
    
    const popupEl = document.getElementsByClassName('popup')[0]
    popupEl.style.display = "block"
    // document.getElementById('chess-board').style.filter = "none"
    // 
    engine_name = 'KDB-17'
    player_name = 'Player'

    document.getElementById('btn-white-player').onclick = null;
    document.getElementById('btn-white-player').addEventListener("click", ()=>{
        play_against_engine = true
        ai_turn = false
        popupEl.style.display = "none"
        setBoardBlurred(false)
        // ENGINE COLOR IS BLACK
        COLOR = 'black'


       userProfileConfig(COLOR, engine_name, player_name, false)

       playAgainstEngine('/play_against_engine', COLOR)
    }, {once: true})

   
    document.getElementById('btn-black-player').onclick = null;
    document.getElementById('btn-black-player').addEventListener("click", ()=>{
        play_against_engine = true
        popupEl.style.display = "none"
        setBoardBlurred(false)
        // ENGINE COLOR IS WHITE
        COLOR = 'white'
        play_as_black = true

        userProfileConfig(COLOR, engine_name, player_name, false)

        chessBoardEl = document.getElementById('chess-board')
        chessBoardEl.style.transform = "rotate(180deg)"

        pieces = document.querySelectorAll('.piece')

        pieces.forEach(piece => {
            piece.style.transform = "rotate(180deg)"
        })

        playAgainstEngine('/play_against_engine', COLOR)
    }, {once: true})
})

document.getElementById('play-against-friend').addEventListener("click", function(){
    console.log("PLAY AGAINST FRIEND CLICKED")
    ai_turn = false
    play_against_engine = false

       
    const popupEl_ = document.getElementsByClassName('popup')[0]
    popupEl_.style.display = "block"
    // ********************************************************************************************//

    
    player1_name = 'Player 1'
    player2_name = 'Player 2'

    document.getElementById('btn-white-player').onclick = null;
    document.getElementById('btn-white-player').addEventListener("click", ()=>{
       
        popupEl_.style.display = "none"
        setBoardBlurred(false)
        
        COLOR = 'white'

       userProfileConfig(COLOR, player1_name, player2_name, false)

    
    }, {once: true})


    document.getElementById('btn-black-player').onclick = null;
    document.getElementById('btn-black-player').addEventListener("click", ()=>{
       
        popupEl_.style.display = "none"
        setBoardBlurred(false)
       
        COLOR = 'black'
        play_as_black = true

        userProfileConfig(COLOR, player1_name, player2_name, false)

        chessBoardEl = document.getElementById('chess-board')
        chessBoardEl.style.transform = "rotate(180deg)"

        pieces = document.querySelectorAll('.piece')

        pieces.forEach(piece => {
            piece.style.transform = "rotate(180deg)"
        })


    }, {once: true})

    // ********************************************************************************************//
    // const popupEl = document.getElementsByClassName('popup')[0]
    // popupEl.style.display = "none"
    
    // document.getElementById('chess-board').style.filter = "none"
})