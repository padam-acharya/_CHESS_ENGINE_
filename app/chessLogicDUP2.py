

# Start game loop



import chess
import chess.pgn
import chess.engine
import tensorflow as tf
import numpy as np
import functools

# Load TFLite model and setup interpreter
interpreter = tf.lite.Interpreter(model_path="model.tflite_1")
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# TFLite evaluation
def evaluate_with_tflite(input_tensor):
    interpreter.set_tensor(input_details[0]['index'], input_tensor)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index']).copy()
    return output_data[0][0] * 1000  # convert back to centipawns

squares_index = {'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7}

def square_to_index(square):
    letter = chess.square_name(square)
    return 8 - int(letter[1]), squares_index[letter[0]]

# Converts board into 14-channel bitboard input for CNN
def split_dims(board):
    board3d = np.zeros((14, 8, 8), dtype=np.int8)
    for piece in chess.PIECE_TYPES:
        for square in board.pieces(piece, chess.WHITE):
            i, j = divmod(square, 8)
            board3d[piece - 1][7 - i][j] = 1
        for square in board.pieces(piece, chess.BLACK):
            i, j = divmod(square, 8)
            board3d[piece + 5][7 - i][j] = 1
    # White and Black legal attack maps
    for color, layer in [(chess.WHITE, 12), (chess.BLACK, 13)]:
        board.turn = color
        for move in board.legal_moves:
            i, j = square_to_index(move.to_square)
            board3d[layer][i][j] = 1
    return np.expand_dims(board3d, axis=0).astype(np.float32)

# Cache neural evaluations by FEN
@functools.lru_cache(maxsize=100000)
def evaluate_board_cached(fen):
    board = chess.Board(fen)
    input_tensor = split_dims(board)
    return evaluate_with_tflite(np.ascontiguousarray(input_tensor))

# Use static eval in quiescence to avoid NN overload
PIECE_VALUES = {chess.PAWN: 100, chess.KNIGHT: 320, chess.BISHOP: 330,
                chess.ROOK: 500, chess.QUEEN: 900, chess.KING: 0}

def static_eval(board):
    score = 0
    for piece, value in PIECE_VALUES.items():
        score += len(board.pieces(piece, chess.WHITE)) * value
        score -= len(board.pieces(piece, chess.BLACK)) * value
    return score

# Final evaluation used in minimax
def evaluate_board(board):
    if board.is_checkmate():
        return 9999 if not board.turn else -9999
    elif board.is_stalemate() or board.is_insufficient_material():
        return 0
    else:
        return evaluate_board_cached(board.fen())

# Quiescence search using static evaluation only
def quiescence(board, alpha, beta, maximizing):
    stand_pat = static_eval(board)
    if maximizing:
        if stand_pat >= beta: return beta
        alpha = max(alpha, stand_pat)
    else:
        if stand_pat <= alpha: return alpha
        beta = min(beta, stand_pat)
    for move in board.legal_moves:
        if board.is_capture(move):
            board.push(move)
            score = quiescence(board, alpha, beta, not maximizing)
            board.pop()
            if maximizing:
                alpha = max(alpha, score)
                if alpha >= beta: break
            else:
                beta = min(beta, score)
                if beta <= alpha: break
    return alpha if maximizing else beta

# Move ordering heuristics
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
            s += 800 + PIECE_VALUES.get(move.promotion, 0) * 10
        if board.gives_check(move):
            s += 500
        return s
    return sorted(moves, key=score, reverse=True)

# Minimax with alpha-beta pruning
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
    moves = order_moves(board, list(board.legal_moves))
    if maximizing:
        max_eval = float('-inf')
        for move in moves:
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
        for move in moves:
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

# Game and play functions
def self_play(board, turn=False):
    print("\nAI is thinking...")
    score, path = minimax(board, 3, float('-inf'), float('inf'), board.turn == (not turn))
    eval_cache.clear()
    if path:
        move = path[0]
        board.push(move)
        print("AI played:", move)
        print(board)
        return move
    else:
        print("No legal moves.")
        return None

# STOCKFISH
engine = chess.engine.SimpleEngine.popen_uci(r"C:\Users\achar\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe")

# # LEELA CHESS ZERO
# engine = chess.engine.SimpleEngine.popen_uci(r"C:\Users\achar\Downloads\lc0-v0.31.2-windows-cpu-dnnl\lc0.exe")

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
        eval_cache.clear()
        score, path = minimax(board, 3, float('-inf'), float('inf'),board.turn)
        if path:
            best_move = path[0]
            board.push(best_move)
            print("AI played: ", best_move)
            print(board)
            return best_move
        else:
            print("AI has no legal moves.")
            return

# Main
# if __name__ == "__main__":
#     board = chess.Board()
#     side = input("Play as white or black? (w/b): ").lower()
#     stockfish_color = chess.BLACK if side == 'w' else chess.WHITE

#     while not board.is_game_over():
#         play_against_stockfish(board, stockfish_color)

#     print("\nGame Over!")
#     print("Result:", board.result())
#     game = chess.pgn.Game.from_board(board)
#     print("\nPGN of the game:")
#     print(game.accept(chess.pgn.StringExporter()))
#     engine.quit()
