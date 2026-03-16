from flask import Flask, request, jsonify, render_template
import json
import os
import uuid
from datetime import datetime
from collections import Counter

app = Flask(__name__)

# =========================================================
# NOME DOS ARQUIVOS JSON
# =========================================================
COMMANDERS_FILE = "jsonFiles/commanders.json"
MATCHES_FILE = "jsonFiles/matches.json"


# =========================================================
# FUNÇÕES BÁSICAS PARA GARANTIR E LER OS JSONS
# =========================================================
def ensure_json_file(file_path, default_value):
    """
    Garante que o arquivo JSON exista.

    Se não existir, cria.
    Se existir mas estiver vazio, escreve o valor padrão.
    """
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(default_value, f, indent=2, ensure_ascii=False)
        return

    if os.path.getsize(file_path) == 0:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(default_value, f, indent=2, ensure_ascii=False)


def load_json(file_path, default_value):
    """
    Lê um JSON com segurança.

    Se estiver vazio, inválido ou com formato inesperado,
    retorna o valor padrão.
    """
    ensure_json_file(file_path, default_value)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()

            if not content:
                return default_value

            data = json.loads(content)

            if not isinstance(data, type(default_value)):
                return default_value

            return data

    except (json.JSONDecodeError, OSError):
        return default_value


def save_json(file_path, data):
    """
    Salva o conteúdo formatado no JSON.
    """
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_commanders():
    return load_json(COMMANDERS_FILE, [])


def save_commanders(data):
    save_json(COMMANDERS_FILE, data)


def load_matches():
    return load_json(MATCHES_FILE, [])


def save_matches(data):
    save_json(MATCHES_FILE, data)


# =========================================================
# FUNÇÕES DE NORMALIZAÇÃO E ESTATÍSTICA
# =========================================================
def normalize_input_value(input_type, value):
    """
    Normaliza os valores conforme o tipo do input,
    para facilitar as estatísticas.
    """
    if input_type == "number":
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    if input_type == "checkbox":
        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            return value.strip().lower() in ["true", "1", "yes", "on", "checked"]

        return bool(value)

    if input_type in ["scale_0_10", "color_combo", "text"]:
        if value is None:
            return ""
        return str(value).strip()

    if value is None:
        return ""

    return str(value).strip()


def compute_stats_for_commander(commander, matches):
    """
    Computes overall stats for all inputs of one commander.

    Extra rule:
    If there is an input named 'win' (checkbox),
    show win rate as the FIRST stat.
    """

    input_definitions = commander.get("inputs", [])
    stats = []

    # =========================================================
    # WIN RATE CALCULATION
    # =========================================================
    win_input = None

    for input_def in input_definitions:
        if input_def.get("value", "").strip().lower() == "win":
            if input_def.get("type") == "checkbox":
                win_input = input_def
                break

    if win_input:
        total_games = 0
        wins = 0

        for match in matches:
            match_values = match.get("values", {})
            raw_value = match_values.get("win")

            normalized = normalize_input_value("checkbox", raw_value)

            if raw_value not in [None, ""]:
                total_games += 1

                if normalized:
                    wins += 1

        if total_games > 0:
            winrate = round((wins / total_games) * 100)

            stats.append({
                "input_name": "Win Rate",
                "input_type": "derived",
                "summary": f"{winrate}% ({wins} / {total_games})",
                "games_count": total_games
            })

    # =========================================================
    # NORMAL INPUT STATS
    # =========================================================
    for input_def in input_definitions:
        input_name = input_def.get("value", "").strip()
        input_type = input_def.get("type", "text").strip().lower()

        if not input_name:
            continue

        values = []

        for match in matches:
            match_values = match.get("values", {})
            raw_value = match_values.get(input_name)

            normalized = normalize_input_value(input_type, raw_value)

            if input_type == "number":
                if normalized is not None:
                    values.append(normalized)
            else:
                if normalized != "":
                    values.append(normalized)

        if not values:
            stats.append({
                "input_name": input_name,
                "input_type": input_type,
                "summary": "No data yet",
                "games_count": 0
            })
            continue

        if input_type == "number":
            avg = round(sum(values) / len(values))

            stats.append({
                "input_name": input_name,
                "input_type": input_type,
                "summary": f"Average: {avg}",
                "games_count": len(values)
            })

        else:
            counter = Counter(values)
            most_common_value, count = counter.most_common(1)[0]

            stats.append({
                "input_name": input_name,
                "input_type": input_type,
                "summary": f"Most common: {most_common_value}",
                "games_count": len(values)
            })

    return stats


