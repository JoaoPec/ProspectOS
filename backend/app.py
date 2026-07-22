"""
API do CRM local da ferramenta de prospecção.

Uso:
    py app.py
A API sobe em http://localhost:5000. A interface (React) roda em
http://localhost:5173 - use o iniciar.bat na raiz pra subir os dois juntos.

O código está dividido por responsabilidade:
    rotas_leads.py      - CRM dos leads do Google Maps + disparo da busca
    rotas_instagram.py  - CRM dos leads do Instagram + disparo da análise
    rotas_analytics.py  - métricas, funis, meta semanal, follow-ups do dia
    rotas_config.py     - chaves de IA, proxies, templates de mensagem
    ia.py               - provedores de IA e fallback unificado
    jobs.py             - jobs de background (scraper/análise) + persistência
    db.py               - conexão, configurações e backup do banco
    processar.py        - pipeline do CSV do scraper + schema/migrações
"""

import logging
import os
import sqlite3
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template_string, request, send_from_directory, session, url_for
from werkzeug.exceptions import HTTPException

load_dotenv()

APP_DIR = Path(__file__).parent
PASTA_LOGS = APP_DIR / "logs"
PASTA_LOGS.mkdir(exist_ok=True)
_handler_log = RotatingFileHandler(
    PASTA_LOGS / "prospeccao.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8"
)
_handler_log.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
logging.getLogger().addHandler(_handler_log)
# nível configurável via .env: PROSPECCAO_LOG_LEVEL=DEBUG|INFO|WARNING|ERROR
_nivel_log = os.environ.get("PROSPECCAO_LOG_LEVEL", "INFO").upper()
logging.getLogger().setLevel(getattr(logging, _nivel_log, logging.INFO))
logger = logging.getLogger(__name__)

import db
import jobs
import processar
import rotas_analytics
import rotas_config
import rotas_instagram
import rotas_leads

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "prospectos-dev-secret-change-me")
app.register_blueprint(rotas_leads.bp)
app.register_blueprint(rotas_instagram.bp)
app.register_blueprint(rotas_analytics.bp)
app.register_blueprint(rotas_config.bp)

# ── Auth ──────────────────────────────────────────────────────────

LOGIN_PASSWORD = os.environ.get("LOGIN_PASSWORD", "12345")
ROTAS_PUBLICAS = {"/login", "/logout", "/favicon.ico"}


@app.before_request
def verificar_autenticacao():
    # Skip auth in dev mode or if no password set
    _debug = os.environ.get("PROSPECCAO_DEBUG", "false").lower() == "true"
    if _debug or app.debug or not LOGIN_PASSWORD:
        return
    if request.path.startswith("/static"):
        return
    if request.path in ROTAS_PUBLICAS or request.path.startswith("/login"):
        return
    if session.get("autenticado"):
        return
    if request.path.startswith("/api/"):
        return jsonify({"erro": "não autenticado", "redirect": "/login"}), 401
    return redirect(url_for("tela_login"))


@app.route("/login", methods=["GET", "POST"])
def tela_login():
    if request.method == "POST":
        senha = request.form.get("senha", "")
        if senha == LOGIN_PASSWORD:
            session["autenticado"] = True
            return redirect(url_for("servir_frontend"))
        return LOGIN_HTML.replace("<!-- ERRO -->", '<p style="color:red;text-align:center">Senha incorreta</p>')
    return LOGIN_HTML.replace("<!-- ERRO -->", "")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("tela_login"))


LOGIN_HTML = """<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ProspectOS — Entrar</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem;width:100%;max-width:380px;text-align:center}
h2{font-size:1.5rem;margin-bottom:.5rem}
p{color:#94a3b8;font-size:.9rem;margin-bottom:1.5rem}
input{width:100%;padding:.75rem 1rem;border:1px solid #475569;border-radius:10px;background:#0f172a;color:#e2e8f0;font-size:1rem;text-align:center;letter-spacing:.3em;outline:none;transition:border-color .2s}
input:focus{border-color:#4f46e5}
button{width:100%;margin-top:1rem;padding:.75rem;border:none;border-radius:10px;background:#4f46e5;color:white;font-size:1rem;font-weight:600;cursor:pointer;transition:background .2s}
button:hover{background:#4338ca}
</style></head>
<body>
<div class="card">
<h2>🔒 ProspectOS</h2>
<p>Digite a senha para acessar</p>
<form method="POST">
<input type="password" name="senha" placeholder="•••••" autofocus required>
<button type="submit">Entrar</button>
</form>
<!-- ERRO -->
</div></body></html>"""


@app.errorhandler(Exception)
def tratar_erro_generico(erro):
    if isinstance(erro, HTTPException):
        return erro  # 404, 405 etc. devem chegar como são, não virar erro interno
    logger.exception("erro não tratado numa rota")
    return jsonify({"erro": "Ocorreu um erro interno. Veja detalhes em logs/prospeccao.log."}), 500


def preparar_banco_no_startup():
    """Garante que o schema esteja atualizado assim que o app sobe, mesmo que o
    usuário ainda não tenha rodado nenhuma busca nesta instalação."""
    conexao = sqlite3.connect(db.CAMINHO_BANCO, timeout=10)
    try:
        processar.preparar_banco(conexao)
    finally:
        conexao.close()


preparar_banco_no_startup()
jobs.marcar_jobs_interrompidos()
db.migrar_chaves_para_keyring()

# ── Railway: serve frontend static files in production ────────────

PASTA_FRONTEND = APP_DIR / "frontend" / "dist"

if PASTA_FRONTEND.is_dir():
    @app.route("/")
    def servir_frontend():
        return send_from_directory(str(PASTA_FRONTEND), "index.html")

    @app.route("/assets/<path:filename>")
    def servir_assets(filename):
        return send_from_directory(str(PASTA_FRONTEND / "assets"), filename)

    @app.route("/<path:filename>")
    def servir_arquivos(filename):
        caminho = PASTA_FRONTEND / filename
        if caminho.is_file():
            return send_from_directory(str(PASTA_FRONTEND), filename)
        return send_from_directory(str(PASTA_FRONTEND), "index.html")


if __name__ == "__main__":
    modo_dev = os.environ.get("PROSPECCAO_DEBUG", "false").lower() == "true"
    app.run(debug=modo_dev, port=5000)
