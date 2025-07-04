import chess
import chess.pgn
import random
import tensorflow as tf
import numpy as np

# Load Keras model and convert to TFLite
model = tf.keras.models.load_model(r"C:\Users\achar\Downloads\model (1).keras")
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model_1 = converter.convert()

# Save the TFLite model
with open("model.tflite_1", "wb") as f:
    f.write(tflite_model_1)

# Load TFLite model and set up interpreter
interpreter = tf.lite.Interpreter(model_path="model.tflite_1")
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

def evaluate_with_tflite(input_tensor):
    interpreter.set_tensor(input_details[0]['index'], input_tensor)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index']).copy()  # Copy output to avoid backend reference
    return output_data[0][0] * 1000

def fen_to_bitboards(fen):
    board = chess.Board(fen)
    tensors = np.zeros((14, 8, 8), dtype=np.float32)
    piece_map = {
        'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
        'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11
    }
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            piece_idx = piece_map[piece.symbol()]
            row, col = divmod(square, 8)
            tensors[piece_idx, 7 - row, col] = 1
    tensors[12, :, :] = 1 if board.turn == chess.WHITE else 0
    castling_rights = [chess.BB_H1, chess.BB_A1, chess.BB_H8, chess.BB_A8]
    for i, right in enumerate(castling_rights):
        if board.castling_rights & right:
            tensors[13, :, :] = 1
            break
    return tensors

def evaluate_board(board):
    fen = board.fen()
    if board.is_checkmate():
        return 9999 if board.turn == chess.BLACK else -9999
    elif board.is_stalemate() or board.is_insufficient_material():
        return 0
    else:
        input_tensor = fen_to_bitboards(fen)
        input_tensor = np.transpose(input_tensor, (1, 2, 0))  # (8, 8, 14)
        input_tensor = np.expand_dims(input_tensor, axis=0)   # (1, 8, 8, 14)
        input_tensor = np.ascontiguousarray(input_tensor, dtype=np.float32)  # Ensure no internal references
        return evaluate_with_tflite(input_tensor)

def quiescence(board, alpha, beta, maximizing):
    stand_pat = evaluate_board(board)
    if maximizing:
        if stand_pat >= beta:
            return beta
        if alpha < stand_pat:
            alpha = stand_pat
    else:
        if stand_pat <= alpha:
            return alpha
        if beta > stand_pat:
            beta = stand_pat
    for move in board.legal_moves:
        if board.is_capture(move):
            board.push(move)
            score = quiescence(board, alpha, beta, not maximizing)
            board.pop()
            if maximizing:
                if score > alpha:
                    alpha = score
                if alpha >= beta:
                    break
            else:
                if score < beta:
                    beta = score
                if beta <= alpha:
                    break
    return alpha if maximizing else beta

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0
}

def mvv_lva(move, board):
    if board.is_capture(move):
        victim = board.piece_at(move.to_square)
        attacker = board.piece_at(move.from_square)
        if victim and attacker:
            return 10 * PIECE_VALUES[victim.piece_type] - PIECE_VALUES[attacker.piece_type]
    return 0

def order_moves(board, moves):
    def score(move):
        s = 0
        if board.is_capture(move):
            s += 1000 + mvv_lva(move, board)
        if move.promotion:
            s += 800 + (PIECE_VALUES.get(move.promotion, 0) * 10)
        if board.gives_check(move):
            s += 500
        return s
    return sorted(moves, key=score, reverse=True)

eval_cache = {}

def minimax(board, depth, alpha, beta, maximizing):
    fen = board.fen()
    if fen in eval_cache and eval_cache[fen]["depth"] >= depth:
        return eval_cache[fen]["score"], eval_cache[fen]["path"]
    if board.is_game_over():
        score = evaluate_board(board)
        eval_cache[fen] = {"score": score, "depth": depth, "path": []}
        return score, []
    if depth == 0:
        score = quiescence(board, alpha, beta, maximizing)
        eval_cache[fen] = {"score": score, "depth": depth, "path": []}
        return score, []

    best_path = []
    if maximizing:
        max_eval = float('-inf')
        for move in order_moves(board, list(board.legal_moves)):
            board.push(move)
            eval, path = minimax(board, depth - 1, alpha, beta, False)
            board.pop()
            if eval > max_eval:
                max_eval = eval
                best_path = [move] + path
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        eval_cache[fen] = {"score": max_eval, "depth": depth, "path": best_path}
        return max_eval, best_path
    else:
        min_eval = float('inf')
        for move in order_moves(board, list(board.legal_moves)):
            board.push(move)
            eval, path = minimax(board, depth - 1, alpha, beta, True)
            board.pop()
            if eval < min_eval:
                min_eval = eval
                best_path = [move] + path
            beta = min(beta, eval)
            if beta <= alpha:
                break
        eval_cache[fen] = {"score": min_eval, "depth": depth, "path": best_path}
        return min_eval, best_path

# Game Setup
board = chess.Board()
# str = input("Do you want to play as white or black? (w/b): ")
# turn = False if str == 'w' else True

def self_play(board, turn=False):
        print("STARTING SELF PLAY\n")

        print(board)
        print("\nAI is thinking...")
        score, path = minimax(board, 3, float('-inf'), float('inf'), board.turn == (not turn))
        eval_cache.clear()
        if path:
            best_move = path[0]
            board.push(best_move)
            return best_move
        else:
            print("AI has no legal moves.")
            return None

engine = chess.engine.SimpleEngine.popen_uci(r"C:\Users\achar\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe")

def play_against_stockfish(board, stockfish_color):
    if board.turn == stockfish_color:
        result = engine.play(board, chess.engine.Limit(depth=4))
        move = result.move       
        board.push(move)
        print("STOCKFISH played: ", move)
        print(board)
        return move
    else:
        print("AI is thinking...")
        score, path = minimax(board, 3, float('-inf'), float('inf'),board.turn)
        eval_cache.clear()
        if path:
            best_move = path[0]
            board.push(best_move)
            print("AI played: ", best_move)
            print(board)
            return best_move
        else:
            print("AI has no legal moves.")
            return
        


        

def gameStats(board):
    print("\nGame Over!")
    print("Result:", board.result())
    print("Final Board Position:")
    print(board)
    game = chess.pgn.Game.from_board(board)
    exporter = chess.pgn.StringExporter()
    pgn_string = game.accept(exporter)
    print("\nPGN of the game:")
    print(pgn_string)

# Start game loop