# =========================================================
# ROTAS DE PÁGINA
# =========================================================
@app.route("/")
def home():
    return render_template("index.html")


# =========================================================
# API - BUSCAR COMMANDERS
# =========================================================
@app.route("/api/commanders", methods=["GET"])
def get_commanders():
    commanders = load_commanders()
    return jsonify(commanders)


# =========================================================
# API - CRIAR OU EDITAR COMMANDER
# =========================================================
@app.route("/api/commanders", methods=["POST"])
def save_commander_route():
    data = request.get_json(silent=True) or {}

    commander_id = str(data.get("id", "")).strip()
    commander_name = str(data.get("name", "")).strip()
    inputs = data.get("inputs", [])

    if not commander_name:
        return jsonify({
            "success": False,
            "error": "Commander name is required."
        }), 400

    if not isinstance(inputs, list):
        return jsonify({
            "success": False,
            "error": "Inputs must be a list."
        }), 400

    cleaned_inputs = []
    seen_names = set()

    for item in inputs:
        if not isinstance(item, dict):
            continue

        input_name = str(item.get("value", "")).strip()
        input_type = str(item.get("type", "text")).strip().lower()

        if not input_name:
            continue

        if input_type not in ["text", "number", "checkbox", "scale_0_10", "color_combo"]:
            input_type = "text"

        lower_name = input_name.lower()
        if lower_name in seen_names:
            continue

        seen_names.add(lower_name)

        cleaned_inputs.append({
            "value": input_name,
            "type": input_type
        })

    commanders = load_commanders()

    if commander_id:
        # EDIÇÃO
        updated = False

        for commander in commanders:
            if commander.get("id") == commander_id:
                commander["name"] = commander_name
                commander["inputs"] = cleaned_inputs
                updated = True
                break

        # Se vier id mas não existir, cria mesmo assim
        if not updated:
            commanders.append({
                "id": commander_id,
                "name": commander_name,
                "inputs": cleaned_inputs
            })

    else:
        # CRIAÇÃO
        commanders.append({
            "id": str(uuid.uuid4()),
            "name": commander_name,
            "inputs": cleaned_inputs
        })

    save_commanders(commanders)

    return jsonify({"success": True})


