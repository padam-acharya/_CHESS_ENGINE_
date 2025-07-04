from flask import Flask, render_template, request, jsonify
from chesslogic import self_play, play_against_stockfish
from chessLogicdup import self_play as sf
from chessLogicdup import play_against_stockfish as pasf
from chessLogicdup import gameStats as gs
from chessLogicdup import play_against_engine
import chess


app = Flask(__name__)
print(__name__)

board = chess.Board()
print(board)


@app.route('/')
def chessboard():
    files = [chr(ord('a') + i) for i in range(8)]
    return render_template('index.html', files=files)

@app.route('/initialize', methods=['GET'])
def initialize():
    global board
    board = chess.Board()
    print(board)
    return jsonify({'status': 'success', 'fen': board.fen()})

@app.route('/legal_moves', methods = ['GET'])
def legal_moves():
    moves = [move.uci() for move in board.legal_moves]
    print(moves)
    return jsonify({'legal_moves': moves, 'side_to_move': board.turn, 'fen': board.fen()})

@app.route('/move', methods = ['POST'])
def move():
    try:
        data = request.get_json()
        move = data['move']

        board.push(chess.Move.from_uci(move))
        print(board)
        return jsonify({'status': 'success', 'fen': board.fen(), 'isCheck': board.is_check(), 'isCheckmate': board.is_checkmate(), 'isStalemate': board.is_stalemate()})
    except Exception as e:
        print("Error: ", e)
        return jsonify({'status': 'error', 'message': str(e)})

    
@app.route('/self_play', methods = ['POST', 'GET'])
def self_play_route():
    global board
    global turn

    turn = (board.turn == chess.WHITE)

    try:
        
        best_move = self_play(board, turn)
        print(best_move)
        
        return jsonify({
            'status': 'success',
            'fen': board.fen(),
            'move': best_move.uci() if best_move else None,
            'isCheck': board.is_check(),
            'isCheckmate': board.is_checkmate(),
            'isStalemate': board.is_stalemate(),
            'draw': True if board.is_repetition() else False
            })
    except Exception as e:
        print("Error in /self_play: ", e)
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/play_against_stockfish', methods=['GET', 'POST'])
def stockfish_opp():
    global board
    
    STOCKFISH_COLOR = chess.BLACK

    try:
        best_move = play_against_stockfish(board, STOCKFISH_COLOR)
        # print(best_move)

        return jsonify({
            'status': 'success',
            'fen': board.fen(),
            'move': best_move.uci() if best_move else None,
            'isCheck': board.is_check(),
            'isCheckmate': board.is_checkmate(),
            'isStalemate': board.is_stalemate(),
            'draw': True if board.is_repetition() else False
            })
    except Exception as e:
        print("Error in /self_play: ", e)
        return jsonify({'status': 'error', 'message': str(e)})
    
@app.route('/play_against_stockfish_new_model', methods=['GET', 'POST'])
def stockfish_opp_new_model():
    global board

    ENGINE_COLOR = chess.BLACK if request.args.get('color') == 'white' else chess.WHITE
    
    # STOCKFISH_COLOR = chess.BLACK if ENGINE_COLOR == chess.WHITE else chess.WHITE

    try:
        best_move = pasf(board, ENGINE_COLOR)
        # print(best_move)
        if(board.is_game_over() or board.is_checkmate() or board.is_stalemate() or board.is_repetition()):
            gs(board)

        return jsonify({
            'status': 'success',
            'fen': board.fen(),
            'move': best_move.uci() if best_move else None,
            'isCheck': board.is_check(),
            'isCheckmate': board.is_checkmate(),
            'isStalemate': board.is_stalemate(),
            'draw': True if board.is_repetition() else False
            })
    except Exception as e:
        print("Error in /play_against_stockfish_new_model: ", e)
        return jsonify({'status': 'error', 'message': str(e)})
    
@app.route('/play_against_engine', methods=['GET', 'POST'])
def engine_as_opp():
    global board
    
    ENGINE_COLOR = chess.WHITE if request.args.get('color') == 'white' else chess.BLACK

    try:
        best_move = play_against_engine(board, ENGINE_COLOR)
        # print(best_move)
        if(board.is_game_over() or board.is_checkmate() or board.is_stalemate() or board.is_repetition()):
            gs(board)
            

        return jsonify({
            'status': 'success',
            'fen': board.fen(),
            'move': best_move.uci() if best_move else None,
            'isCheck': board.is_check(),
            'isCheckmate': board.is_checkmate(),
            'isStalemate': board.is_stalemate(),
            'draw': True if board.is_repetition() else False
            })
    except Exception as e:
        print("Error in /play_against_engine: ", e)
        return jsonify({'status': 'error', 'message': str(e)})


if __name__ == '__main__':
    app.run(debug = True)