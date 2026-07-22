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
from flask import Flask, jsonify, send_from_directory
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
app.register_blueprint(rotas_leads.bp)
app.register_blueprint(rotas_instagram.bp)
app.register_blueprint(rotas_analytics.bp)
app.register_blueprint(rotas_config.bp)


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

PASTA_FRONTEND = APP_DIR.parent / "frontend" / "dist"

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