# =========================================================
# API - SALVAR MATCH
# =========================================================
@app.route("/api/matches", methods=["POST"])
def save_match_route():
    data = request.get_json(silent=True) or {}

    commander_id = str(data.get("commander_id", "")).strip()
    values = data.get("values", {})

    if not commander_id:
        return jsonify({
            "success": False,
            "error": "Commander is required."
        }), 400

    if not isinstance(values, dict):
        return jsonify({
            "success": False,
            "error": "Values must be an object."
        }), 400

    commanders = load_commanders()
    commander = next((c for c in commanders if c.get("id") == commander_id), None)

    if not commander:
        return jsonify({
            "success": False,
            "error": "Commander not found."
        }), 404

    cleaned_values = {}

    for input_def in commander.get("inputs", []):
        input_name = input_def.get("value", "").strip()
        input_type = input_def.get("type", "text").strip().lower()

        raw_value = values.get(input_name)

        if input_type == "number":
            if raw_value in [None, ""]:
                cleaned_values[input_name] = ""
            else:
                try:
                    cleaned_values[input_name] = float(raw_value)
                except (TypeError, ValueError):
                    cleaned_values[input_name] = ""

        elif input_type == "checkbox":
            if isinstance(raw_value, bool):
                cleaned_values[input_name] = raw_value
            elif isinstance(raw_value, str):
                cleaned_values[input_name] = raw_value.strip().lower() in ["true", "1", "yes", "on", "checked"]
            else:
                cleaned_values[input_name] = False

        elif input_type == "scale_0_10":
            allowed_values = {"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"}
            cleaned_value = "" if raw_value is None else str(raw_value).strip()
            cleaned_values[input_name] = cleaned_value if cleaned_value in allowed_values else ""

        elif input_type == "color_combo":
            allowed_colors = {"red", "blue", "white", "black", "green", "colorless"}

            cleaned_value = "" if raw_value is None else str(raw_value).strip().lower()

            if cleaned_value == "no player":
                cleaned_values[input_name] = "no player"

            elif cleaned_value == "":
                cleaned_values[input_name] = ""

            else:
                parts = cleaned_value.split()
                unique_parts = []
                seen = set()

                for part in parts:
                    if part in allowed_colors and part not in seen:
                        unique_parts.append(part)
                        seen.add(part)

                cleaned_values[input_name] = " ".join(unique_parts) if unique_parts else ""

        else:
            cleaned_values[input_name] = "" if raw_value is None else str(raw_value).strip()

    matches = load_matches()

    matches.append({
        "id": str(uuid.uuid4()),
        "commander_id": commander_id,
        "commander_name": commander.get("name", ""),
        "values": cleaned_values,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

    save_matches(matches)

    return jsonify({"success": True})


# =========================================================
# API - BUSCAR STATS DE UM COMMANDER
# =========================================================
@app.route("/api/stats/<commander_id>", methods=["GET"])
def get_stats(commander_id):
    commanders = load_commanders()
    matches = load_matches()

    commander = next((c for c in commanders if c.get("id") == commander_id), None)

    if not commander:
        return jsonify({
            "success": False,
            "error": "Commander not found."
        }), 404

    commander_matches = [m for m in matches if m.get("commander_id") == commander_id]
    stats = compute_stats_for_commander(commander, commander_matches)

    commander_matches.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return jsonify({
        "success": True,
        "commander": commander,
        "stats": stats,
        "matches": commander_matches
    })


# =========================================================
# API - EDITAR MATCH EXISTENTE
# =========================================================
@app.route("/api/matches/<match_id>", methods=["PUT"])
def update_match_route(match_id):
    data = request.get_json(silent=True) or {}

    commander_id = str(data.get("commander_id", "")).strip()
    values = data.get("values", {})

    if not commander_id:
        return jsonify({
            "success": False,
            "error": "Commander is required."
        }), 400

    if not isinstance(values, dict):
        return jsonify({
            "success": False,
            "error": "Values must be an object."
        }), 400

    commanders = load_commanders()
    commander = next((c for c in commanders if c.get("id") == commander_id), None)

    if not commander:
        return jsonify({
            "success": False,
            "error": "Commander not found."
        }), 404

    matches = load_matches()
    match = next((m for m in matches if m.get("id") == match_id), None)

    if not match:
        return jsonify({
            "success": False,
            "error": "Match not found."
        }), 404

    cleaned_values = {}

    for input_def in commander.get("inputs", []):
        input_name = input_def.get("value", "").strip()
        input_type = input_def.get("type", "text").strip().lower()

        raw_value = values.get(input_name)

        if input_type == "number":
            if raw_value in [None, ""]:
                cleaned_values[input_name] = ""
            else:
                try:
                    cleaned_values[input_name] = float(raw_value)
                except (TypeError, ValueError):
                    cleaned_values[input_name] = ""

        elif input_type == "checkbox":
            if isinstance(raw_value, bool):
                cleaned_values[input_name] = raw_value
            elif isinstance(raw_value, str):
                cleaned_values[input_name] = raw_value.strip().lower() in ["true", "1", "yes", "on", "checked"]
            else:
                cleaned_values[input_name] = False

        elif input_type == "scale_0_10":
            allowed_values = {"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"}
            cleaned_value = "" if raw_value is None else str(raw_value).strip()
            cleaned_values[input_name] = cleaned_value if cleaned_value in allowed_values else ""

        elif input_type == "color_combo":
            allowed_colors = {"red", "blue", "white", "black", "green", "colorless"}

            cleaned_value = "" if raw_value is None else str(raw_value).strip().lower()

            if cleaned_value == "no player":
                cleaned_values[input_name] = "no player"

            elif cleaned_value == "":
                cleaned_values[input_name] = ""

            else:
                parts = cleaned_value.split()
                unique_parts = []
                seen = set()

                for part in parts:
                    if part in allowed_colors and part not in seen:
                        unique_parts.append(part)
                        seen.add(part)

                cleaned_values[input_name] = " ".join(unique_parts) if unique_parts else ""

        else:
            cleaned_values[input_name] = "" if raw_value is None else str(raw_value).strip()

    match["commander_id"] = commander_id
    match["commander_name"] = commander.get("name", "")
    match["values"] = cleaned_values

    save_matches(matches)

    return jsonify({"success": True})


# =========================================================
# INICIALIZAÇÃO DO APP
# =========================================================
if __name__ == "__main__":
    ensure_json_file(COMMANDERS_FILE, [])
    ensure_json_file(MATCHES_FILE, [])
    app.run(debug=True)