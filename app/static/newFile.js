function sayHello(){
    alert("Hello World")
}
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

function playAudio(url){
    const audio = new Audio(url)
    audio.currentTime = 0
    audio.play().catch((error) => {
        console.error('Error playing audio:', error);
    })
}

var legal_moves = []
var GLOBAL_FEN = {}
var extract_sqs = []

async function dragstartHandler(event){
    event.dataTransfer.setData("text/plain", event.target.id);

    try {
        const response = await fetch('/legal_moves');
        const val = await response.json();
        console.log(val);
        legal_moves = val['legal_moves'];
        const side = val['side_to_move'];
        GLOBAL_FEN = val['fen'];
        console.log(legal_moves);
        console.log(side);
    } catch (error) {
        console.error('Error fetching legal moves:', error);
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

function dragoverHandler(event) {
  event.preventDefault();
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
        return
    }


    //  PROMOTE TO BLACK ROOK/QUEEN/BISHOP/KNIGHT WHEN THERE IS NO CAPTURE
    if(promotionFlag && draggedPiece.classList.contains("white-pawn")){
        //remove the dragged piece from its original square
        const draggedPieceParent = draggedPiece.parentNode
        if(draggedPieceParent)
            draggedPieceParent.removeChild(draggedPiece)

        const promPce = prompt("Enter the piece you want to promote to (q, r, b, n):", "q").toUpperCase()
        const promotedPiece = `<span class="piece white-piece" id="${chess_unicode_html_decimal[promPce]}${to[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce]}</span>`
                
        response = await postData('/move', {move: move+promPce.toLowerCase()})
        dropSquare.innerHTML = promotedPiece
        
    }
    
    //  PROMOTE TO WHITE ROOK/QUEEN/BISHOP/KNIGHT WHEN THERE IS NO CAPTURE
    if(promotionFlag && draggedPiece.classList.contains("black-pawn")){
        const draggedPieceParent = draggedPiece.parentNode
        if(draggedPieceParent)
            draggedPieceParent.removeChild(draggedPiece)

        const promPce = prompt("Enter the piece you want to promote to (q, r, b, n):", "q").toLowerCase()
        const promotedPiece = `<span class="piece black-piece" id="${chess_unicode_html_decimal[promPce]}${to[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce]}</span>`
                
        response = await postData('/move', {move: move+promPce})
        dropSquare.innerHTML = promotedPiece
    }

    if(!promotionFlag) dropSquare.appendChild(draggedPiece)

    if(response['isCheck']){
        playAudio('static/audio/move-check.mp3')
        return
    }

    if(captureFlag == false && castlingFlag == false) playAudio('static/audio/move-self.mp3')
}

let START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
let fen  = START_FEN.split(" ")[0]
let ranks  = fen.split("/")

function initial_board_setup() {
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

document.addEventListener("DOMContentLoaded", function() {
    initial_board_setup();
    fetch('/initialize')
    .then(response => response.json())
    .then(data => {
        console.log("Game initialized:", data);
    })
    .catch(error =>{
        console.log("Error initializing game:", error)
    })
});

async function getMoves_(path){
    const response = await fetch(path);
    const data = await response.json();
    if (data.status === 'error') {
        console.error("Backend error:", data.message);
    }
    return data;
}

function makeMove(move, fen , isCheck, isCheckmate){
    console.log(move)
    var isPromotion = false
    var promPce = ""
    if (!move) {
        console.warn("No move to make (game over or draw).");
        return;
    }
    if(move.length == 5){
        promPce = move[4]
        move = move.slice(0,4)
        isPromotion = true
    }
    const fromSquare = move.slice(0, 2)
    const toSquare = move.slice(2)

    const fromSquareEL = document.getElementById(fromSquare)
    const toSquareEL = document.getElementById(toSquare)

    console.log(fromSquareEL, toSquareEL)

    const fromSquarePiece = fromSquareEL.firstChild 
    
     if(!fromSquarePiece) {
        console.error("No piece found in the from square:", fromSquare);
        return;
    }

    fromSquareEL.removeChild(fromSquarePiece)
   
    // remove the piece from the fromSquare
    const toSquarePiece = toSquareEL.firstChild;

    console.log(fromSquarePiece, toSquarePiece)
    if(toSquarePiece && toSquarePiece !== fromSquarePiece){
        // check colors
        const toSquarePieceIsWhite = toSquarePiece.classList.contains("white-piece")
        const toSquarePieceIsBlack = toSquarePiece.classList.contains("black-piece")
        const fromSquarePieceIsWhite = fromSquarePiece.classList.contains("white-piece")
        const fromSquarePieceIsBlack = fromSquarePiece.classList.contains("black-piece")

        if((toSquarePieceIsWhite && fromSquarePieceIsBlack) || (toSquarePieceIsBlack && fromSquarePieceIsWhite)){

            //capture the piece
            toSquareEL.removeChild(toSquarePiece)
            if(isPromotion && fromSquarePieceIsWhite){

                // promote white pawn 
               
                const promotedPiece = `<span class="piece white-piece" id="${chess_unicode_html_decimal[promPce.toUpperCase()]}${toSquare[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce.toUpperCase()]}</span>`
                
                toSquareEL.innerHTML = promotedPiece
                if(!isCheck) playAudio('static/audio/capture.mp3')
                
            }

            if(isPromotion && fromSquarePieceIsBlack){
                
                // promote black pawn
               
                const promotedPiece = `<span class="piece black-piece" id="${chess_unicode_html_decimal[promPce.toLowerCase()]}${toSquare[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce.toLowerCase()]}</span>`
                
                toSquareEL.innerHTML = promotedPiece
                if(!isCheck) playAudio('static/audio/capture.mp3')
                
                

            }
            captureFlag = true
            if(!isCheck) playAudio('static/audio/capture.mp3')
        }
        else{
            return;
        }
    }


    if(!isCheck) playAudio('static/audio/move-self.mp3')
    // toSquareEL.appendChild(fromSquarePiece)

    const en_passant_square = fen.split(" ")[3]
    const castle_rights = fen.split(" ")[2]
    console.log("EN PASSANT SQUARE:", en_passant_square)

    if(move.slice(2) == en_passant_square){
         let pawn_square = fen.split(" ")[1] == 'w' ? en_passant_square[0] + (parseInt(en_passant_square[1]) - 1) : en_passant_square[0] + (parseInt(en_passant_square[1]) + 1)

         const pawn_square_element = document.getElementById(pawn_square)
         if(pawn_square_element.firstChild){
            pawn_square_element.removeChild(pawn_square_element.firstChild)
         }
         captureFlag = true
         playAudio('static/audio/capture.mp3')
    }

    // handles castling
    var castlingFlag = false
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

        let rook_piece = rook_square.firstChild
        playAudio('static/audio/castle.mp3')
        
        rook_square.removeChild(rook_square.firstChild) //remove rook from the square 
        king_square.appendChild(rook_piece) //append rook to the king square
        
        castlingFlag = true
        
    }


    if(isCheckmate){
        playAudio('static/audio/move-self.mp3')
        playAudio('static/audio/game-end.mp3')
        toSquareEL.appendChild(fromSquarePiece)
        return
    }


    // promote white pawan without capture
    if(isPromotion  && fromSquarePiece.classList.contains("white-pawn")){

        // promote white pawn 
        // const toSquarePieceParent = toSquarePiece.parentNode
        // if(toSquarePieceParent)
        //     toSquarePieceParent.removeChild(toSquarePiece)
        
        const promotedPiece = `<span class="piece white-piece" id="${chess_unicode_html_decimal[promPce.toUpperCase()]}${toSquare[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce.toUpperCase()]}</span>`
        // fromSquareEL.removeChild(fromSquarePiece)
        toSquareEL.innerHTML = promotedPiece  
        
    }


    if(isPromotion  &&  fromSquarePiece.classList.contains("black-pawn")){

        // promote black pawn 
        // const toSquarePieceParent = toSquarePiece.parentNode
        // if(toSquarePieceParent)
        //     toSquarePieceParent.removeChild(toSquarePiece)
        
        const promotedPiece = `<span class="piece black-piece" id="${chess_unicode_html_decimal[promPce.toLowerCase()]}${toSquare[0]}${Math.floor(Math.random()*1000)}" draggable="True" ondragstart="dragstartHandler(event)">${chess_unicode_html_decimal[promPce.toLowerCase()]}</span>`
        // fromSquareEL.removeChild(fromSquarePiece)
        toSquareEL.innerHTML = promotedPiece
        
    }


    if(isCheck){
        playAudio('static/audio/move-check.mp3')
        return
    }

    if(!isPromotion) toSquareEL.appendChild(fromSquarePiece)

    // if(captureFlag == false && castlingFlag == false) playAudio('static/audio/move-self.mp3')
}

async function selfPlayLoop(url) {
    
    const response = await getMoves_(url);
    console.log(response);
    if(response['draw']){
        console.log("Game is a draw")
        return
    }
    makeMove(response['move'], response['fen'], response['isCheck'], response['isCheckmate']);

    // Stop if game is over
    if (!response['isCheckmate'] && !response['gameOver']) {
        
        // setTimeout(selfPlayLoop, 500); // 500ms delay between moves
        selfPlayLoop(url)
    }
}

document.getElementById('self-play').addEventListener("click", function() {
   
    selfPlayLoop('/self_play')
});

document.getElementById('play-against-stockfish').addEventListener("click", function(){
    selfPlayLoop('/play_against_stockfish')
})